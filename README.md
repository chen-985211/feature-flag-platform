# Feature Flag 与灰度规则平台

React + Go + PostgreSQL，前后端 DDD + Clean，大任务 SDD、行为变更 TDD。

## 当前状态

D1～D4 已完成：工程基础、登录/三角色、Flag 管理、属性/百分比规则、精确数字评估、规则排序、版本浏览/差异/回滚、跨环境复制/发布、revision 冲突保护与原子审计。三条 Playwright 已覆盖核心配置、回滚及固定源版本发布链路。完整演示和系统稳定性在 D5、Docker 在 D6 验收。本次不要求线上地址。

需求与规范见 [docs](docs/README.md)，完成证据见 [D1](docs/specs/001-engineering-foundation/verification.md)、[D2](docs/specs/002-core-configuration/verification.md)、[D3](docs/specs/003-percentage-and-versions/verification.md) 和 [D4 验证记录](docs/specs/004-ordering-and-environments/verification.md)。

## 本地启动

先决条件：Node 24.21.0（.node-version）、pnpm 10.33.0、Go 1.27.0、PostgreSQL 17；不需要 Python。通过自己的 Node 版本管理器切换项目版本，不要求修改系统 Node。

```sh
pnpm install --frozen-lockfile
pnpm tools:install
cp .env.example .env
createdb didi_development
createdb didi_test
pnpm migrate
# 在 .env 设置 SEED_ADMIN_PASSWORD、SEED_EDITOR_PASSWORD、SEED_VIEWER_PASSWORD
pnpm seed:users
pnpm dev
```

已有 .env/数据库时不覆盖或重复创建；按本机 PostgreSQL 认证修改 .env。Node 读取 .env，已有进程环境变量优先；凭据不打印，.env 不提交。`pnpm dev` 同时运行 Go API 与 Vite，并在关闭时终止本次子进程。

浏览器打开 http://localhost:5173；Vite 将 /health 和 /api 代理至 Go API（默认 127.0.0.1:8080，可用 API_PROXY_TARGET 改变）。使用 admin/editor/viewer 与各自配置的初始化密码登录。admin 可写所有环境，editor 可写 development/staging，viewer 只读。初始化显式执行，重复运行保留已有密码、名称与角色；服务不自动创建账号。

```sh
curl http://127.0.0.1:8080/health/live
curl http://127.0.0.1:8080/health/ready
```

live 表示进程存活；ready 实际查询 PostgreSQL，超时/失败返回 503、稳定错误码和 request ID。配置校验与服务错误不输出数据库凭据。

## 检查与测试

```sh
pnpm check
pnpm test:unit
pnpm test:component
pnpm test:contract
pnpm test:integration
pnpm --dir frontend exec playwright install chromium
pnpm test:e2e
pnpm verify:full
```

自定义工程检查和命令编排统一使用 Node。前端 TypeScript/ESLint/Prettier/dependency-cruiser/Knip；后端 gofmt/go vet/golangci-lint 和 Go 包导入检查。详情见 [工具说明](docs/engineering/quality-tooling.md)。Make 同名目标只转发 pnpm，完整命令见 [测试执行手册](docs/testing/TESTING_RUNBOOK.md)。

数据库测试必须显式配置 TEST_DATABASE_URL，库名以 `_test` 结尾且区别于开发库。每个场景创建随机独立 schema、应用迁移、提交真实事务、清理自己创建的 schema；unit/component/contract 不连接数据库，缺失测试库会失败而不是 skip。

## 构建与迁移

```sh
pnpm build
APP_ORIGIN=http://127.0.0.1:8080 pnpm start
```

构建产生 .build/didi-server、.build/didi-migrate 与 .build/didi-seed。服务内嵌 React 资源，页面与 API 同源，APP_ORIGIN 必须与实际浏览器地址完全一致（含端口）；开发默认 localhost:5173，内嵌运行以上述命令覆盖。直接打开 http://127.0.0.1:8080；构建资源被 Git 忽略。独立 Go 开发入口 `pnpm dev:backend` 在未构建前端时仅提供 API，根页面明确提示先构建。

`pnpm migrate` 应用待执行 up；`pnpm migrate:down` 明确回退一个迁移，移除该迁移创建的表及其数据，只用于可丢弃开发环境。服务启动不自动迁移或 seed。迁移与业务配置版本回滚是不同能力。

.env.example 维护数据库、监听地址、APP_ORIGIN、SESSION_TTL、READINESS_TIMEOUT、SHUTDOWN_TIMEOUT 与隔离测试库。SEED_*_PASSWORD 只在显式账号初始化时必填（8～72 字节），无通用默认密码。完整演示 Flag 在 D5 交付。范围与状态分别归 [项目范围](docs/product/scope.md) 和 [交付计划](docs/delivery/roadmap.md)；过程见 [AI 记录](docs/ai/README.md)。

## 灰度与历史版本

在详情的规则页选择「百分比灰度」，输入 0～100 的比例，最多两位小数。评估属性使用非空字符串 user_id，例如 `{"user_id":"alice"}`；缺少或无效标识会显示轨迹原因。规则按共同优先级执行，首条命中可返回 true 或 false；普通编辑和比例调整保持 seed，扩量保留原命中用户。算法和边界见 [评估语义](docs/contexts/flags/evaluation.md)。

在版本页选择历史 revision，可查看操作者、完整配置和与当前配置的差异。确认回滚后，以所选内容生成一个新 revision，旧版本保留；配置、完整快照和审计同一事务提交。旧预览遇到并发修改会返回冲突，保留所选版本，刷新差异后重新确认。viewer 只读，production 回滚限 admin。API 与快照兼容说明见 [D3 Plan](docs/specs/003-percentage-and-versions/plan.md)。

规则页的「调整规则顺序」支持拖拽、移动按钮的 ↑/↓ 及上移/下移。释放或键盘移动后提交完整序列，成功生成新版本；失败恢复已保存顺序，冲突需刷新后再操作。

详情的「环境流转」选择固定源版本与不同目标环境。复制创建同 Key 新配置，已有配置返回冲突；发布先展示现有目标完整内容/差异，再按预览的目标 revision 提交。源继续编辑不会改变选定版本；发布保留目标身份，目标生成新版本并记录来源。seed 随配置流转，规则生成目标自己的 ID，跨环境差异忽略 ID 和技术时间。目标不存在需先复制，production 复制/发布限 admin。API 见 [D4 Plan](docs/specs/004-ordering-and-environments/plan.md)。
