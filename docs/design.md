# Claude Desktop Installer - 设计文档

## 1. 系统架构

### 1.1 整体架构

采用 Electron 多进程架构，严格遵循安全最佳实践：

```
┌─────────────────────────────────────────────────┐
│                  Electron App                      │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │           Main Process (Node.js)            │ │
│  │                                             │ │
│  │  ┌──────────────┐  ┌────────────────────┐  │ │
│  │  │ ipc-handlers │←→│     cli.ts        │  │ │
│  │  │    .ts       │  │ (业务逻辑)         │  │ │
│  │  └──────────────┘  │ - Node.js 安装     │  │ │
│  │         ↕          │ - Claude Code 安装  │  │ │
│  │  ┌──────────────┐  │ - 配置文件读写      │  │ │
│  │  │ window       │  │ - MCP 管理         │  │ │
│  │  │ lifecycle    │  │ - 诊断命令          │  │ │
│  │  └──────────────┘  └────────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
│         ↕ IPC (contextBridge)                     │
│  ┌─────────────────────────────────────────────┐ │
│  │        Preload Script (沙箱)                │ │
│  │  contextBridge.exposeInMainWorld('api', {}) │ │
│  └─────────────────────────────────────────────┘ │
│         ↕ window.api.*                           │
│  ┌─────────────────────────────────────────────┐ │
│  │        Renderer Process (Chromium)          │ │
│  │                                             │ │
│  │  React SPA + Mantine UI + Tailwind CSS     │ │
│  │  - Welcome / EnvCheck / Setup / Dashboard   │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 1.2 技术选型

| 层 | 技术 | 版本 | 用途 |
|----|------|------|------|
| 框架 | Electron | 33.3.1 | 桌面应用运行时 |
| 前端框架 | React | 18.3.1 | UI 组件化开发 |
| UI 库 | Mantine | 7.17.4 | 组件库（Button, Tabs, TextInput 等） |
| 样式 | Tailwind CSS | 3.4.17 | 原子化 CSS |
| 路由 | React Router DOM | 7.5.2 | 客户端路由 (HashRouter) |
| 构建 | Vite | 6.3.5 | 开发服务器 + 打包 |
| 图标 | Tabler Icons | 3.31.0 | UI 图标 |
| 打包 | Electron Builder | 24.13.3 | 跨平台安装包 |
| 通知 | @mantine/notifications | 7.17.4 | Toast 通知 |

---

## 2. 应用状态机

### 2.1 状态流转

```
welcome ──→ env-check ──→ setup ──→ dashboard
                                ↑          │
                                └──────────┘
                              (重新配置)
```

| 状态 | 说明 | 布局 |
|------|------|------|
| `welcome` | 安全提示页，用户确认后继续 | 居中卡片 (renderFrame) |
| `env-check` | 自动检测环境，安装缺失组件 | 居中卡片 (renderFrame) |
| `setup` | 分步配置向导（API → MCP → WeChat） | 带步骤指示器的全屏布局 |
| `dashboard` | 主界面，侧边栏 + 内容区 | MainLayout + HashRouter |

### 2.2 状态机实现

在 `App.tsx` 中通过 `useState<AppState>` 管理，不使用外部状态库。各状态通过回调函数驱动转换：

```tsx
type AppState = 'welcome' | 'env-check' | 'setup' | 'dashboard'
type SetupStep = 'api-config' | 'mcp' | 'wechat'
```

---

## 3. 页面设计

### 3.1 Welcome 页

**路径**: `welcome` 状态（非路由）  
**布局**: `renderFrame()` 居中卡片，最大宽度 480px

**内容**:
- Logo + 标题 + 安全提醒徽章
- 三张信息卡片（关于 Claude Code / 关于 Claude Installer / 环境说明）
- "我已阅读并了解以上内容" 复选框
- "确认继续" 按钮（disabled 直到勾选）

### 3.2 EnvCheck 页

**路径**: `env-check` 状态（非路由）  
**布局**: `renderFrame()` 居中卡片，最大宽度 420px

**内容**:
- 标题 + 进度条
- 三个检测项，每项显示状态图标 + 详情：
  - Node.js 环境（检测/安装）
  - Claude Code（检测/安装）
  - 基础配置（创建默认 GLM 配置）
- 实时日志输出区域

**逻辑**: 自动顺序执行，检测到缺失组件时自动安装，完成后回调 `onReady(status)`。

### 3.3 Setup 向导

**路径**: `setup` 状态（非路由）  
**布局**: 全屏，顶部可拖拽标题栏 + 步骤指示器 + 内容区

**步骤指示器** (Qclaw 风格):
```
  ① ─── ② ─── ③
