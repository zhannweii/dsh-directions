/**
 * Direction branches for one conversation.
 *
 * Each direction is an independent fork-session: it inherits the completed turns
 * of the source conversation, runs the branch question on its own, and never
 * touches the main thread. The panel lists the branches and can fold the chosen
 * ones back into the main conversation as one visible synthesis request.
 */

const ROUTE = '/dsh-directions'
/** Marker stored in the subagent catalog label so our branches stay identifiable. */
const MARK = '\u2442'
const MAX_MERGE = 8
const MERGE_SNIPPET_CHARS = 1500
const LABEL_CHARS = 60

export const inject = ['sessions', 'sessionQuery', 'agents', 'subagents']

export function apply(ctx) {
  /** Branch ids already folded into the main thread (session-local, not persisted). */
  const merged = new Set()

  ctx.inject(['webServer'], (sub) => {
    sub.effect(() => {
      const offs = [
        sub.webServer.register({ kind: 'exact', path: `${ROUTE}/list`, handler: (req, res) => guard(res, () => listRoute(req, res)) }),
        sub.webServer.register({ kind: 'exact', path: `${ROUTE}/create`, handler: (req, res) => guard(res, () => createRoute(req, res)) }),
        sub.webServer.register({ kind: 'exact', path: `${ROUTE}/merge`, handler: (req, res) => guard(res, () => mergeRoute(req, res)) }),
        sub.webServer.register({ kind: 'exact', path: `${ROUTE}/interrupt`, handler: (req, res) => guard(res, () => interruptRoute(req, res)) }),
      ]
      return () => {
        for (const off of offs) {
          try {
            off?.()
          } catch {
            /* already disposed */
          }
        }
      }
    }, 'dsh-directions: routes')
  })

  // ---- routes -------------------------------------------------------------

  async function listRoute(req, res) {
    const url = new URL(req.url ?? ROUTE, 'http://localhost')
    const parent = url.searchParams.get('parent')
    if (!parent) return send(res, 400, { error: '缺少 parent 参数' })
    const directions = await loadDirections(parent)
    send(res, 200, { directions })
  }

  async function createRoute(req, res) {
    const body = await readBody(req)
    const parent = requireId(body.parent, 'parent')
    const question = requireText(body.question, 'question')
    const agent = ctx.agents.get(parent)
    if (!agent) {
      return send(res, 409, { error: '主线会话当前没有运行中的 Agent。先在输入框发一条消息，再创建方向。' })
    }
    const provider = resolveForkProvider()
    if (!provider) {
      return send(res, 409, { error: '没有可用的 fork 子代理后端（需要 @deepseek-ai/dsh-subagent-fork-in-process）。' })
    }
    const label = `${MARK} ${truncate(question, LABEL_CHARS)}`
    let activation
    try {
      activation = await ctx.subagents.startActivation({
        provider,
        label,
        request: { parent: agent, prompt: [{ type: 'text', text: question }] },
        signal: new AbortController().signal,
        delivery: 'caller',
      })
    } catch (error) {
      return send(res, 502, { error: explainCreateFailure(error) })
    }
    const childId = String(activation.childId)
    // Release the activation slot once the branch settles; the child session stays
    // durable, so the panel can still open it later (cold resume).
    void activation.result.then(
      () => activation.dispose().catch(() => {}),
      () => activation.dispose().catch(() => {}),
    )
    send(res, 200, { id: childId, question, label, status: 'running' })
  }

  async function mergeRoute(req, res) {
    const body = await readBody(req)
    const parent = requireId(body.parent, 'parent')
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
    if (!ids.length) return send(res, 400, { error: '没有选中任何方向' })
    if (ids.length > MAX_MERGE) return send(res, 400, { error: `一次最多综合 ${MAX_MERGE} 个方向` })
    const agent = ctx.agents.get(parent)
    if (!agent) {
      return send(res, 409, { error: '主线会话当前没有运行中的 Agent。先在输入框发一条消息，再综合方向。' })
    }
    const rows = await loadDirections(parent)
    const chosen = ids.map((id) => rows.find((row) => row.id === id)).filter(Boolean)
    if (!chosen.length) return send(res, 404, { error: '选中的方向已经不存在' })
    const text = buildMergePrompt(chosen)
    try {
      agent.followup({ content: [{ type: 'text', text }], source: { kind: 'user' } })
    } catch (error) {
      return send(res, 502, { error: `无法把综合请求写入主线：${messageOf(error)}` })
    }
    for (const row of chosen) merged.add(row.id)
    send(res, 200, { merged: chosen.map((row) => row.id) })
  }

  async function interruptRoute(req, res) {
    const body = await readBody(req)
    const parent = requireId(body.parent, 'parent')
    const id = requireId(body.id, 'id')
    try {
      ctx.subagents.interrupt(id, { kind: 'user', parentSessionId: parent })
    } catch (error) {
      const agent = ctx.agents.get(id)
      if (!agent) return send(res, 409, { error: `无法停止该方向：${messageOf(error)}` })
      try {
        agent.cancel({ kind: 'user' })
      } catch (inner) {
        return send(res, 409, { error: `无法停止该方向：${messageOf(inner)}` })
      }
    }
    send(res, 200, { ok: true })
  }

  // ---- derivation ---------------------------------------------------------

  /** Every branch started from `parentId`, newest first, with derived progress. */
  async function loadDirections(parentId) {
    const entries = await listBranches(parentId)
    const rows = await Promise.all(entries.map((entry) => describeBranch(parentId, entry)))
    return rows.sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt))
  }

  async function listBranches(parentId) {
    const found = new Map()
    // Catalog first: it carries the branch label and survives activations we already disposed.
    try {
      const entries = await ctx.subagents.listChildren(parentId)
      for (const entry of entries) {
        if (typeof entry.label !== 'string' || !entry.label.startsWith(MARK)) continue
        found.set(String(entry.id), { id: String(entry.id), label: entry.label, createdAt: entry.createdAt })
      }
    } catch {
      /* catalog unavailable */
    }
    // Lineage second: durable session headers whose parentSession points back here.
    try {
      const records = await ctx.sessionQuery.listSessions()
      for (const record of records) {
        const id = String(record.header.id)
        if (String(record.header.parentSession ?? '') !== parentId) continue
        if (found.has(id)) continue
        found.set(id, { id, label: '', createdAt: record.header.createdAt })
      }
    } catch {
      /* lineage unavailable */
    }
    return [...found.values()]
  }

  async function describeBranch(parentId, entry) {
    const base = { id: entry.id, createdAt: entry.createdAt, question: stripMark(entry.label), conclusion: '', tokens: 0, status: 'running', error: '', merged: merged.has(entry.id) }
    let events = []
    let inherited = 0
    try {
      const snapshot = await ctx.sessionQuery.readSession(entry.id)
      events = snapshot.events ?? []
      inherited = Number(snapshot.inheritedEventCount) || 0
    } catch (error) {
      const live = ctx.sessions.get(entry.id)
      if (!live) return { ...base, status: 'error', error: `无法读取该方向：${messageOf(error)}` }
      events = live.ownEvents()
      inherited = 0
    }
    // Everything before `inherited` is the copied prefix; the branch's own work starts after it.
    const own = events.slice(inherited)
    const users = own.filter((event) => event.type === 'user/message')
    const asked = textOf(users[0]?.data)
    if (asked) base.question = asked
    const answers = own.filter((event) => event.type === 'assistant/message')
    const lastAnswer = answers[answers.length - 1]
    base.conclusion = truncate(textOf(lastAnswer?.data?.message), 600)
    let tokens = 0
    for (const answer of answers) {
      const usage = answer.data?.usage
      if (usage) tokens += (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
    }
    base.tokens = tokens
    const last = own[own.length - 1]
    if (!last) {
      base.status = 'running'
      return base
    }
    if (last.type !== 'turn/end') {
      base.status = 'running'
      return base
    }
    const reason = last.data?.reason ?? { kind: 'completed' }
    base.status = 'done'
    if (reason.kind === 'error') {
      base.status = 'error'
      base.error = reason.error?.message ?? '执行失败'
    } else if (reason.kind === 'aborted') {
      base.status = 'interrupted'
    } else if (reason.kind === 'max-tokens') {
      base.status = 'error'
      base.error = '达到输出上限，结论可能不完整'
    } else if (reason.kind === 'blocked') {
      base.status = 'error'
      base.error = '被阻塞'
    }
    return base
  }

  function buildMergePrompt(rows) {
    const blocks = rows.map((row, index) => {
      const conclusion = row.conclusion
        ? truncate(row.conclusion, MERGE_SNIPPET_CHARS)
        : '（该方向尚未产出结论）'
      const state = row.status === 'running' ? '（仍在运行，结论为阶段性）' : row.status === 'error' ? `（失败：${row.error || '未知原因'}）` : row.status === 'interrupted' ? '（已中断）' : ''
      return `#### 方向 ${index + 1} · ${row.question}${state}\n${conclusion}`
    })
    return [
      '【方向综合】以下是我在同一段对话里分叉出去的几个平行方向的探索结果。请把它们综合成一个结论：',
      '',
      '1. 先给出最终答案或推荐方案；',
      '2. 再说明各方向的取舍、冲突点，以及为什么采用/放弃某个方向；',
      '3. 信息不足或方向未完成的地方直接说明，不要凭空补全。',
      '',
      blocks.join('\n\n'),
      '',
      '这些结果已经由分支会话完成，直接综合即可，不要重新执行其中的工具操作。',
    ].join('\n')
  }

  // ---- helpers ------------------------------------------------------------

  function resolveForkProvider() {
    let names = []
    try {
      names = ctx.subagents.list()
    } catch {
      return undefined
    }
    if (names.includes('fork')) return 'fork'
    return names.find((name) => {
      try {
        return ctx.subagents.getProvider(name)?.inheritsParentContext === true
      } catch {
        return false
      }
    })
  }
}

