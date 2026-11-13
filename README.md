# dsh-directions

Explore one conversation in several directions at once, then fold the results back into one answer.

A conversation rarely moves in a straight line: a temporary side question turns into its own line of
inquiry, one line reaches a result while the others still hold something useful. **dsh-directions**
turns each of those side questions into a real forked session, shows every direction on one board,
and synthesizes the ones you keep back into the main thread.

English | [中文](#中文)

## What it does

- **Fork a direction** — switch the conversation body to the **方向 / Directions** view, type a side
  question, press `Ctrl+Enter`. The branch is a real child session that inherits the completed turns
  of the current conversation (a fork subagent) and then explores on its own. The main thread is
  never touched.
- **Watch the board** — every branch started from this conversation is listed with its status
  (running / done / failed / interrupted), the question, a one-glance conclusion, its own token
  usage, when it started, and whether it was already folded back.
- **Synthesize** — select one or more branches and press **综合选中方向**. The plugin appends one
  visible user message to the main conversation containing the chosen conclusions and a synthesis
  instruction, so the main agent answers with the combined result.
- **Open or stop** — open any branch as its own conversation, or stop a branch that is still running.

## Install

### From the plugin market (recommended)

1. **插件 / Plugins → 实验性插件 → 更多** and turn on **自定义插件市场 / Custom plugin markets**.
2. Open the **发现 / Discover** tab → **添加索引源 / Add index source** and enter:

   ```
   https://zhannweii.github.io/dsh-directions/market/index.json
   ```

3. Install **dsh-directions**, then confirm the fork subagent provider (`subagent-fork-in-process`)
   is enabled — the branch feature uses it.

### From source

```sh
dsh plugin add git+https://github.com/zhannweii/dsh-directions.git
```

Then enable **dsh-directions** in **插件 / Plugins** (installed bundles).

### Requirements

- DSH `>=0.2.0-rc.2` (also matches `>=0.2.1-rc.2`, `>=0.2.2-rc.1`), Web UI.
- The bundled subagent provider `subagent-fork-in-process`, enabled by default.

## Usage

1. Start or resume a conversation so its agent is live.
2. Switch the conversation body to the **方向** view.
3. Write the side question and press `Ctrl+Enter` — repeat for other directions.
4. Open a branch when you want to read or continue it; press **停止** to cut a dead end early.
5. Select the branches worth keeping and press **综合选中方向**. The main conversation receives the
   conclusions and answers the combined question.

The board is derived data: it reads the conversation's child sessions and the subagent catalog, so
branches created in an earlier visit still show up.

## Cost note

A branch re-sends the inherited conversation on its first request and then accumulates usage on its
own, so every direction costs tokens independently. The board shows each branch's own usage so dead
ends are visible before you synthesize them.

## How it works

- Host half (`index.js`): registers same-origin JSON routes under `/dsh-directions/` (`list`,
  `create`, `merge`, `interrupt`), starts branches through `ctx.subagents.startActivation` with the
  `fork` provider, and derives each card from session events.
- Client half (`client.js`): registers the **方向** view in the conversation view slot and polls the
  list route. It uses DSH theme tokens only, so it follows light and dark themes.
- No data leaves the machine: everything lives in the local session store.

## License

MIT — see [LICENSE](LICENSE).

---

## 中文

把一段对话同时往几个方向推进，最后再把有效的结果合并回一个答案。

会话很少是一条直线：临时插入的一个小问题会长成一条支线，某条支线先得到结果，其余支线也各自留下了有用的东西。**dsh-directions** 把每个这样的问题变成真正 fork 出来的子会话，在一个看板里展示所有方向，并把你保留的方向综合回主线。

### 它做什么

- **分叉一个方向** — 把会话主体切到 **方向** 视图，写下一个问题，按 `Ctrl+Enter`。分支是一个真实的子会话（fork 子代理），继承当前对话已完成的轮次，然后独立探索；主线完全不受影响。
- **看板** — 列出这段对话派生出的所有方向：状态（运行中 / 完成 / 失败 / 中断）、问题、一眼可读的结论、该方向自己的 token 用量、开始时间、是否已经综合过。
- **综合** — 勾选一个或多个方向，按 **综合选中方向**。插件会往主线追加一条可见的用户消息，内含选中的结论和综合指令，主线 AI 据此给出合并后的答案。
- **打开 / 停止** — 把分支作为独立会话打开，或提前停掉一条死路。

### 安装

1. **插件 → 实验性插件 → 更多**，打开 **自定义插件市场**。
2. 打开 **发现** 标签 → **添加索引源**，填入
   `https://zhannweii.github.io/dsh-directions/market/index.json`。
3. 安装 **dsh-directions**；确认 `subagent-fork-in-process` 子代理提供方已启用（分叉依赖它）。

源码安装：`dsh plugin add git+https://github.com/zhannweii/dsh-directions.git`，然后在 **插件** 页启用。

### 成本提示

每个分支的首轮请求会重发继承来的对话，之后独立累计用量；看板会显示每个分支自己的消耗，方便在综合前看出哪些是死路。

### 许可证

MIT。
