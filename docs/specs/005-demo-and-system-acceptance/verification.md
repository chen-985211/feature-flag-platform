# D5 验证记录

状态：D5 已完成、本地验收通过。基线 3ab4f9d；最终版本为包含本记录的 D5 提交。Spec/Plan 先于业务实现保存，授权复用既定范围和用户「继续」。

## 验收结果

| 验收              | 证据                                                                                                                                                         | 结果 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| D5-01 完整初始化  | 应用示例/真实 PostgreSQL 创建五份配置及规则/初始版本；CLI 实际 seed 二进制创建三账号、五配置、五规则、五版本与五审计，核对真实 Actor/配置快照                | 通过 |
| D5-02 保留修改    | 应用保持修改后的名称/Key/seed/revision/规则；数据库改名/改 Key/删规则并让另一配置占据旧 Key，重跑不覆盖/不追加历史；CLI 更换初始化密码仍保留原密码/名称/角色 | 通过 |
| D5-03 原子性/权限 | 屏障并发两次均成功，合计五次创建/五次保留；第五份 Key 冲突或第四份审计约束失败均整体回滚；editor 用例拒绝、实际 admin 角色降级后 CLI 返回 SEED_FORBIDDEN     | 通过 |
| D5-04 只读接线    | 第四条真实 Playwright：viewer 登录→读取示例/完整 r1/真实创建历史→首条 false 评估→退出/刷新；editor development 可写、production 禁用写控件                   | 通过 |
| D5-05 回归/稳定性 | verify:full 退出 0；四条 E2E 另独立三轮，各 4/4，retries=0                                                                                                   | 通过 |
| D5-06 交付文档    | README 初始化/数据模型/语义/取舍与限制；演示手册、F01～F13 映射；测试 schema 清理为 0、18090 无监听                                                          | 通过 |

## Red / Green / Refactor

- 应用初始化 stub 实际返回零创建，完整配置/历史与示例断言 Red；实施固定数据、domain.Restore、授权及单事务创建/审计后 Green。重复运行和修改保留经 unit 验证，百分比示例用独立 Node crypto 值补表征回归。
- SQL Create stub 返回保留，真实数据库首次创建、并发合计数量、Key 冲突和后段审计拒绝均 Red。主键 ON CONFLICT DO NOTHING 只让实际创建事务保存规则/版本；复用 saveContents 后 Green。普通 mutation 原有 Save 经全套数据库/race 回归保护。
- CLI demo 参数原先被忽略，实际二进制仅初始化账号，created=5 断言 Red；增加明确 users/demo 模式、真实 Actor 装配和稳定诊断后通过。已有账号字段保留、当前角色降级、非法参数/密码均验证。
- viewer 尚未接线时新 E2E 不能进入配置列表，实际 Red；测试服务初始化三角色与演示后通过。后续两处测试定位失败分别因历史姓名与时间在同一段落、登录后恢复评估 URL；根据实际 DOM 修正名称定位并显式进入配置列表，不计作产品行为缺陷或新的业务 Red。
- 三轮编排/报告分离属于工程工具，使用真实三轮运行验证，不编造业务 Red。截图改用 testInfo.outputPath，与每轮 results/report 目录对应，避免互相覆盖；未增加 retries、sleep、门禁忽略或依赖。

## 最终执行

2026-10-08，项目 Node 24.21.0 / pnpm 10.33.0、Go 1.27.0、PostgreSQL 17.7、Chromium。

- pnpm verify:full 退出 0：文档、依赖/规模、Prettier/gofmt、TypeScript、ESLint、go vet/golangci-lint（0 issues）、向内依赖和 Knip 全部通过；前端 41 个生产模块、119 条依赖无违规。
- Go internal unit 通过；前端 34 unit / 16 component / 25 contract，共 75 个通过。新增行为集中在后端应用/数据库，无重复前端引擎。
- PostgreSQL foundation 6、core 14、demo CLI 1 个顶层场景通过；core 中并发、Key 竞争、审计失败和权限另有子场景。Go 全包 race 通过，包括实际数据库；实际 seed 子进程验证属于 integration，子进程二进制为普通构建，未将其称为 race 插桩运行。
- React 与内嵌 Go server/migrate/seed 构建通过；完整门禁四条真实系统路径全部通过，retries=0。
- pnpm test:e2e:stability 退出 0：三轮分别 4/4，合计 12 次；每轮独立服务、随机 schema/密码。报告在 test-results/stability/run-{1,2,3}/report，截图/运行结果在各轮 results。不是失败重试，不将轮次计为 12 条不同 E2E。
- 实际查看第三轮 production 只读截图：editor 身份/环境/r1、只读提示、停用/添加/排序禁用与运行评估入口清晰；既有三条流程继续保留主题/390px、原生拖拽、焦点循环与差异截图验收。
- 最后测试 schema 数量为 0，18090 无监听；宿主 PostgreSQL 保持运行。未覆盖已有 .env，未向开发库写入演示/测试数据，密码/令牌/连接字符串不写入记录。

完整门禁后只补完成状态、README、演示/映射及 AI 记录，再检查文档/格式/差异，不重复未变化的业务套件。

## 剩余范围

F01～F12 有同版本回归证据，F13 Docker 在 D6 待实施。无新迁移/依赖/公开 API。当前仓库无远端，远端 CI 未运行；不声称长期容量、全仓覆盖率或线上部署。