function explainCreateFailure(error) {
  const text = messageOf(error)
  if (text.includes('ACTIVATION_LIMIT_REACHED') || text.includes('activation limit')) {
    return '同时存在的方向已达上限（默认 8 个）。先综合或等已有方向结束再创建。'
  }
  if (text.includes('CONTINUATION_UNAVAILABLE')) return '当前组合没有可用的子代理运行环境。'
  if (text.includes('UNAUTHORIZED')) return '主线 Agent 已失效，刷新会话后再试。'
  return `创建方向失败：${text}`
}

function messageOf(error) {
  if (!error) return '未知错误'
  if (typeof error === 'string') return error
  return error.message || String(error)
}

function textOf(message) {
  if (!message) return ''
  const content = message.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('\n')
      .trim()
  }
  return ''
}

function truncate(text, limit) {
  const value = typeof text === 'string' ? text : ''
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

function stripMark(label) {
  if (typeof label !== 'string') return ''
  return label.startsWith(MARK) ? label.slice(MARK.length).trim() : label
}

/** Ordering key for createdAt values that may be numbers, ISO strings, or Dates. */
function stamp(value) {
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function requireId(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `缺少 ${field} 参数`)
  return value.trim()
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, '请输入要探索的问题')
  return value.trim()
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function send(res, status, value) {
  const body = JSON.stringify(value)
  try {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch {
    /* response already gone */
  }
}

async function guard(res, run) {
  try {
    await run()
  } catch (error) {
    send(res, error instanceof HttpError ? error.status : 500, { error: messageOf(error) })
  }
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {}
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new HttpError(413, '请求体过大')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON')
  }
}
