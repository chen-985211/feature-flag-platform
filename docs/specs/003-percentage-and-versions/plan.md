# D3 实现 Plan

状态：已实施并验证；本文先于业务实现保存。依据 [Spec](spec.md) 与既有用户授权，结果见 [验证记录](verification.md)。

## 模型、端口与持久化

Rule 扩展 Kind 与可空 PercentageBP，聚合验证互斥形状并深拷贝比例指针；旧快照缺省 Kind 归一为 attribute。领域 Evaluation 使用标准库 SHA-256/binary，所有规则共用排序和首条命中策略。领域新增恢复内容和稳定字段差异策略。

Flags application 增加版本查询端口与事务内固定版本加载；回滚进入已有 Execute，锁当前状态、校验环境授权/revision，加载指定版本，经聚合恢复、Advance、Save、Audit 同一事务完成。Change 增加恢复 revision，AuditAdapter 明确写入结构化摘要。数据库 pgx adapter 维护规则 kind/percentage_bp 与兼容 snapshot codec，沿用 D1 schema。属性规则 codec 省略默认 Kind 和空比例，领域大小计算同样省略默认字段，避免旧快照因新增字段开销超过既有 24 KiB 限制。

版本列表只返回 revision/schema/时间/Actor 摘要；内容和差异按需读取。差异读取一份当前快照和不可变源版本，返回当前 revision，修改时必须再次比较。规则期望值/差异 JSON 以原始文本传输，避免 JavaScript 数字舍入。

前端 application 扩展规则种类、版本/差异/回滚远端契约；infrastructure 验证 DTO；presentation 提供百分比输入、版本列表/目标内容/差异/恢复和冲突反馈。详情注入用例，最终算法/权限/恢复内容由后端决定。

## API

| 入口                                         | 契约                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| POST/PUT /api/flags/{id}/rules[/{ruleId}]    | 属性兼容 D2；percentage 使用 kind/percentage_bp/priority/result/expected_revision             |
| GET /api/flags/{id}/versions                 | limit/offset，items/total，revision 降序                                                      |
| GET /api/flags/{id}/versions/{revision}      | 固定版本完整 snapshot 与 Actor/时间/schema                                                    |
| GET /api/flags/{id}/versions/{revision}/diff | source_revision/current_revision、source snapshot、稳定字段 changes（before_json/after_json） |
| POST /api/flags/{id}/rollback                | source_revision/expected_revision；必须有效会话、Origin/CSRF 与目标环境写权限                 |

VERSION_NOT_FOUND=404，其余错误复用 D2；禁止客户端自报 Actor 或恢复 snapshot。评估增加 percentage_rule 来源与 invalid_identifier 轨迹。

## TDD 与金字塔

1. Rule 模型和评估：先运行 0/100/缺失/首条 false、独立固定向量、稳定/扩量行为 Red，纯 Go Green；测试 deep copy/不合法输入。
2. 恢复/差异与用例：聚合恢复所有配置并保留身份，字段差异排除时间；fake 端口覆盖历史选择、冲突/拒绝/审计编排 Red→Green。
3. 持久化与 HTTP：先用真实 PostgreSQL/HTTP 验证百分比、旧快照、版本查询、完整回滚、历史保留、Key 冲突/审计失败/并发/production 权限 Red，接入 adapter 后 Green。
4. 前端：百分比精确转换 unit、HTTP 消费 contract、表单及旧预览冲突保留 component Red→Green；保留 D2 回归。
5. 系统：第二条 Playwright 用独立 Flag 数据，真实灰度配置→修改→选择历史→差异→回滚→评估，确认恢复后的新 revision。不重复底层比例/权限矩阵。
6. 本地 verify:full、截图检查相关主题/窄屏/键盘、资源清理、文档/AI/验收记录与提交。

固定向量使用独立 Node 标准 crypto 实现提前计算并存为常量，不在 Go 测试中复制分桶算法生成期望。无新框架依赖，不改原有快照，兼容性通过实际旧格式数据验证。证据归 [验证记录](verification.md)。
