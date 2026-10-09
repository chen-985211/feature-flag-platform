# 功能验收证据映射

编号定义归 [验收要求](acceptance.md)，阶段状态归 [交付计划](roadmap.md)。本表关联自动化证据，原生系统结果见 [D5 验证记录](../specs/005-demo-and-system-acceptance/verification.md)，完整远端与容器结果见 [D6 验证记录](../specs/006-container-delivery/verification.md)。核心分支在底层，四条 E2E 证明代表系统接线。

| 编号 | 主要低层与真实边界证据                                                                                  | 系统路径 / 阶段证据                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01  | 聚合校验、真实 Key/priority 唯一、筛选/空页、规则增删改、历史 Key                                       | 核心配置 E2E；[D2](../specs/002-core-configuration/verification.md)                                                                                                         |
| F02  | equals/in 类型矩阵、精确数字、首条 false/default/disabled；HTTP JSON 错误                               | 核心评估 E2E；[D2](../specs/002-core-configuration/verification.md)                                                                                                         |
| F03  | 消费 contract/组件反馈、HTTP 结果来源/revision/trace 和错误                                             | 核心及 viewer 演示 E2E；[D2](../specs/002-core-configuration/verification.md) / [D5](../specs/005-demo-and-system-acceptance/verification.md)                               |
| F04  | 实际审计失败注入、全部动作快照/来源/真实 Actor/时间；初始化后段失败整批回滚                             | 核心/回滚/发布/只读历史；[D2](../specs/002-core-configuration/verification.md)～[D5](../specs/005-demo-and-system-acceptance/verification.md)                               |
| F05  | 固定向量、0/100%、阈值、扩量包含、缺失/非法 user_id、混合优先级                                         | 百分比回滚 E2E；[D3](../specs/003-percentage-and-versions/verification.md)                                                                                                  |
| F06  | 旧快照兼容、完整恢复/身份保留、旧历史保留、关系表与快照一致、失败不部分写                               | 回滚 E2E；[D3](../specs/003-percentage-and-versions/verification.md)                                                                                                        |
| F07  | 普通修改/回滚/排序/发布并发各一次成功一次冲突；组件保留输入、阻止盲目重试                               | 固定目标 revision 接线；[D2](../specs/002-core-configuration/verification.md)～[D4](../specs/004-ordering-and-environments/verification.md)                                 |
| F08  | 完整序列/非法序列 unit、键盘/按钮/失败恢复组件、数据库 priority/内容/seed                               | 真实鼠标排序/键盘取消 E2E；[D4](../specs/004-ordering-and-environments/verification.md) / [组件替换](../specs/008-component-interactions/verification.md)                   |
| F09  | 新身份/规则 ID/内容/seed、固定历史源、同 Key 冲突、并发唯一和来源                                       | 复制→发布 E2E；[D4](../specs/004-ordering-and-environments/verification.md)                                                                                                 |
| F10  | 固定源/目标预览 contract、目标身份/Key/revision、原子性、权限/并发/失败                                 | 源后续修改后仍发布固定 r5；[D4](../specs/004-ordering-and-environments/verification.md)                                                                                     |
| F11  | 角色×环境 unit；真实登录/退出/过期/角色变更、Cookie/CSRF/Origin；production 各写入口拒绝、seed 保留账号 | admin 创建、viewer 演示/退出、editor production 只读；[D2](../specs/002-core-configuration/verification.md) / [D5](../specs/005-demo-and-system-acceptance/verification.md) |
| F12  | unit/component/contract、实际数据库 integration、静态/类型/分层/unused、race                            | 四条 Playwright，独立三轮稳定性；[D5](../specs/005-demo-and-system-acceptance/verification.md)                                                                              |
| F13  | 固定工具链镜像、空库迁移/健康、真实容器业务/冲突/权限、持久化、迁移失败门禁及独立备份恢复               | [D6](../specs/006-container-delivery/verification.md)：远端 verify:full 与 test:docker 通过；原生和容器各四条 Playwright，镜像标识及资源清理已核对                          |

Go 领域/应用测试在 backend/internal/contexts；真实 HTTP/并发/失败在 backend/tests/integration/core，实际 seed 二进制在 backend/tests/integration/demo；前端各层和四条 E2E 在 frontend/tests。命令见 [测试手册](../testing/TESTING_RUNBOOK.md)，演示步骤见 [本地演示](demo.md)。

F01/F04/F11 的正常人工运行接线与真实数据额外见 [持久化演示](../specs/009-persistent-demo/verification.md)：普通开发库保存配置、规则、完整版本和真实 Actor 历史；正式三角色可登录，重跑初始化/重启服务保留数据。该原生实例证据不替代 F13 的容器验收。

映射是覆盖责任说明，不代表全仓覆盖率统计、长期容量或线上部署证据。各阶段历史记录对应当时提交；D6 的完整原生回归与实际容器证据均已通过，平台为 linux/amd64。
