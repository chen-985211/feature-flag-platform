# 验证与执行手册

## 已实现入口

统一使用 Node 24.21.0 / pnpm 10.33.0；安装、配置、数据库准备见 [README](../../README.md)。Make 同名目标只转发下列 pnpm 命令，不直接加载配置或运行另一套检查。

| 目的         | 统一入口                | 实际能力                                                  |
| ------------ | ----------------------- | --------------------------------------------------------- |
| 工具安装     | `pnpm tools:install`    | 固定 golangci-lint 到项目 .tools/bin                      |
| 文档         | `pnpm check:docs`       | Node 链接、锚点、结构、空白与导航可达性                   |
| 静态         | `pnpm check`            | 文档、规模、精确依赖、格式、lint、类型、分层和 unused     |
| 格式修复     | `pnpm format`           | Prettier + gofmt；仅显式修复修改文件                      |
| 基础 unit    | `pnpm test:unit`        | Go internal unit + Vitest unit                            |
| 前端组件     | `pnpm test:component`   | Vitest / Testing Library                                  |
| 契约         | `pnpm test:contract`    | 健康/Flag 消费契约；Go 业务 HTTP 在 integration           |
| 真实边界     | `pnpm test:integration` | 空 schema 迁移、业务事务/并发/会话与 HTTP 权限            |
| 竞争检查     | `pnpm test:race`        | Go 全包 race，包含隔离数据库场景                          |
| 完整低层门禁 | `pnpm verify`           | check + unit + component + contract + integration + build |
| 当前完整门禁 | `pnpm verify:full`      | verify + race + Playwright 核心冒烟                       |
| 构建         | `pnpm build`            | React 资源、内嵌 Go 服务与迁移 CLI                        |
| 迁移         | `pnpm migrate`          | 版本化 up，不隐式 seed                                    |
| 开发         | `pnpm dev`              | Vite + 受管理的 API 子进程                                |

工具配置、检查职责及固定版本见 [质量工具](../engineering/quality-tooling.md)。前端项目区分 unit/component/contract，未实现层不会用 passWithNoTests 冒充成功。D2 已有 seed:users 与 test:e2e；Docker 尚未落地。test:e2e 先构建内嵌资源，再启动独立 Go 测试服务，每次建立/清理随机 schema，使用本次随机密码。固定专用端口 18090，拒绝复用已有服务；Playwright SIGTERM 关闭服务并清理数据。先运行 pnpm --dir frontend exec playwright install chromium。D3/D4 增加回滚/发布关键路径，D5 验证稳定性。

## 开发反馈与最终门禁

TDD 使用单个目标 package/file/case，确认行为 Red 后实现；下载、语法或编译失败不计作有效 Red。局部修改先跑目标层，完成时按 [测试矩阵](TESTING_MATRIX.md) 执行必要范围。

代码/配置改动通常运行 verify；事务、会话、权限、迁移、发布/回滚、测试基础设施与部署改动运行 verify:full。纯视觉做相关静态、构建和浏览器渲染验证；纯文档只做文档与格式检查。已通过结果绑定对应内容，未变化不重复整套；有新改动或未解决风险才重跑。

窄范围示例：`pnpm --dir frontend exec vitest run --project component tests/component/app.test.tsx`、`cd backend && go test ./internal/platform/http -count=1`。直接执行数据库 Go 测试需自行提供 TEST_DATABASE_URL；统一 Node 入口会读取 .env，进程环境变量优先。

## 隔离数据库

integration/race 显式使用 TEST_DATABASE_URL；要求 PostgreSQL URL、库名以 `_test` 结尾、不能与开发库相同。每个测试建立随机 schema，设置专属 search_path，从空 schema 应用迁移；真实事务提交后查询，不以外层回滚事务遮住提交行为。只删除本次创建的 schema，最后关闭本次池和连接。

缺失环境、连接不可用或缺少 schema 权限均失败，不 skip。unit/component/消费 contract 无数据库依赖。服务 smoke 使用本次专用端口并等待健康端点；结束时关闭本次服务，不停止宿主 PostgreSQL。

## CI 与后续发布

.github/workflows/verify.yml 在 push main / pull_request 中使用 PostgreSQL 17.7，执行固定依赖安装、Go 质量工具与 Chromium 安装和 verify:full。远端 CI 必须实际运行才能报告通过；本地结果不代替远端状态。

D1 验证配置、技术 HTTP、React 接线、迁移和构建。D2 验收登录、评估、写入权限和第一条系统冒烟；后续阶段验收发布/回滚与完整演示数据；不建立无目的 nightly。

最终 Docker 发布须验证空库启动、已有库升级和恢复路径，以及业务关键流程。数据库迁移 down 和应用配置回滚分开报告；不能把尚未运行的容器或业务测试记为已通过。
