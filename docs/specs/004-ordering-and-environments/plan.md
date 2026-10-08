# D4 实现 Plan

状态：已实施并验证；本文先于业务实现保存。依据 [Spec](spec.md) 和既定用户授权，证据见 [验证记录](verification.md)。

## 领域与用例

domain 增加 Reorder（完整序列校验后一次替换 priority）、CopyConfiguration 与 Publish（验证不同环境/同 Key、重建目标规则身份、保留目标身份）；发布差异复用稳定字段策略，比较规则时忽略实体 ID，输出仍保留可展示的配置与原始期望文本。

application 的 Execute 增加 rules_reordered/flag_copied/flag_published，与现有写动作共享事务、权限、版本与审计。复制在事务内读取固定源版本并构造新目标；发布先锁目标/校验 expected_revision，再读固定源并执行领域动作。已有 Scope.Version、Store.ByKey 足够，无技术事务泄露或跨上下文内部调用。Change 增加明确来源结构，回滚字段仅用于回滚。

PublicationPreview 读取固定源版本和目标当前完整快照，返回双方内容、目标 ID/revision、配置差异。发布保留明确 target_id，提交时重新验证身份/Key/环境/版本。关系表删除/插入完整规则的现有策略保留唯一约束，真实事务验证后复用；不新增迁移。

## API

| 入口                                                      | 契约                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| POST /api/flags/{id}/rules/order                          | rule_ids、expected_revision，返回新目标 snapshot                                           |
| POST /api/flags/{sourceId}/copy                           | source_revision、target_environment，返回 201 新 Flag                                      |
| GET /api/flags/{sourceId}/versions/{revision}/publication | target_environment，返回 source/target snapshots、source_revision/target_revision、changes |
| POST /api/flags/{sourceId}/publish                        | source_revision、target_id、expected_revision，返回新目标 snapshot                         |

目标不存在使用 TARGET_NOT_FOUND=404，提示先复制；其他错误复用现有稳定码。所有 mutation 走会话/Origin/CSRF 中间件，不接受 Actor 或快照字段。

## 前端

application 扩展排序/复制/发布/预览 DTO 与远端端口；HTTP adapter 校验双方内容与 revision。规则页加入独立排序区，原生拖拽、键盘和按钮统一提交，失败恢复 props 权威顺序并保留反馈。详情加入环境流转入口，注入目标可写环境。

使用原生 dialog 管理模态焦点/键盘；源版本分页选择、目标环境、复制与发布分别明确动作。版本内容及差异组件复用 D3 表现，发布冲突保留选择、必须刷新预览并重新确认。保存后刷新列表/目标缓存和审计，不把来源缓存误写为目标。

## TDD 与门禁

1. Go domain 完整序列、内容/seed/身份、同环境/Key 与稳定差异 unit Red→Green。
2. Execute 排序/复制/发布、目标授权、固定源及来源审计 fake 端口 Red→Green。
3. 真实 PostgreSQL 排序/复制/发布、历史源、目标修改、唯一冲突、审计失败后置状态、并发竞争；HTTP 新入口及三角色/production 矩阵 Red→Green。
4. 前端排序编辑纯规则 unit，HTTP 消费 contract，排序输入/失败恢复和弹窗固定选择/冲突/只读 component Red→Green。
5. 第三条 Playwright 固定源版本跨环境发布，评估新目标版本并确认来源审计；真实截图检查主题/窄屏/焦点，原 D2/D3 回归保留。
6. pnpm verify:full、资源清理、文档状态/AI/验收记录、差异检查与提交。证据归 [验证记录](verification.md)。