API配置  MCP服务器  WeChat ACP
```
- 当前步骤：绿色圆圈 + 数字 + ring
- 已完成步骤：绿色实心 + ✓
- 未到达步骤：灰色空心

**Step 1 - API 配置**:
- API 地址输入框
- API 令牌输入框（密码模式）
- 三个模型层级输入框
- "保存并继续" / "跳过" 按钮

**Step 2 - MCP 服务器**:
- 预设服务器快速添加按钮（标签式）
- 自定义服务器添加表单（名称、参数）
- "保存并继续" / "返回" / "跳过" 按钮

**Step 3 - WeChat ACP**:
- 令牌输入框
- "安装 WeChat ACP" / "返回" / "跳过" 按钮

### 3.4 Dashboard 页

**路径**: `/#/` (HashRouter)  
**布局**: MainLayout（侧边栏 + 内容区）

**内容**:
- 标题 + 状态描述
- 三列状态卡片（Node.js / Claude Code / WeChat ACP）
- MCP 服务器列表（名称 + 命令 + 状态）
- 操作按钮组（刷新状态 / 运行诊断 / 设置）
- 诊断输出区域（可折叠）
- 路径信息

### 3.5 Settings 页

**路径**: `/#/settings`  
**布局**: MainLayout（侧边栏 + 内容区）

**四个 Tab**:

| Tab | 内容 |
|-----|------|
| 通用 | API 地址、令牌、超时时间 |
| MCP 服务器 | 已配置列表、自定义添加表单、预设快速添加 |
| 模型 | Haiku/Sonnet/Opus 三级模型配置 + GLM 默认值按钮 |
| 环境变量 | 所有 env 变量的键值编辑 + Agent Teams 开关 |

---

## 4. 组件设计

### 4.1 MainLayout

侧边栏导航布局（参考 Qclaw）：

```
┌──────────────────────────────────┐
│     [logo] Claude Installer       │ ← 可拖拽标题栏
├──────────┬───────────────────────┤
│          │                       │
│  面板    │                       │
│  设置    │      <Outlet />       │
│          │                       │
│          │                       │
├──────────┴───────────────────────┤
│  系统托盘区域                    │
└──────────────────────────────────┘
```

- 侧边栏宽度：160px
- 导航项使用 NavLink，选中态为 `bg-[brand-light]`
- 标题栏 `WebkitAppRegion: 'drag'` 实现拖拽
- 设置项固定在底部

### 4.2 renderFrame 辅助函数

用于 welcome / env-check 等全屏居中布局：

```tsx
const renderFrame = (content: ReactNode) => (
  <div className="h-screen flex flex-col">
    <div className="h-10 flex items-center justify-center gap-1.5" style={{ WebkitAppRegion: 'drag' }}>
      <Logo /> <span>Claude Installer</span>
    </div>
    <div className="flex-1 flex items-center justify-center px-6 pb-6 overflow-y-auto">
      {content}
    </div>
  </div>
)
```

---

## 5. IPC 通信设计

### 5.1 API 接口

所有渲染进程与主进程的通信通过 `window.api` 对象，在 `src/types.ts` 的 `Api` 接口中定义类型。

```
window.api
├── Platform
│   └── getPlatformInfo(): PlatformInfo
├── Environment Detection
│   ├── checkNode(): NodeCheckResult
│   ├── checkClaudeCode(): ClaudeCodeCheckResult
│   ├── checkWechatAcp(): WechatAcpCheckResult
│   ├── checkMcpServers(): McpServerStatus[]
│   └── getStatus(): SystemStatus
├── Installation
│   ├── installNode(opts?): InstallResult
│   ├── installClaudeCode(): InstallResult
│   ├── installEnv(opts?): { success, steps }
│   ├── installWechatAcp(opts?): { success, message, steps }
│   └── refreshEnvironment(): void
├── CLI Operations
│   ├── runCli(args, opts?): { success, code, stdout, stderr }
│   ├── runShell(cmd, args?, opts?): { success, code, stdout, stderr }
│   └── cancelCommand(domain): { success }
├── CLI Streams (events)
│   ├── onCliStdout(callback): unsubscribe
│   ├── onCliStderr(callback): unsubscribe
│   ├── onShellStdout(callback): unsubscribe
│   ├── onShellStderr(callback): unsubscribe
│   └── onDoctorOutput(callback): unsubscribe
├── Config Management
│   ├── readConfig(path?): { data, path }
│   ├── writeConfig(data, path?): { success, path }
│   ├── readSettings(): { data, path }
│   └── writeSettings(settings): { success, path }
├── MCP Server Management
│   ├── installMcpServer(name, config): { success, message }
│   └── uninstallMcpServer(name): { success, message }
├── Diagnostics
│   └── runDoctor(): { success, results }
└── Window
    └── openExternal(url): void
```

### 5.2 通信流程

