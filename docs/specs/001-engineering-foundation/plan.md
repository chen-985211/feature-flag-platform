# Plan：工程基础

状态：已授权执行，S1～S3 已验证；S4/S5 待实施，S6 只落地了后端与文档命令。对应 [Spec](spec.md)，复用用户已确认的方案和本次开始授权。

## 范围与分层

- `backend/go.mod`：固定 Go 与 pgx；模块使用本地项目路径，不假设不存在的 GitHub 仓库。
- `backend/internal/platform/config/`：无副作用配置解析与验证。
- `backend/internal/platform/http/`：技术健康端点，注入数据库 probe，超时/取消与稳定错误。
- `backend/cmd/server/`：读取配置、装配 pgx pool、注册 HTTP 与优雅关闭。
- `frontend/`：后续落实分层用例/HTTP adapter、React 外壳与基础状态。
- `backend/migrations/`：后续数据库规格与真实空库验证。
- 根工具入口与 docs：根据实际完成的阶段维护命令和状态。

技术健康端点不依赖其他上下文内部模型。probe 是技术函数边界；业务端口仍归各上下文 application。未来认证端点通过 Identity 用例接入，不把权限塞到配置解析器。

## 分步实施与 TDD

| 步骤          | 验收     | Red/替代验证                                          | Green 与退出条件                           |
| ------------- | -------- | ----------------------------------------------------- | ------------------------------------------ |
| S1 配置       | EF-01/02 | 有效缺省、规范化和非法参数表驱动；先运行失败测试      | 有效配置成功，错误不含敏感原值             |
| S2 健康       | EF-03/04 | 注入健康/失败/阻塞 probe，先观察 200/503/超时契约失败 | 有界 probe 和稳定 JSON，不泄露内部错误     |
| S3 实际 API   | EF-05    | 真实 PostgreSQL smoke，配置与 S2 已有保护             | pgx pool + HTTP 装配、启动、关闭和实际请求 |
| S4 前端       | EF-06    | 应用用例 unit、状态 component 与 API 消费 contract    | React 只依赖注入用例，真实 API 反馈        |
| S5 数据与迁移 | EF-07    | SQL 约束和版本/事务结构 integration                   | 空库迁移、隔离数据库、可复现迁移入口       |
| S6 工具链     | EF-08    | 真实 lint/typecheck/import 边界/build 检查            | 锁文件、Make 与配置入口，不为脚本镜像测试  |

每步相关实现之前先完成有效 Red；配置/工具步骤使用实际检查，下载或编译环境失败不计作业务 Red。当前先交付 S1～S3 的可验证入口，D1 不因此标为全部完成。

## 技术细化

- Go 1.27.0 与本机一致，pgx 使用官方模块元数据核实的 v5.11.0，间接依赖由 go.sum 固定。
- 前端以 Node 24 LTS 为支持基线，固定 pnpm；依赖在前端步骤锁定。
- `/health/live` 为进程存活，`/health/ready` 为数据库就绪；不套用业务 401。
- 默认监听本机 127.0.0.1:8080；Docker 通过显式环境变量改为 0.0.0.0:8080。
- 默认应用 Origin 为本地 Vite 地址，拒绝携带凭据、路径、query/fragment 的非法 Origin。
- probe 使用 request context 和有限超时；失败返回 SERVICE_NOT_READY 与 request_id，不返回数据库错误正文。
- 敏感配置不打印；优雅关闭有截止时间。

## 验证与剩余风险

unit 为主，健康协议用 httptest，真实 PostgreSQL 再证明 pgx 接线。本阶段不新增 E2E，因为配置与技术端点可在低层验证；前端浏览器接线随 S4 再判断。

S3 完成后运行 Go unit、race、vet、build 与实际 HTTP smoke；保持运行时/依赖错误与业务失败证据分开。Docker 未安装这一事实只影响最终容器验证，不影响本地数据库开发。结果记入 [验证记录](verification.md)。
