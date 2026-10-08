# 技术栈与运行约定

## 状态与归属

本文记录已选技术、版本策略与运行方式；架构边界见 [架构](architecture.md)。当前所有应用依赖、启动脚本和构建产物均待实现。未来的 `package.json`、`pnpm-lock.yaml`、`go.mod`、`go.sum` 与部署配置是精确版本和可执行命令的证据。

## 已选技术

| 责任            | 选择                                    | 放置位置与约束                                         |
| --------------- | --------------------------------------- | ------------------------------------------------------ |
| 前端框架        | React + TypeScript                      | React 只进入 presentation 和平台装配；启用严格类型检查 |
| 前端开发与构建  | Vite                                    | 开发时代理 `/api`，发布时生成静态资源                  |
| 包管理          | pnpm                                    | 统一使用 pnpm，提交唯一锁文件                          |
| 页面路由        | React Router                            | 属于跨上下文 presentation 外壳                         |
| 样式与基础组件  | Tailwind CSS + shadcn/ui                | 语义化主题变量，组件源码归 presentation                |
| 图标            | Lucide                                  | 统一图标集合，图标按钮有可访问名称                     |
| 服务端状态      | TanStack Query                          | React hooks 在 presentation，通过应用层用例获取数据    |
| 规则排序        | dnd kit                                 | 只管理拖拽交互，实际顺序由后端保存                     |
| 后端语言与 HTTP | Go + 标准库 `net/http`                  | HTTP handler 属于 infrastructure 入站适配器            |
| 数据库访问      | pgx                                     | 显式 SQL 与事务，适配器实现应用层端口                  |
| 数据库          | PostgreSQL 17 系列                      | 使用数据库唯一约束、外键、检查约束及事务               |
| 迁移            | 版本化 SQL + golang-migrate             | 迁移在 `backend/migrations/`，不依赖 ORM 自动建表      |
| 登录            | PostgreSQL 服务端会话 + HttpOnly Cookie | 会话与密码规则见登录与权限文档                         |
| 日志            | Go `log/slog`                           | 平台注入；领域层不直接写诊断日志                       |
| 后端测试        | Go `testing`                            | 单元、真实 PostgreSQL 集成及 HTTP 契约测试             |
| 前端测试        | Vitest + Testing Library                | 单元与组件测试优先                                     |
| 浏览器关键路径  | Playwright                              | 连接真实 Go API 与隔离 PostgreSQL                      |
| 启动与交付      | Makefile、Docker Compose、原生开发脚本  | 统一命令入口，支持容器和本机开发                       |

这些技术用于实现本项目已确定的需求。Redis、消息队列、微服务、事件溯源和通用工作流引擎未纳入当前方案；新增技术需要说明实际需求与维护成本。

## 版本与依赖策略

- 开始搭建时核实官方支持版本并锁定；宿主机已有版本不自动等于项目支持版本。
- JavaScript 直接依赖使用精确版本号，禁止 `^`、`~`、`latest` 与范围版本；配置 `save-exact=true`。
- Go 模块提交 `go.mod` 和 `go.sum`，工具链版本与部署镜像一致。
- Node.js 选受支持的 LTS，pnpm 版本通过 `packageManager` 固定；不以当前宿主的非 LTS 版本定义最低要求。
- PostgreSQL 本地、CI 与发布使用同一主版本；可复现交付时锁定容器镜像标签，发布记录包含实际镜像摘要。
- 依赖升级说明影响面并运行受影响边界检查；不为局部 UI 修改顺带升级整个依赖树。

## 开发与部署拓扑

开发模式：浏览器 → Vite `/api` 代理 → Go 服务 → PostgreSQL。

发布模式：浏览器 → HTTPS 入口 → Go 服务（前端静态资源与 `/api`）→ PostgreSQL。

前端构建产物在发布构建时通过 Go `embed` 打包；测试和开发模式允许独立运行 API。数据库迁移由显式命令执行，不在每次普通请求或每个服务副本启动时自动修改 schema。

在线部署采用同一镜像与迁移。具体平台及账号尚未确定，在线实例在真实发布和验证后才能标记完成。

## 环境配置

预期至少提供 `DATABASE_URL`、`TEST_DATABASE_URL`、`HTTP_ADDR`、`APP_ORIGIN`、`SESSION_TTL` 与演示用户初始化变量。最终变量名、默认值和必填项由落地的配置解析器与 `.env.example` 同步维护。

开发数据库与测试数据库严格分离。演示账户密码只通过环境变量或本地显式 seed 参数输入，线上默认不注入公开通用密码。数据库凭据、会话令牌与部署密钥不进入源码、日志或 AI 记录。

启动与测试命令的当前状态见 [执行手册](../testing/TESTING_RUNBOOK.md)。本规范阶段不宣称任何规划命令已经可执行。
