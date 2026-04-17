# Claude Desktop Installer - 需求文档

## 1. 项目概述

### 1.1 项目名称
Claude Desktop Installer

### 1.2 项目背景
Claude Code 是 Anthropic 推出的 AI 编程助手命令行工具，通过 npm 安装，依赖 Node.js 环境。对于非技术背景用户，手动安装和配置 Claude Code 存在较高门槛。本项目旨在提供一个图形化的桌面安装器，一键完成环境检测、依赖安装、API 配置和 MCP 服务器管理。

### 1.3 目标用户
- 需要在本地使用 Claude Code 的开发者
- 不熟悉命令行操作的用户
- 使用智谱 GLM API 作为 Anthropic API 代理的中国用户

### 1.4 项目目标
- 降低 Claude Code 的安装和使用门槛
- 提供图形化的环境检测和自动安装
- 统一管理 Claude Code 的配置（API、MCP 服务器、环境变量）
- 支持 macOS 和 Windows 双平台

---

## 2. 功能需求

### 2.1 环境检测与自动安装

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| ENV-01 | Node.js 环境检测 | P0 | 检测系统是否已安装 Node.js，显示版本号，检测是否由 nvm 管理 |
| ENV-02 | Node.js 自动安装 | P0 | 若未检测到 Node.js，自动下载并安装 LTS 版本（22.x） |
| ENV-03 | Claude Code 检测 | P0 | 检测系统是否已安装 `@anthropic-ai/claude-code` npm 包 |
| ENV-04 | Claude Code 自动安装 | P0 | 若未检测到 Claude Code，通过 `npm install -g` 安装，支持中国镜像回退 |
| ENV-05 | 环境刷新 | P0 | 安装完成后刷新 PATH 环境变量，使新安装的工具立即可用 |
| ENV-06 | 安装进度反馈 | P1 | 显示实时安装日志和进度指示 |

### 2.2 API 配置

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| API-01 | API 地址配置 | P0 | 支持自定义 `ANTHROPIC_BASE_URL`，默认值为智谱 GLM 代理地址 |
| API-02 | API 令牌配置 | P0 | 支持输入 `ANTHROPIC_AUTH_TOKEN`，密码输入框遮罩显示 |
| API-03 | 模型映射配置 | P1 | 可配置三个层级的模型：Haiku（快速）、Sonnet（标准）、Opus（强力） |
| API-04 | GLM 默认预设 | P0 | 提供一键恢复智谱 GLM 默认配置（API 地址 + 模型映射） |
| API-05 | Anthropic 官方预设 | P1 | 提供一键切换为 Anthropic 官方 API 配置 |
| API-06 | API 超时配置 | P2 | 可自定义 `API_TIMEOUT_MS`，默认 30000000ms |

### 2.3 MCP 服务器管理

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| MCP-01 | 已配置服务器列表 | P0 | 展示当前 `~/.claude/settings.json` 中已配置的 MCP 服务器 |
| MCP-02 | 添加自定义服务器 | P0 | 支持输入名称、命令、参数、环境变量来添加 MCP 服务器 |
| MCP-03 | 移除服务器 | P0 | 支持移除已配置的 MCP 服务器 |
| MCP-04 | 预设服务器快速添加 | P1 | 提供常用 MCP 服务器的快速添加按钮（sequential-thinking, playwright, memory, filesystem, github, context7 等） |
| MCP-05 | 服务器状态显示 | P2 | 在 Dashboard 中显示已配置服务器的运行状态 |

### 2.4 WeChat ACP 集成

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| WX-01 | WeChat ACP 安装 | P2 | 可选安装 WeChat ACP 作为 MCP 服务器 |
| WX-02 | 令牌配置 | P2 | 支持输入 WeChat ACP 令牌 |
| WX-03 | 安装步骤反馈 | P2 | 显示 WeChat ACP 安装的各个步骤结果 |

### 2.5 系统诊断

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| DIAG-01 | 运行诊断 | P1 | 执行全面的系统诊断，检查 Node.js、npm、Claude Code、配置文件、网络连通性 |
| DIAG-02 | 实时输出 | P1 | 诊断结果实时流式显示 |
| DIAG-03 | 状态刷新 | P0 | 手动刷新系统状态 |

### 2.6 仪表盘

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| DASH-01 | 组件状态卡片 | P0 | 显示 Node.js、Claude Code、WeChat ACP 的安装/配置状态 |
| DASH-02 | MCP 服务器概览 | P0 | 列出已配置的 MCP 服务器及其命令信息 |
| DASH-03 | 快捷操作 | P1 | 提供刷新状态、运行诊断、进入设置的快捷按钮 |
| DASH-04 | 路径信息 | P2 | 显示 Claude 目录和配置文件路径 |

### 2.7 用户引导流程

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| FLOW-01 | 欢迎页 | P0 | 显示安全提示和功能说明，用户需确认后继续 |
| FLOW-02 | 环境检测页 | P0 | 自动检测环境并安装缺失组件，显示进度 |
| FLOW-03 | 配置向导 | P0 | 分步引导完成 API 配置、MCP 服务器配置、WeChat ACP 配置 |
| FLOW-04 | 自动跳转 | P0 | 首次安装完成后自动进入仪表盘，已安装用户直接进入仪表盘 |
| FLOW-05 | 重新配置 | P1 | 支持从仪表盘重新进入配置向导 |

---

## 3. 非功能需求

### 3.1 平台支持
- macOS (x64 + arm64)：DMG 安装包，原生标题栏，系统托盘常驻
- Windows (x64)：NSIS 安装包，支持自定义安装目录，桌面和开始菜单快捷方式

### 3.2 安全性
- 严格进程隔离：`contextIsolation: true`，`nodeIntegration: false`
- 渲染进程通过 preload 脚本的 contextBridge 与主进程通信
- API 令牌等敏感信息使用密码输入框显示

### 3.3 性能
- 应用启动到首屏显示 < 3 秒
- 环境检测响应 < 2 秒
- 安装操作实时反馈，不阻塞 UI

### 3.4 界面
- 基于 Qclaw (qiuzhi2046/qclaw) 的视觉风格
- Mantine UI 组件库 + Tailwind CSS
- 支持亮色/暗色主题切换
- 中文界面
- 侧边栏导航布局

---

## 4. 约束条件

| 约束 | 说明 |
|------|------|
| 运行时 | 需要 Node.js 18+ 和 npm |
| 网络 | Claude Code 安装需要网络连接，支持中国镜像回退 |
| 权限 | macOS 可能需要管理员权限安装 Node.js |
| 配置文件 | 所有配置存储在 `~/.claude/settings.json`，无云端同步 |
