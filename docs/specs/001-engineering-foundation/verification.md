# 工程基础验证记录

状态：实施中，S1～S3 已通过对应验证；S4～S6 尚未全部完成。当前不是完整平台交付。

## 环境观察

2026-10-08（Asia/Shanghai）：Go 1.27.0、Node 25.2.1、pnpm 10.33.0、PostgreSQL 17.7；pg_isready 显示本地 socket 可用，psql 实际读取服务版本成功。未检测到 Docker CLI。

Node 官方发布 JSON 核实 24.21.0 为 LTS，Vite 元数据为 8.3.3，要求 Node ^20.19.0 或 >=22.12.0；前端依赖尚未安装。pgx 官方模块元数据核实 v5.11.0，后端已固定该版本并生成 go.sum。web 检索接口返回 429 后使用官方站点/官方 registry 获取资料。

## TDD 与实际命令

1. Red：`cd backend && go test ./internal/platform/... -count=1` 实际退出 1。配置测试因未实现解析失败，健康测试因未实现端点返回 404 而失败；没有编译/语法错误。
2. Green：实现纯配置解析与注入 probe 的健康端点；相同命令退出 0，两包均通过。
3. Refactor/完整后端检查：`go test -race ./... -count=1`、`go vet ./...` 和 `go build -o ../.build/didi-server ./cmd/server` 均退出 0。所有 Go 代码经过 gofmt。
4. 实际 PostgreSQL smoke：创建项目专用 didi_development，不修改其他数据库；通过编译后的服务实际请求 live/ready。有效数据库 live/ready 均 200；不存在的数据库 live 200、ready 503，只有稳定错误与对应 request ID。
5. 两次真实服务均通过 SIGTERM 有界退出，退出码 0，测试服务已停止。项目开发库保留供后续迁移使用。
6. 已实现 Make 的 check-docs、test-backend、test-race、vet-backend、build-backend、dev-backend、check-backend；尚未实现的前端/业务验证命令不当作通过证据。

补充细节见 [本次操作记录](../../ai/operations/2026-10-08-foundation.md)。

## 未完成

前端基础、迁移、完整静态架构门禁、Docker 构建运行及全部业务能力待实施。没有新增 E2E，当前风险均可在低层或技术启动 smoke 验证；Docker 不可用时没有声称容器验证通过。
