# 验证与执行手册

## 当前状态

当前仓库没有 Makefile、package.json、go.mod、测试 runner、数据库迁移或 CI。下面为统一命令接口的设计合同，全部 **TODO：待工程搭建后实现**，目前不可执行，不可据此宣称验证通过。

工程搭建任务必须落实命令与 scripts，并将本表状态改为已实现。命令调整同时更新此处与实际入口，禁止文档与脚本长期不一致。

## 规划命令

| 目的             | 统一入口（待实现）          | 将调用的能力                                             |
| ---------------- | --------------------------- | -------------------------------------------------------- |
| 文档检查         | `make check-docs`           | 内部链接、Markdown 格式、规则入口完整性                  |
| 静态检查         | `make check`                | 文档、格式、lint、TypeScript、Go vet、依赖方向与规模     |
| 基础 unit        | `make test-unit`            | Go internal unit + Vitest unit                           |
| 前端组件         | `make test-component`       | Vitest/Testing Library component                         |
| 真实边界         | `make test-integration`     | Go/PostgreSQL 与前端适配器 integration                   |
| 契约             | `make test-contract`        | HTTP/DTO/错误及前端消费契约                              |
| 关键路径         | `make test-e2e`             | Playwright + 真实 Go API + 隔离 PostgreSQL               |
| 竞争检查         | `make test-race`            | 受影响 Go 包的 race 检查与并发测试                       |
| 日常完整低层门禁 | `make verify`               | 静态 + unit + component + integration + contract + build |
| 发布/跨流程门禁  | `make verify-full`          | verify + race + 全部已定义关键 E2E + 迁移验证            |
| 可部署构建       | `make build`                | 前端构建、Go 内嵌静态资源及应用构建                      |
| 数据库迁移       | `make migrate`              | 版本化 SQL up；不隐式 seed                               |
| 演示数据         | `make seed`                 | 显式幂等 seed，使用指定环境配置                          |
| 本机开发         | `make dev`                  | API 与 Vite，使用本机 PostgreSQL                         |
| 容器运行         | `docker compose up --build` | 应用、PostgreSQL 与明确迁移入口                          |

规划底层入口包括 `pnpm --dir frontend` 的 lint/typecheck/test/build scripts、Go unit 的 `go test ./internal/... -count=1`、integration 的 `go test ./tests/integration/... -count=1`。精确参数和 runner 分组应在对应配置创建后确认，不能直接套用参考项目的命令。

## 开发反馈与最终门禁

TDD 使用单个目标 package/file/case，确认 Red 后再实现。局部修改先跑目标层；完成时按 [测试矩阵](TESTING_MATRIX.md) 和要求执行必要范围。

代码或配置改动通常运行 verify；跨流程、事务/会话/权限、迁移、发布/回滚、测试基础设施及部署变更运行 verify-full。纯视觉可以用 component/静态/build 加真实渲染验证，不强迫无关 E2E；纯文档只做文档检查。

已通过结果绑定对应工作区内容和验证范围；相关内容未变化时复用，不因进入提交阶段重复跑。出现新改动、失败或未解决风险才扩大或重跑。

## 数据库与依赖

integration/contract/E2E 显式配置隔离的 TEST_DATABASE_URL 并从空库应用迁移，普通 unit 不要求数据库。需要真实数据库的验收若未提供环境，应报告未运行，不能静默 skip 后标记完成。

测试数据库不能复用开发或线上数据，清理前验证目标。服务使用独立配置和动态/专用端口，等待健康状态而非固定 sleep；结束时关闭本次进程并清理本次测试资源。

## CI 与发布

PR/main：静态、unit、component、contract、真实 PostgreSQL integration 和 build 必须执行；改变关键系统接线时执行对应 E2E。发布候选执行 verify-full 和部署 smoke。

本项目不要求为了形式建立 nightly；后续若需要性能、稳定性或广泛浏览器检查，以实际成本和风险新增。

发布验证至少包含空库启动、已有库升级、必要回滚/恢复路径、登录、评估、一次配置修改及权限检查。这里的应用配置回滚与数据库迁移回滚是不同能力；若 migration 不支持 down，必须写明恢复方案并验证备份恢复，而非宣称支持。

## 规范阶段的文档检查

应用命令未实现前，可用一次性本地检查验证 AGENTS/docs 的相对文件链接与标题锚点、空占位、Markdown 空行/代码围栏以及空白差异。记录实际检查方式，不创建虚假的已实现 make 命令。
