# Feature Flag 与灰度规则平台

React + Go + PostgreSQL，前后端 DDD + Clean，大任务 SDD、行为变更 TDD。

## 当前状态

D1～D5 已完成：工程基础、登录/三角色、Flag 管理、属性/百分比规则、精确数字评估、排序、版本/差异/回滚、复制/发布、revision 冲突与原子审计、显式演示初始化。完整门禁和四条 Playwright 的三轮独立稳定性检查已通过。D6 已提供镜像、Compose、健康探针和隔离验收入口，实际容器验收待完成，见 [D6 记录](docs/specs/006-container-delivery/verification.md)。本次不要求线上地址。

需求与规范见 [docs](docs/README.md)，完成证据见 [D1](docs/specs/001-engineering-foundation/verification.md)、[D2](docs/specs/002-core-configuration/verification.md)、[D3](docs/specs/003-percentage-and-versions/verification.md)、[D4](docs/specs/004-ordering-and-environments/verification.md) 和 [D5 验证记录](docs/specs/005-demo-and-system-acceptance/verification.md)。

工作台已统一官方 shadcn/ui 组件、浅/深主题和文字排版，列表/详情/表单/评估/版本/历史采用一致的信息层级。下拉、导航、分页、折叠和提示使用对应组件，规则拖拽由 dnd kit 管理。自动验收与限制见 [完整交互组件记录](docs/specs/008-component-interactions/verification.md)，前次 UI 结果见 [工作台记录](docs/specs/007-shadcn-workbench/verification.md)。

## 本地启动

只使用 Docker 的启动、更新、持久化及备份/恢复见 [容器手册](docs/delivery/docker.md)。宿主无需安装 Go/Node/PostgreSQL；原生开发步骤如下。

先决条件：Node 24.21.0（.node-version）、pnpm 10.33.0、Go 1.27.0、PostgreSQL 17；不需要 Python。通过自己的 Node 版本管理器切换项目版本，不要求修改系统 Node。

```sh
pnpm install --frozen-lockfile
pnpm tools:install
cp .env.example .env
createdb didi_development
createdb didi_test
pnpm migrate
# 在 .env 设置 SEED_ADMIN_PASSWORD、SEED_EDITOR_PASSWORD、SEED_VIEWER_PASSWORD
pnpm seed:demo
pnpm dev
```

已有 .env/数据库时不覆盖或重复创建；按本机 PostgreSQL 认证修改 .env。Node 读取 .env，已有进程环境变量优先；凭据不打印，.env 不提交。`pnpm dev` 同时运行 Go API 与 Vite，并在关闭时终止本次子进程。