```
Renderer                    Preload                    Main
   │                          │                          │
   │ window.api.getStatus()  │                          │
   ├─────────────────────────→│ ipcRenderer.invoke         │
   │                          ├──────────────────────────→│ ipcMain.handle
   │                          │                          ├──────────→ cli.ts
   │                          │                          │    getStatus()
   │                          │                          │←──────────┘
   │                          │←──────────────────────────┤ return result
   │←─────────────────────────┤                          │
   │   SystemStatus           │                          │
```

对于实时输出（诊断、CLI），使用 `webContents.send` 从主进程推送到渲染进程。

---

## 6. 主题系统

### 6.1 颜色方案

采用 Mantine CSS Variables Resolver，支持亮色/暗色主题自动切换：

| 语义变量 | 暗色值 | 用途 |
|----------|--------|------|
| `--app-bg-primary` | `#0f0f11` | 页面主背景 |
| `--app-bg-secondary` | `#1c1c1f` | 卡片/组件背景 |
| `--app-bg-tertiary` | `#2a2a2e` | 悬浮/按钮背景 |
| `--app-text-primary` | `#f4f4f5` | 主要文字 |
| `--app-text-secondary` | `#e4e4e7` | 次要文字 |
| `--app-text-muted` | `#8a8a95` | 辅助文字 |
| `--app-text-faint` | `#626268` | 最弱文字 |
| `--app-border` | `#27272a` | 边框/分割线 |
| `--app-text-success` | `#34d399` | 成功状态 |
| `--app-text-danger` | `#f87171` | 错误状态 |

### 6.2 语义化工具类

```css
.app-text-primary    /* 主要文字颜色 */
.app-text-secondary  /* 次要文字颜色 */
.app-bg-primary     /* 主背景色 */
.app-bg-secondary   /* 卡片背景色 */
.app-border         /* 边框色 */
```

### 6.3 品牌色

使用 Indigo 色系作为主操作色（替代 Qclaw 的橙色）：
- 品牌色：`#6366f1`
- 自定义 Mantine 颜色板 `brand`（10 级梯度）

---

## 7. 文件结构

```
claude-desktop-app/
├── electron/
│   ├── main/
│   │   ├── index.ts          # 窗口创建、托盘、应用生命周期
│   │   ├── ipc-handlers.ts  # IPC 处理器注册
│   │   └── cli.ts            # 核心业务逻辑
│   └── preload/
│       └── index.ts          # contextBridge API 暴露
├── src/
│   ├── assets/
│   │   └── fonts/            # AlibabaPuHuiTi 字体
│   ├── components/
│   │   └── MainLayout.tsx    # 侧边栏导航布局
│   ├── pages/
│   │   ├── Welcome.tsx       # 欢迎页
│   │   ├── EnvCheck.tsx      # 环境检测页
│   │   ├── Dashboard.tsx     # 仪表盘
│   │   └── Settings.tsx      # 设置页
│   ├── App.tsx               # 应用入口 + 状态机
│   ├── main.tsx              # React 入口 + Provider
│   ├── index.css             # 全局样式
│   ├── theme.ts              # Mantine 主题配置
│   └── types.ts              # TypeScript 类型定义
├── public/                   # 应用图标
├── index.html                # HTML 模板
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.cjs
└── tsconfig.json
```

---

## 8. 配置文件

### 8.1 Claude Code 配置 (`~/.claude/settings.json`)

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "API_TIMEOUT_MS": "30000000",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5-turbo",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.1"
  },
  "enabledPlugins": {},
  "mcpServers": {}
}
```

### 8.2 默认 MCP 预设

| 名称 | 命令 | 说明 |
|------|------|------|
| sequential-thinking | `npx -y @modelcontextprotocol/server-sequential-thinking` | 复杂推理 |
| playwright | `npx -y @playwright/mcp@latest` | 浏览器自动化 |
| memory | `npx -y @modelcontextprotocol/server-memory` | 知识图谱记忆 |
| context7 | `npx -y @upstash/context7-mcp` | 库文档查询 |
| filesystem | `npx -y @modelcontextprotocol/server-filesystem /` | 文件系统 |
| github | `npx -y @modelcontextprotocol/server-github` | GitHub API |

---

## 9. 构建与打包

### 9.1 开发模式

```bash
npm run dev
```

Vite 开发服务器（端口 5173）+ Electron 自动启动，支持热更新。

### 9.2 生产构建

```bash
npm run build:mac    # macOS DMG (x64 + arm64)
npm run build:win    # Windows NSIS (x64)
```

### 9.3 Electron Builder 配置

- **appId**: `com.claude-installer.desktop`
- **macOS**: DMG 格式，支持通用二进制，分类为 developer-tools
- **Windows**: NSIS 安装器，支持自定义安装目录，创建桌面和开始菜单快捷方式
