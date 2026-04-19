# Claude Desktop — 产品需求文档（PRD）

本文档描述当前代码库中 **Claude Desktop** 的产品定位、用户旅程、功能与非功能需求，并与实现保持一致（基于 `CLAUDE.md`、`main.py`、`backend/cli.py`、`ui/`）。

---

## 1. 文档信息

| 项 | 内容 |
|----|------|
| 产品名称 | Claude Desktop |
| 产品定位 | 面向中文用户的 **Claude Code 安装与配置桌面工具**（Python + PySide6），默认对接智谱 GLM 兼容 Anthropic 的 API 代理 |
| 技术栈 | Python 3、PySide6、Markdown；业务逻辑集中在 `backend/cli.py` |
| 配置落盘 | `~/.claude/settings.json`（及 `~/.claude/` 目录） |

---

## 2. 背景与目标

### 2.1 背景

Claude Code 依赖 Node.js 与全局 CLI，且需配置 API、可选 MCP 与微信 ACP。本应用将检测、安装、向导配置与日常状态查看集中在一个桌面窗口中，降低上手成本。

### 2.2 产品目标

1. **一键就绪**：自动检测并（在可能情况下）安装 Node.js 与 `@anthropic-ai/claude-code`。
2. **配置可视化**：编辑 API、模型映射、环境变量与 MCP，并写回 `settings.json`。
3. **状态可观测**：面板展示 Node / Claude Code / WeChat ACP / MCP 列表，并提供诊断输出。
4. **轻量对话**：在应用内通过子进程调用 `claude` CLI，流式展示回复与工具调用摘要（可选）。

### 2.3 目标用户

- 已使用或计划使用 **Claude Code** 的开发者。
- 希望使用 **智谱 BigModel** 等兼容端点、或需快速配置 **MCP / WeChat ACP** 的用户。

---

## 3. 用户旅程

1. **欢迎页**：展示安全与能力说明；用户需勾选同意条款后进入下一步。
2. **环境检测页**：后台线程依次检测 Node.js、Claude Code、配置文件；缺失时尝试自动安装 Node 与 Claude Code；若无 `settings.json` 则写入默认配置。
3. **分支**：
   - Node 与 Claude Code **均已安装** → 进入主界面「面板」。
   - 否则 → **设置向导**（API → MCP → WeChat ACP），完成后进入面板。
4. **主界面**：侧栏在「面板 / 对话 / 设置」间切换；标题栏统一为「Claude Desktop」。

---

## 4. 功能需求

### 4.1 欢迎与合规（FR-WEL）

| ID | 需求描述 | 验收要点 |
|----|----------|----------|
| FR-WEL-01 | 展示 Claude Code 与本工具的能力、风险与费用提示 | 文案分区展示（关于 Claude Code、关于本工具、环境说明） |
| FR-WEL-02 | 未勾选同意则不可继续 | 按钮在未勾选时禁用 |

### 4.2 环境与安装（FR-ENV）

| ID | 需求描述 | 验收要点 |
|----|----------|----------|
| FR-ENV-01 | 检测 Node.js：是否安装、版本、路径；识别 nvm 等场景 | 与 `check_node()` 行为一致 |
| FR-ENV-02 | 检测 Claude Code CLI（`claude`） | 与 `check_claude_code()` 一致 |
| FR-ENV-03 | Node 未安装时尝试安装：优先 nvm（非 Windows）；否则 macOS 下载 `.pkg`、Windows 下载 `.msi` 并触发安装 | 需管理员权限的场景有明确反馈（依赖系统脚本） |
| FR-ENV-04 | Claude Code 未安装时通过 `npm install -g @anthropic-ai/claude-code` 安装，registry 顺序为 npmmirror 再 npmjs | 超时与失败有返回信息 |
| FR-ENV-05 | 若不存在 `settings.json`，创建并写入默认 `env` / `mcpServers` / `enabledPlugins` | 默认值与代码中 `DEFAULT_SETTINGS` 一致 |
| FR-ENV-06 | 长耗时检测与安装在 **QThread** 中执行，避免阻塞 UI | 环境页不卡死 |

