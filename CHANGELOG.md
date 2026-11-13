# Changelog

## 0.1.0 — 2026-11-13

首版：把一段对话里临时冒出来的支线，变成可并行探索、最终可综合的「方向」。

### 新增（本仓库全部文件）

| 文件 | 作用 |
| --- | --- |
| `index.js` | 宿主侧：`/dsh-directions/{list,create,merge,interrupt}` 四条 HTTP 路由；分支创建、派生、综合 |
| `client.js` | 前端：「方向」视图（`conversation.view`，id `directions`，order 15） |
| `package.json` | 包声明：`exports`、`dsh.bundle.patch`、`dsh.client` |
| `cordis.patch.yml` | 把本包插入 profile 的行声明 |
| `locale/{zh,en}.json` | 插件清单里的中英文标题/描述 |
| `icon.svg` | 插件清单图标 |

### 安装时 profile 被自动修改（由 `plugin_manager install_bundle` 写入，非手写）

| 位置 | 变更 |
| --- | --- |
| `%USERPROFILE%\.dsh\profiles\desktop\package.json` | `dependencies` 增加 `"dsh-directions": "link:E:/dsh/plugins/dsh-directions"` |
| 同上 | `dsh.profile.bundles` 末尾增加 `"dsh-directions"`（真正启用处） |
| 同上目录 `pnpm-lock.yaml` | 增加 link 条目 |
| 同上目录 `node_modules/dsh-directions` | 符号链接 → 本目录 |

### 关键接线点

- `index.js:17` `inject = ['sessions','sessionQuery','agents','subagents']`
- `index.js:19-41` `apply()` 内 `ctx.inject(['webServer'])` + `sub.effect()` 注册四条路由
- `index.js:53-86` `createRoute` → `subagents.startActivation({ provider:'fork', delivery:'caller' })` 造分支
- `index.js:165-217` `describeBranch` 从分支自身事件派生 问题/结论/token/状态
- `index.js:219-238` `buildMergePrompt` 生成【方向综合】提示词
- `index.js:88-109` `mergeRoute` → `agent.followup(...)` 写回主线
- `client.js:340-350` 向 `conversation.view` 注册视图
- `client.js:323-338` `openBranch` → `uiWorkspace.openSession`

### 首次安装后的修补（已重新 apply）

1. `MARK` 由 `\u2460`（①）改为 `\u2442`（⑂），与界面一致。
2. `describeBranch`：`readSession` 失败时回退到 `live.ownEvents()`。
3. `listBranches`：catalog + 会话血缘双路合并去重，避免已结束分支从列表消失。
4. 新增 `stamp()`：`createdAt` 兼容 number / ISO string / Date 排序。

### 已验证

- 安装 `application: applied`，无 warning；`plugin_manager` 中 `include:dsh-directions` 为 active。
- `conversation.view` 槽位占用含 `{ id:'directions', order:15, active:true }`。
- 路由：`/list` 缺参 → 400；`?parent=bogus` → 200 空列表；无运行 Agent 时 `/create`、`/merge` → 409。

### 待人工验证

- 页面内创建分支、卡片出结论、综合消息写回主线三条链路（需在 GUI 中点击）。

### 发布准备（0.1.0 仓库化）

- 仓库：<https://github.com/zhannweii/dsh-directions>（`main`，话题 `dsh-plugin`）。
- 新增 `LICENSE`（MIT）、`engines.dsh`、`repository`/`homepage`/`author`/`keywords`。
- `market/index.json` + `market/icons/dsh-directions.svg`：一个由 GitHub Pages 托管的 format 1 市场索引，
  可在 DSH「发现 → 添加索引源」中直接添加 <https://zhannweii.github.io/dsh-directions/market/index.json>。
- README 补齐安装说明、成本提示、实现说明与中英双语介绍。
