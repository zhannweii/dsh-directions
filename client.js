window.__ModuleLoader__.load({
  id: 'dsh-directions',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    const API = '/dsh-directions';
    const POLL_MS = 2000;

    const STATUS = {
      running: { dot: '#3b82f6', text: '运行中' },
      done: { dot: '#22c55e', text: '已完成' },
      error: { dot: '#ef4444', text: '失败' },
      interrupted: { dot: '#f59e0b', text: '已中断' },
    };

    async function api(path, init) {
      const response = await fetch(`${API}${path}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...init,
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error((payload && payload.error) || `请求失败（${response.status}）`);
      }
      return payload;
    }

    function post(path, body) {
      return api(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    function formatTokens(value) {
      if (!value) return '0';
      if (value < 1000) return String(value);
      return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
    }

    function formatTime(value) {
      if (!value) return '';
      const date = new Date(value);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    const styles = `
      .dshd-root { height: 100%; overflow: auto; padding: 28px 24px 96px; color: var(--dsw-alias-label-primary); }
      .dshd-inner { max-width: 940px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
      .dshd-head { display: flex; flex-direction: column; gap: 6px; }
      .dshd-headrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .dshd-rescan { font-size: 12px; padding: 4px 10px; }
      .dshd-title { font-size: 18px; font-weight: 600; letter-spacing: 0.01em; }
      .dshd-sub { font-size: 13px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
      .dshd-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 12px; }
      .dshd-compose { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .dshd-input { width: 100%; box-sizing: border-box; resize: vertical; min-height: 64px; padding: 10px 12px; font: inherit; font-size: 14px; line-height: 1.55; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; outline: none; }
      .dshd-input:focus { border-color: var(--dsw-alias-brand-primary); }
      .dshd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .dshd-spacer { flex: 1 1 auto; }
      .dshd-btn { font: inherit; font-size: 13px; padding: 7px 13px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); cursor: pointer; transition: background 120ms ease, border-color 120ms ease; }
      .dshd-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-overlay); }
      .dshd-btn:disabled { opacity: 0.5; cursor: default; }
      .dshd-btn-primary { background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff; }
      .dshd-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-brand-primary); opacity: 0.92; }
      .dshd-hint { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .dshd-list { display: flex; flex-direction: column; gap: 12px; }
      .dshd-item { padding: 14px 16px; display: flex; flex-direction: column; gap: 9px; }
      .dshd-item-head { display: flex; align-items: flex-start; gap: 10px; }
      .dshd-check { margin-top: 3px; accent-color: var(--dsw-alias-brand-primary); }
      .dshd-q { font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-word; flex: 1 1 auto; }
      .dshd-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; margin-top: 7px; }
      .dshd-state { font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .dshd-body { font-size: 13px; line-height: 1.65; color: var(--dsw-alias-label-secondary); white-space: pre-wrap; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
      .dshd-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--dsw-alias-label-secondary); flex-wrap: wrap; }
      .dshd-err { font-size: 12px; color: var(--dsw-alias-state-error-primary); line-height: 1.5; word-break: break-word; }
      .dshd-tag { font-size: 11px; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); }
      .dshd-empty { padding: 26px 16px; text-align: center; font-size: 13px; line-height: 1.7; color: var(--dsw-alias-label-secondary); }
      .dshd-notice { font-size: 12px; color: var(--dsw-alias-state-success-primary); }
      .dshd-bar { position: sticky; bottom: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-overlay); border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
      .dshd-code { font-size: 12px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); border-radius: 6px; padding: 1px 6px; }
    `;

    function Status({ status }) {
      const meta = STATUS[status] || STATUS.running;
      return h(
        'span',
        { className: 'dshd-meta' },
        h('span', { className: 'dshd-dot', style: { background: meta.dot } }),
        h('span', { className: 'dshd-state' }, meta.text),
      );
    }

    function DirectionItem({ item, selected, onToggle, onOpen, onInterrupt, onMerge, busy }) {
      return h(
        'div',
        { className: 'dshd-card dshd-item' },
        h(
          'div',
          { className: 'dshd-item-head' },
          h('input', {
            className: 'dshd-check',
            type: 'checkbox',
            checked: selected,
            onChange: () => onToggle(item.id),
            'aria-label': '选中该方向',
          }),
          h('div', { className: 'dshd-q' }, item.question || '未命名方向'),
          h(Status, { status: item.status }),
        ),
        item.conclusion
          ? h('div', { className: 'dshd-body' }, item.conclusion)
          : h('div', { className: 'dshd-hint' }, item.status === 'running' ? '正在独立探索…' : '没有产出文本结论'),
        item.error ? h('div', { className: 'dshd-err' }, item.error) : null,
        h(
          'div',
          { className: 'dshd-row' },
          h('span', { className: 'dshd-meta' }, `${formatTokens(item.tokens)} tokens`),
          item.createdAt ? h('span', { className: 'dshd-meta' }, formatTime(item.createdAt)) : null,
          item.merged ? h('span', { className: 'dshd-tag' }, '已综合过') : null,
          h('span', { className: 'dshd-spacer' }),
          h('button', { className: 'dshd-btn', onClick: () => onOpen(item.id) }, '打开分支'),
          item.status === 'running'
            ? h('button', { className: 'dshd-btn', disabled: busy, onClick: () => onInterrupt(item.id) }, '停止')
            : null,
          h('button', { className: 'dshd-btn', disabled: busy, onClick: () => onMerge([item.id]) }, '综合这一条'),
        ),
      );
    }

    function Directions(props) {
      const sessionId = props.sessionId || (props.session && props.session.sessionId) || '';
      const openSession = props.openSession;
      const [items, setItems] = useState([]);
      const [error, setError] = useState('');
      const [draft, setDraft] = useState('');
      const [busy, setBusy] = useState(false);
      const [notice, setNotice] = useState('');
      const [selected, setSelected] = useState({});
      const [selfInherited, setSelfInherited] = useState(0);
      const aliveRef = useRef(true);

      const load = useCallback(async (scan) => {
        if (!sessionId) return;
        try {
          const query = `/list?parent=${encodeURIComponent(sessionId)}${scan ? '&scan=1' : ''}`;
          const data = await api(query);
          if (!aliveRef.current) return;
          setItems(Array.isArray(data && data.directions) ? data.directions : []);
          setSelfInherited(Number(data && data.inherited) || 0);
          setError('');
        } catch (e) {
          if (!aliveRef.current) return;
          setError(e.message || String(e));
        }
      }, [sessionId]);

      useEffect(() => {
        aliveRef.current = true;
        load(true);
        const timer = setInterval(() => load(false), POLL_MS);
        return () => {
          aliveRef.current = false;
          clearInterval(timer);
        };
      }, [load]);

      const create = useCallback(async () => {
        const question = draft.trim();
        if (!question || busy || !sessionId) return;
        setBusy(true);
        setNotice('');
        try {
          await post('/create', { parent: sessionId, question });
          setDraft('');
          setNotice('已分叉，正在独立探索。');
          await load();
        } catch (e) {
          setError(e.message || String(e));
        } finally {
          setBusy(false);
        }
      }, [draft, busy, sessionId, load]);

      const merge = useCallback(
        async (ids) => {
          if (!ids.length || busy || !sessionId) return;
          setBusy(true);
          setNotice('');
          try {
            const data = await post('/merge', { parent: sessionId, ids });
            setSelected({});
            setNotice(`已把 ${(data && data.merged ? data.merged.length : ids.length)} 个方向写入主线，等待综合回答。`);
            await load();
          } catch (e) {
            setError(e.message || String(e));
          } finally {
            setBusy(false);
          }
        },
        [busy, sessionId, load],
      );

      const interrupt = useCallback(
        async (id) => {
          setBusy(true);
          try {
            await post('/interrupt', { parent: sessionId, id });
            await load();
          } catch (e) {
            setError(e.message || String(e));
          } finally {
            setBusy(false);
          }
        },
        [sessionId, load],
      );

      const open = useCallback(
        (id) => {
          if (typeof openSession === 'function') openSession(id);
        },
        [openSession],
      );

      const toggle = useCallback((id) => {
        setSelected((current) => {
          const next = { ...current };
          if (next[id]) delete next[id];
          else next[id] = true;
          return next;
        });
      }, []);

      const chosen = Object.keys(selected).filter((id) => items.some((item) => item.id === id));

      return h(
        'div',
        { className: 'dshd-root' },
        h('style', null, styles),
        h(
          'div',
          { className: 'dshd-inner' },
          h(
            'div',
            { className: 'dshd-head' },
            h(
              'div',
              { className: 'dshd-headrow' },
              h('div', { className: 'dshd-title' }, `方向${items.length ? ` · ${items.length}` : ''}`),
              h(
                'button',
                { className: 'dshd-btn dshd-rescan', disabled: busy, onClick: () => load(true) },
                '重新扫描分叉',
              ),
            ),
            h(
              'div',
              { className: 'dshd-sub' },
              '从当前对话分叉出独立分支：分支继承已完成的上下文，自己往下探索，主线不受影响。探索完再把选中的方向综合回主线。',
            ),
          ),
          h(
            'div',
            { className: 'dshd-card dshd-compose' },
            h('textarea', {
              className: 'dshd-input',
              value: draft,
              placeholder: '想单独探索的问题，例如：如果换成另一个方案会怎样？',
              onChange: (event) => setDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  create();
                }
              },
            }),
            h(
              'div',
              { className: 'dshd-row' },
              h('button', { className: 'dshd-btn dshd-btn-primary', disabled: busy || !draft.trim(), onClick: create }, busy ? '处理中…' : '⑂ 分叉探索'),
              h('span', { className: 'dshd-hint' }, 'Ctrl+Enter 创建 · 每个方向是独立会话，会单独消耗 token'),
              h('span', { className: 'dshd-spacer' }),
              notice ? h('span', { className: 'dshd-notice' }, notice) : null,
            ),
            error ? h('div', { className: 'dshd-err' }, error) : null,
          ),
          items.length === 0
            ? h(
                'div',
                { className: 'dshd-card dshd-empty' },
                selfInherited
                  ? '这条会话本身是从别处分叉出来的副本，DSH 的分叉不记录来源，所以这里看不到它的来路。请回到原会话打开「方向」，在那里管理和综合各条分支。'
                  : '还没有方向。',
                selfInherited ? null : h('br'),
                selfInherited ? null : '把刚才冒出来的那个「如果……呢？」写进上面的框，分叉出去试。',
                selfInherited ? null : h('br'),
                selfInherited ? null : '（用对话右上角 ⑂ 图标分出来的会话，也会在下面自动出现。）',
              )
            : h(
                'div',
                { className: 'dshd-list' },
                items.map((item) =>
                  h(DirectionItem, {
                    key: item.id,
                    item,
                    selected: Boolean(selected[item.id]),
                    onToggle: toggle,
                    onOpen: open,
                    onInterrupt: interrupt,
                    onMerge: merge,
                    busy,
                  }),
                ),
              ),
          chosen.length
            ? h(
                'div',
                { className: 'dshd-bar' },
                h('span', { className: 'dshd-hint' }, `已选 ${chosen.length} 个方向`),
                h('span', { className: 'dshd-spacer' }),
                h('button', { className: 'dshd-btn', onClick: () => setSelected({}) }, '清空'),
                h('button', { className: 'dshd-btn dshd-btn-primary', disabled: busy, onClick: () => merge(chosen) }, '综合选中方向'),
              )
            : null,
        ),
      );
    }

    /** Resolve the workspace service lazily: opening a branch stays optional. */
    function openBranch(ctx, id) {
      try {
        const workspace = typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : ctx.uiWorkspace;
        if (workspace && typeof workspace.openSession === 'function') {
          workspace.openSession(id);
          return;
        }
      } catch {
        /* service unavailable */
      }
      try {
        window.open(`?session=${encodeURIComponent(id)}`, '_blank');
      } catch {
        /* no window */
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.view', () =>
          ctx.slots.register(
            { name: 'conversation.view', id: 'directions', order: 15, label: '方向' },
            (props) => h(Directions, { ...props, openSession: (id) => openBranch(ctx, id) }),
          ),
        );
      },
    };
  },
});
