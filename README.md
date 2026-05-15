[🇬🇧 English](README.en.md)

---

# 🧚 Pixey Proxy

> **Vibe Coding 产物** — 由 [Claude](https://claude.ai)（Anthropic）独立设计、编写与提交。  
> 一个带 TOTP 双因素守护的反向代理认证器，附像素风蓝色小精灵吉祥物。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Go 1.22+](https://img.shields.io/badge/go-1.22%2B-00ADD8.svg)](https://go.dev)
[![Bun](https://img.shields.io/badge/bun-1.x-fbf0df.svg)](https://bun.sh)

---

## 它是什么

Pixey 位于上游 HTTP/HTTPS 代理之前，在其基础上叠加一套独立的认证层：

```
客户端 ──[用户名:密码]──► Pixey 代理 ──[上游凭证]──► 上游代理 ──► 互联网
                               │
                          Web 管理界面 :7071
                          （TOTP 保护）
```

- **代理转发** — 将所有流量转发至配置的上游代理
- **临时凭证** — 生成有效期 30 分钟到 7 天的用户名/密码对
- **TOTP 管理界面** — 兼容 Google Authenticator / Authy，无需记忆密码
- **零运行时依赖** — 单一自包含二进制，前端已嵌入其中

---

## 快速开始

### 方式一：Docker（推荐，无需安装 Go / Bun）

**前提条件**：已安装 [Docker](https://docs.docker.com/get-docker/) 与 Docker Compose。

```bash
git clone https://github.com/peter2500zz/pixey
cd pixey
```

编辑 `config.yaml`，填入上游代理地址：

```yaml
upstream:
  url: "http://localhost:8080"  # host 网络模式下直接用 localhost
  username: ""
  password: ""

proxy:
  addr: ":7070"
web:
  addr: ":7071"
```

> **网络说明（默认：host 网络模式，仅 Linux）**
> - 容器与宿主机共享网络栈，7070 / 7071 端口直接绑定在宿主机上
> - 上游代理在宿主机时，URL 直接填 `http://localhost:<端口>`
> - **macOS / Windows**：host 模式不可用，需在 `docker-compose.yml` 中改用 bridge 模式（取消注释 `ports` 与 `extra_hosts` 行，并注释掉 `network_mode`）

启动服务：

```bash
docker compose up -d
```

首次运行会自动构建镜像（约 1~2 分钟）。之后打开 **http://localhost:7071** 完成 TOTP 初始设置。

数据持久化在 Docker volume `pixey-data` 中，重启容器不会丢失 TOTP 密钥和凭证。

常用命令：

```bash
docker compose logs -f          # 查看实时日志
docker compose restart          # 重启（修改 config.yaml 后）
docker compose down             # 停止并移除容器
docker compose down -v          # 停止并清除所有数据（慎用）
```

---

### 方式二：本地构建

**前提条件**

| 工具 | 版本 | 用途 |
|------|------|------|
| [Go](https://go.dev/dl/) | 1.22+ | 后端编译 |
| [Bun](https://bun.sh) | 1.x | 前端构建与包管理 |
| `make` | 任意 | 构建编排 |

```bash
git clone https://github.com/peter2500zz/pixey
cd pixey

# 安装前端依赖并完整构建
make build
```

这将产出一个嵌入了 Web 界面的单一 `./pixey` 可执行文件。

### 配置

运行前编辑 `config.yaml`：

```yaml
upstream:
  url: "http://你的上游代理:8080"
  username: ""          # 若上游无需认证则留空
  password: ""

proxy:
  addr: ":7070"         # 客户端连接此端口

web:
  addr: ":7071"         # 管理后台
```

### 运行

```bash
./pixey
```

打开 **http://localhost:7071** 完成 TOTP 初始设置，随后将生成的凭证配置到任意 HTTP 代理客户端，指向 `localhost:7070` 即可使用。

---

## 构建系统

Pixey 采用两步构建：Vite 将 React 前端编译至 `internal/web/dist/`，Go 再通过 `//go:embed` 将其嵌入二进制。

```
frontend/  →  bun run build  →  internal/web/dist/  →  go build  →  ./pixey
```

### Make 指令

| 命令 | 说明 |
|------|------|
| `make build` | 构建前端 + Go 二进制（生产） |
| `make dev` | 并行启动开发服务器 — Vite HMR 在 :5173，Go API 在 :7071 |
| `make frontend` | 仅重建前端 |
| `make backend` | 仅重建 Go 二进制 |
| `make release` | 交叉编译 Linux/macOS/Windows（amd64 + arm64） |
| `make clean` | 清除所有构建产物 |
| `make deps` | 安装/整理所有依赖 |

### 开发模式

```bash
make dev
```

并行启动两个进程：
- **Go 后端** 监听 `:7070`（代理）+ `:7071`（API）
- **Vite 开发服务器** 在 `:5173` 提供 HMR，并将 `/api/*` 代理至 `:7071`

开发时访问 `http://localhost:5173`。

### 跨平台发布

```bash
make release
```

在 `dist/` 中输出以下平台的二进制文件：

- `pixey-linux-amd64`、`pixey-linux-arm64`
- `pixey-darwin-amd64`、`pixey-darwin-arm64`
- `pixey-windows-amd64.exe`

---

## 前端技术栈

| 包 | 作用 |
|----|------|
| [React 19](https://react.dev) | UI 框架 |
| [Vite](https://vite.dev) + [Bun](https://bun.sh) | 构建工具与包管理器 |
| [Tailwind CSS 3](https://tailwindcss.com) | 原子化样式 |
| [Framer Motion](https://motion.dev) | 动画 |
| [Radix UI](https://radix-ui.com) | 无障碍交互原语 |
| [Lucide React](https://lucide.dev) | 图标 |

---

## 管理界面使用指南

### 首次运行 — TOTP 设置

1. 访问 `http://localhost:7071`
2. 用 Google Authenticator 或 Authy 扫描二维码
3. 输入 6 位验证码确认绑定（仅需一次）
4. 进入管理仪表盘

### 创建凭证

1. 在验证框输入当前 TOTP 码
2. 点击「新建凭证」旁的 **+**
3. 选择有效时长（30 分钟 ~ 7 天）
4. 点击**创建凭证**

生成的用户名（5 位字母）和密码（9 位字母数字）可直接复制。

### 续租 / 删除

每张凭证卡片都有**续租**和**删除**按钮，均需在验证框中填入有效 TOTP 码方可操作。

### 分享二维码

点击顶部导航栏中的二维码图标（需要有效 TOTP），可再次显示初始化二维码，方便在第二台设备上绑定。

---

## 代理使用方法

将客户端配置为使用 `localhost:7070` 作为 HTTP 代理，并填入生成的凭证：

```bash
# curl 示例
curl -x http://用户名:密码@localhost:7070 https://example.com

# 环境变量
export http_proxy=http://用户名:密码@localhost:7070
export https_proxy=http://用户名:密码@localhost:7070
```

Pixey 会自动将请求转发给上游代理；若上游需要认证，凭证会从 `config.yaml` 中自动附加。

---

## 安全说明

- TOTP 密钥存储于 `data/totp_secret`（权限 `0600`）— **请做好备份**
- 所有管理操作均需有效 TOTP 码（无 Session Cookie）
- 过期凭证在 `min(有效时长, 1 天)` 内仍保留（方便续租），之后自动清除
- 未通过认证的连接将收到 `407 Proxy Auth Required`

---

## 许可证

[MIT](LICENSE) © Claude（Anthropic）

---

*本项目是一个 Vibe Coding 产物——由 AI 助手自主完成设计、编写与提交，作为自主软件创作的示范。*