**默认配置（需求级说明）**

- `ANTHROPIC_BASE_URL`：`https://open.bigmodel.cn/api/anthropic`
- 默认模型：`glm-4.5-air`（haiku）、`glm-5-turbo`（sonnet）、`glm-5.1`（opus）
- 其他：`API_TIMEOUT_MS`、`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` 等与 `backend/cli.py` 中 `DEFAULT_SETTINGS` 一致

### 4.3 设置向导（FR-WIZ）

| ID | 需求描述 | 验收要点 |
|----|----------|----------|
| FR-WIZ-01 | 三步：API 配置 → MCP 预设 → WeChat ACP | 步骤指示器与内容区切换正确 |
| FR-WIZ-02 | API 步骤可填写并保存 BASE_URL、Token、超时等到 `env` | 写回 `settings.json` |
| FR-WIZ-03 | MCP 步骤可从预设勾选并写入 `mcpServers` | 与向导内 `MCP_WIZARD_PRESETS` 一致 |
| FR-WIZ-04 | WeChat ACP：可选 Token；调用全局安装与 MCP 配置 | 与 `install_wechat_acp` 行为一致 |
| FR-WIZ-05 | 完成向导后刷新状态并进入面板 | 与 `setup_complete` 信号链一致 |

### 4.4 系统面板（FR-DASH）

| ID | 需求描述 | 验收要点 |
|----|----------|----------|
| FR-DASH-01 | 卡片展示 Node.js、Claude Code、WeChat ACP 状态 | 数据来自 `get_status()` |
| FR-DASH-02 | 列出已配置 MCP 名称/command 摘要；空状态有提示 | 与 `check_mcp_servers` 一致 |
| FR-DASH-03 | 「管理」「设置」跳转至设置页 | 信号 `navigate_settings` |
| FR-DASH-04 | 「刷新状态」重新拉取 `get_status()` 与 `read_settings()` | 刷新后 UI 更新 |
| FR-DASH-05 | 「运行诊断」在后台线程执行 `run_doctor`，输出追加到面板只读区域 | 检查 Node、npm、Claude Code、settings、网络（curl npm registry）等 |

### 4.5 设置页（FR-SET）

| ID | 需求描述 | 验收要点 |
|----|----------|----------|
| FR-SET-01 | 多标签：通用 / MCP / 模型 / 环境变量 | 与 `SettingsPage` 一致 |
| FR-SET-02 | 通用：API 地址、令牌（密文）、超时；保存写回 `env` | 调用 `write_settings` |
| FR-SET-03 | MCP：展示已配置项；支持卸载；提供多组预设（sequential-thinking、playwright、memory、context7、filesystem、github 等） | 与 `MCP_PRESETS` 及 `install_mcp_server` / `uninstall_mcp_server` 一致 |
| FR-SET-04 | 模型：编辑 Haiku/Sonnet/Opus 对应环境变量键值 | 写回 `env` |
| FR-SET-05 | 环境变量：展示与编辑其它 `env` 键值 | 与实现一致 |
| FR-SET-06 | 设置变更后通知主窗口更新内存中的 `_settings` | `settings_changed` 信号 |

### 4.6 对话页（FR-CHAT）

