# D3 百分比灰度与版本 Spec

状态：已完成并本地验收。基线 D2 提交 24aa997；用户「继续」授权执行既定 D3，沿用既有领域语义和工程规范，无核心待决策项。实际证据见 [验证记录](verification.md)。

## 背景与范围

D2 已有完整快照、revision、统一配置/版本/审计提交。本阶段在 Flags 上下文增加 percentage 规则、版本列表/内容/差异和历史回滚；Identity 仍提供目标环境授权，Audit 记录真实操作者及恢复版本。前端只提交编辑副本、展示后端评估/差异，不复制灰度算法。

排序、复制/发布、完整演示配置与 Docker 保持 D4～D6 范围。相关不变量归 [评估](../../contexts/flags/evaluation.md)、[配置](../../contexts/flags/configuration.md) 与 [权限](../../contexts/identity/access-control.md) 维护。

## 验收

- D3-01：percentage 规则与属性规则共享唯一正 priority；比例为 0～10000 整数基点，界面百分比最多两位小数；无效种类/形状/比例不能保存。
- D3-02：使用 seed + NUL + 非空字符串 user_id 的 SHA-256 前八字节大端取模 10000；固定向量、重复、扩量包含关系成立；缺少/非字符串/空标识不命中，并显示轨迹原因。
- D3-03：停用仍 false、0% 永不命中、100% 对有效标识命中；首条 true/false 均终止，属性与灰度按共同优先级求值。普通编辑/改名/比例调整保持 seed。
- D3-04：D2 历史快照可读取；新增快照完整包含规则种类与比例，原始 ExpectedJSON 不被 JSONB 数字规范化损坏。
- D3-05：全部角色可分页查看版本、具体完整配置与差异；差异只比较名称/Key/启停/默认值/seed/完整规则及顺序，不含技术时间噪声。
- D3-06：选定历史内容形成 current_revision+1，恢复名称/Key/启停/默认值/seed/规则与顺序，保留 Flag ID/环境/创建时间及全部历史；审计记录 restored_revision。
- D3-07：回滚校验当前 expected_revision 和 production 权限；无会话/CSRF、越权、不存在版本、Key 冲突、审计失败和并发竞争均不留下部分修改。
- D3-08：详情增加版本标签、完整内容/差异预览和明确回滚动作；预览绑定 current_revision，旧预览不得覆盖，失败保留选择和输入。新增真实 Playwright 灰度→修改→历史回滚→重新评估路径。

## 边界与状态 owner

百分比规则只包含比例、priority、result，不接受属性字段；属性规则不接受比例。无效 user_id 的轨迹为 missing（未提供）或 invalid_identifier（非字符串/空），命中后为 skipped。0% 对有效标识为 miss。比例输入使用十进制字符串转换为整数基点，不依赖浮点舍入。

版本是不可变配置，预览返回明确 source_revision/current_revision；回滚重新校验，不信任客户端提交恢复内容。当前版本可查看，界面只对历史版本开放恢复动作。全部现有大小/分页/安全整数限制沿用 D2，数据库 schema 已支持 percentage，无新增迁移。

## 风险与完成条件

必须证明旧快照兼容、完整恢复和真实事务失败后状态。领域分支/权限/冲突下沉，E2E 仅证明系统接线；完整门禁与实际浏览器渲染通过后记录验收，不虚构远端 CI 或 Docker 结果。