浏览器打开 http://localhost:5173；Vite 将 /health 和 /api 代理至 Go API（默认 127.0.0.1:8080，可用 API_PROXY_TARGET 改变）。使用 admin/editor/viewer 与各自配置的初始化密码登录。admin 可写所有环境，editor 可写 development/staging，viewer 只读。`pnpm seed:demo` 初始化账号与五份配置，`pnpm seed:users` 仅初始化账号；重复执行保留已有密码、名称、角色和演示配置修改。服务不自动 seed。首次示例及评估/发布/回滚步骤见 [演示手册](docs/delivery/demo.md)。

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
pnpm test:e2e:stability
pnpm verify:full
# 另需可用 Docker Engine；不操作开发数据库或已有 Compose 项目
pnpm test:docker
```

自定义工程检查和命令编排统一使用 Node。前端 TypeScript/ESLint/Prettier/dependency-cruiser/Knip；后端 gofmt/go vet/golangci-lint 和 Go 包导入检查。详情见 [工具说明](docs/engineering/quality-tooling.md)。Make 同名目标只转发 pnpm，完整命令见 [测试执行手册](docs/testing/TESTING_RUNBOOK.md)。

数据库测试必须显式配置 TEST_DATABASE_URL，库名以 `_test` 结尾且区别于开发库。每个场景创建随机独立 schema、应用迁移、提交真实事务、清理自己创建的 schema；unit/component/contract 不连接数据库，缺失测试库会失败而不是 skip。

## 构建与迁移

```sh
pnpm build
APP_ORIGIN=http://127.0.0.1:8080 pnpm start
```

构建产生 .build/didi-server、.build/didi-migrate、.build/didi-seed 与 .build/didi-healthcheck。服务内嵌 React 资源，页面与 API 同源，APP_ORIGIN 必须与实际浏览器地址完全一致（含端口）；开发默认 localhost:5173，内嵌运行以上述命令覆盖。直接打开 http://127.0.0.1:8080；构建资源被 Git 忽略。独立 Go 开发入口 `pnpm dev:backend` 在未构建前端时仅提供 API，根页面明确提示先构建。

`pnpm migrate` 应用待执行 up；`pnpm migrate:down` 明确回退一个迁移，移除该迁移创建的表及其数据，只用于可丢弃开发环境。服务启动不自动迁移或 seed。迁移与业务配置版本回滚是不同能力。

.env.example 维护数据库、监听地址、APP_ORIGIN、SESSION_TTL、READINESS_TIMEOUT、SHUTDOWN_TIMEOUT 与隔离测试库。SEED_*_PASSWORD 在显式账号/演示初始化时必填（8～72 字节），无通用默认密码。配置 seed 在单一事务创建完整 r1/规则/审计，已有固定 ID 原样保留；其他配置占据演示 Key 时拒绝整批新配置。账号步骤独立提交，配置失败可修复冲突后重跑。范围与状态归 [项目范围](docs/product/scope.md) 和 [交付计划](docs/delivery/roadmap.md)，过程见 [AI 记录](docs/ai/README.md)。

## 数据模型与设计取舍

| 表               | 事实与约束                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| users / sessions | 用户角色和密码哈希、数据库会话；仅存 token/CSRF 哈希，退出撤销，过期拒绝，权限读取当前用户角色 |
| flags            | 一个环境的一份配置；(environment, key) 唯一，稳定 seed 与当前 revision                         |
| rules            | Flag 的有序规则集合；(flag_id, priority) 唯一，属性/百分比形状互斥，聚合维护不变量             |
| flag_versions    | (flag_id, revision) 唯一的完整不可变快照，含名称/Key/启停/默认值/seed/规则/时间/操作者         |
| audit_entries    | 成功动作的真实 Actor、结构化前后内容、来源或恢复版本、request ID；与配置/版本同事务            |

模块化单体把 Flags/Identity/Audit 按上下文再按 Clean 层分开；事务绑定的 Audit 公开契约既保留上下文边界，也保证失败回滚。Go 是评估与最终权限的规则 owner，React 维护编辑输入、服务端状态投影和交互，不复制后端引擎。

评估一次读取当前 revision 对应的完整快照，避免基本信息与规则混用不同版本。同时维护关系表和版本快照增加存储与写入成本，换取数据库唯一约束、精确历史和完整恢复。expected JSON 在快照/审计 codec 保留文本，避免 JSONB 展开大指数或丢失原始数值表示；匹配用精确有理数比较。

行锁与 expected revision 共同防止覆盖并发修改，源 revision 固定防止预览后来源漂移。百分比使用 SHA-256(seed + NUL + user_id) 的前八字节按大端转整数后模 10000，与整数基点比较；同 seed/标识始终同桶。参数化 SQL、Cookie 会话、CSRF/Origin 和后端目标环境授权保护实际写入口。

当前聚焦单团队本地平台，未实现多租户、SDK 分发、实时推送、SSO、自助注册和审批流。稳定性三轮是关键路径重复验收，不是长期容量报告；远端 CI 需实际运行后报告，未统计全仓覆盖率。D6 实际容器验收待完成，在线部署不要求。功能证据见 [验收映射](docs/delivery/coverage.md)。

## 灰度与历史版本

在详情的规则页选择「百分比灰度」，输入 0～100 的比例，最多两位小数。评估属性使用非空字符串 user_id，例如 `{"user_id":"alice"}`；缺少或无效标识会显示轨迹原因。规则按共同优先级执行，首条命中可返回 true 或 false；普通编辑和比例调整保持 seed，扩量保留原命中用户。算法和边界见 [评估语义](docs/contexts/flags/evaluation.md)。

在版本页选择历史 revision，可查看操作者、完整配置和与当前配置的差异。确认回滚后，以所选内容生成一个新 revision，旧版本保留；配置、完整快照和审计同一事务提交。旧预览遇到并发修改会返回冲突，保留所选版本，刷新差异后重新确认。viewer 只读，production 回滚限 admin。API 与快照兼容说明见 [D3 Plan](docs/specs/003-percentage-and-versions/plan.md)。

规则页的「调整规则顺序」支持拖拽、移动按钮的 ↑/↓ 及上移/下移。释放或键盘移动后提交完整序列，成功生成新版本；失败恢复已保存顺序，冲突需刷新后再操作。

详情的「环境流转」选择固定源版本与不同目标环境。复制创建同 Key 新配置，已有配置返回冲突；发布先展示现有目标完整内容/差异，再按预览的目标 revision 提交。源继续编辑不会改变选定版本；发布保留目标身份，目标生成新版本并记录来源。seed 随配置流转，规则生成目标自己的 ID，跨环境差异忽略 ID 和技术时间。目标不存在需先复制，production 复制/发布限 admin。API 见 [D4 Plan](docs/specs/004-ordering-and-environments/plan.md)。
