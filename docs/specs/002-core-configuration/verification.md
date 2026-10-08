# D2 验证记录

状态：D2 已完成、本地验收通过。基线提交 2a3f8dd；最终版本为包含本记录的 D2 提交。Spec/Plan 先于业务实现保存，执行授权复用用户「继续」及已确认范围。

## 验收证据

| 验收               | 最低有效证据                                                                                                         | 结果 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | ---- |
| D2-01 身份与初始化 | 真实 HTTP 登录/退出、过期、Secure/HttpOnly/SameSite/TTL；真实数据库 seed 重复运行不重置                              | 通过 |
| D2-02 权限         | Go 角色×环境 unit；viewer/editor 直接请求 production 六类写入；当前角色改变后原会话立即受限                          | 通过 |
| D2-03 请求边界     | 缺少/伪造 CSRF、错误 Origin、缺少会话、自报 actor 拒绝；Actor 来源为会话关联用户                                     | 通过 |
| D2-04 配置与查询   | 创建、规则增删改、Key 重命名、唯一冲突、字面量搜索、空页 total、持久化与历史旧 Key                                   | 通过 |
| D2-05 匹配         | equals/in 严格类型、同类型数组、缺少/null/对象/数组、首条 false、优先级与快照副本；大整数/指数精确比较               | 通过 |
| D2-06 评估         | 当前版本单次 JOIN，disabled/default/attribute_rule 与有序 trace；错误属性和只读请求不新增版本/审计                   | 通过 |
| D2-07 原子性       | 审计约束失败注入后配置/版本/历史均未变化；屏障同步的两次相同 revision 写入只有一次成功；重复 Key/priority 无部分写入 | 通过 |
| D2-08 界面与系统   | component 验证失败保留输入、冲突入口、只读与会话切换；Playwright 真实登录→创建→规则→刷新→评估→历史→退出              | 通过 |

## 有效 Red 与修复

- 领域 stub 运行后权限允许项、匹配结果/轨迹、首条 false、非法输入和重复 priority 断言失败，实施后转绿。
- 应用 stub 不提交数据、不传播拒绝/冲突/审计错误；fake 端口行为测试 Red 后实现统一提交。
- PostgreSQL adapter stub 创建无数据导致业务验收失败，接入真实事务后转绿；HTTP bootstrap stub 返回 404，登录/权限契约 Red 后接线。
- 前端 expected 校验 stub、HTTP 消费 stub、表单 stub 分别因有效输入被拒、缺少权威响应、缺少输入控件而失败，实施后转绿。
- 会话 component 发现登录成功仍停留在登录页：清空所有 Query 会切断会话观察；保留会话查询、只清除业务缓存后回归通过。
- 第一条 E2E 因 textarea 包裹式 label 含初始文本导致精确标签定位失败；改为明确 htmlFor/id 后通过。
- JSONB 实际存储将 1e1000 展开，快照再次读取触发输入长度错误；数据库回归 Red 后，版本与审计 codec 保存 ExpectedJSON 文本，精确读取/求值转绿。
- 路径、类型和键盘输入字面量转义等测试基础设施失败不计为行为 Red。已有行为的追加测试作为表征与回归，不虚构先失败证据。

## 最终执行

2026-10-08 使用项目 Node 24.21.0 / pnpm 10.33.0、Go 1.27.0、PostgreSQL 17.7、Chromium，执行 pnpm verify:full，退出码 0。

- 文档、精确依赖/规模、Prettier/gofmt、TypeScript、ESLint、go vet/golangci-lint 全部通过。
- dependency-cruiser：33 个生产模块、88 条依赖，无违反；Go imports 向内检查通过。无 imports 的合法领域包修正空依赖解析后可通过；Knip 无新增忽略项。
- Go internal unit 通过；前端 unit 11、component 9、HTTP 消费 contract 15 个测试通过。
- PostgreSQL foundation 6、core 5 个顶层集成场景通过，包含真实 HTTP 和并发/失败回滚。
- Go 全包 race 通过，包含数据库集成。
- React 资源和 Go server/migrate/seed 构建通过。
- Playwright 1 条系统冒烟通过，retries=0；真实内嵌资源、Go API、隔离随机 schema，包含 390px 深色移动导航和横向溢出检查。
- 实际查看浅色桌面与深色窄屏截图；动画结束后按钮颜色正确、长规则 ID 换行、操作可用。产物在忽略的 test-results 中，不是截图基线。
- 结束后测试 schema 数量为 0，18090 无监听；宿主 PostgreSQL 保持运行，开发数据库未注入测试数据。

门禁通过后只更新完成状态和记录，再执行文档/格式检查，不重复未变化的行为套件。

## 未运行与剩余范围

远端 CI 未运行：当前仓库无远端，已配置固定依赖与 Chromium 安装及 verify:full，不能把本地通过称为远端通过。未统计或声称全仓覆盖率。

D3/D4 的百分比、版本浏览/差异/回滚、排序和复制/发布，以及 D5 完整演示配置、D6 Docker 仍未实现；后续按用户指令随能力增加关键 E2E。D2 交付 seed:users；首次本地登录需在 .env 配置初始化密码并显式执行，不提供通用密码或自动重置。