| ID | 需求描述 | 验收要点 |
|----|----------|----------|
| FR-CHAT-01 | 若找不到 `claude` 可执行文件，提示用户先安装 | 与 `ChatWorker` 错误文案一致 |
| FR-CHAT-02 | 每次用户消息在子进程中执行：`claude -p <msg> --output-format stream-json --verbose --dangerously-skip-permissions`，可选 `--resume <session_id>` | 与当前参数一致；**安全上需在文档与 UI 中显式标注：跳过权限确认** |
| FR-CHAT-03 | 解析 stream-json：展示 assistant 文本增量、tool_use 摘要（Bash/Read/Edit 等） | 与 `ChatWorker._tool_summary` 映射一致 |
| FR-CHAT-04 | 会话续聊：从 `result` 中取 `session_id` 保存，后续带 `--resume` | 与 `ChatPage._on_complete` 一致 |
| FR-CHAT-05 | UI：用户气泡右对齐、助手 Markdown 渲染（fenced_code、tables、codehilite）、建议 prompt、新对话清空会话 | 与 `ChatPage` 一致 |
| FR-CHAT-06 | 发送中可「停止」：中断线程并 terminate 子进程 | `ChatWorker.stop` |
| FR-CHAT-07 | 若返回 `total_cost_usd` 则在标题区展示费用摘要 | 与 `_cost_label` 一致 |

### 4.7 全局与导航（FR-APP）

| ID | 需求描述 | 验收要点 |
|----|----------|----------|
| FR-APP-01 | 应用使用 Fusion + 自定义 Checkbox 样式；全局 QSS 来自 `ui/theme.py` | 启动无样式异常 |
| FR-APP-02 | 默认窗口约 1100×750，最小约 900×650 | 与 `AppWindow` 一致 |
| FR-APP-03 | 侧栏当前项高亮 | `MainLayout.set_active_nav` |

---

## 5. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | 环境检测、诊断、安装、对话均在后台线程；主线程不长时间阻塞 |
| 兼容性 | macOS、Windows 分支逻辑（Node 安装包、路径分隔符、`npm.cmd` 等） |
| PATH 探测 | 增强 PATH：Homebrew、nvm、fnm、Volta 等常见 Node 安装位置 |
| 可维护性 | UI 与 `backend/cli.py` 职责分离；配置读写集中 |
| 依赖 | `PySide6>=6.6`，`markdown>=3.6`（对话 Markdown） |
| 可观测性 | Doctor 输出人类可读日志；安装步骤返回结构化 `steps` |

---

## 6. 数据与安全需求

1. **敏感数据**：API Token 等在 UI 中以密码框展示；落盘于用户本机 `settings.json`。
2. **对话模式风险**：当前实现使用 `--dangerously-skip-permissions`，应视为「高权限自动执行」模式，仅适合受信任环境；后续版本可考虑显式开关、默认关闭或二次确认。
3. **网络**：安装依赖 npm registry；Doctor 使用 `curl` 探测（Windows 环境需确认是否具备 `curl`）。

---

## 7. 对外部系统的依赖

- Node.js 官方分发或 nvm 安装渠道。
- npm：`registry.npmmirror.com` 与 `registry.npmjs.org`。
- 智谱 Open API：`ANTHROPIC_BASE_URL` 默认地址。
- WeChat ACP：全局 npm 包 `wechat-acp` 及 MCP 配置。

---

## 8. 已知限制与后续 Backlog 建议

1. **Linux**：Node 安装逻辑以 macOS `.pkg` 与 Windows `.msi` 为主，Linux 未在 `install_node` 中单独分支；若需支持应补需求与实现。
2. **Doctor 网络检查**：依赖本机 `curl`，在部分 Windows 环境可能不可用或行为不同。
3. **对话工作目录**：子进程 `cwd` 为 `os.getcwd()`，与「从哪打开应用」有关；若需固定项目目录可作为新需求。
4. **设置向导与面板数据同步**：进入设置页时依赖 `_settings` 已加载；从欢迎链路与「直接重启应用」路径需在测试中统一验收。

---

## 9. 术语表

| 术语 | 含义 |
|------|------|
| Claude Code | Anthropic 提供的 CLI 编程助手（`@anthropic-ai/claude-code`） |
| MCP | Model Context Protocol，在 `settings.json` 的 `mcpServers` 中配置 |
| WeChat ACP | 微信相关的 MCP 集成包 `wechat-acp` |
| Doctor | 本地环境自检与网络探测集合（`run_doctor`） |

---

## 10. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-04-19 | 1.0 | 初稿：与当前仓库实现同步 |
