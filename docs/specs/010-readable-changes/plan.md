# Plan：历史解释与确认信息

状态：已实施并验证，结果见 [验证记录](verification.md)。本计划在实现之前保存。

1. TDD：先用真实结构的历史 component 检查默认摘要、仅变化内容及保底，规则 component 检查人类可读条件；复制反馈检查实际 Clipboard 成功/拒绝，版本/发布 component 保留精确参数和冲突断言。
2. Audit 的 presentation 投影解码旧 PascalCase/ExpectedJSON，只比较已知业务字段和规则事实；technical-only/未知结构提供保底原始内容。复制/发布按来源元数据说明，回滚按 restored_revision 说明。
3. 公共 presentation 提供纯规则描述、保留词法的 JSON 排版和 Collapsible/Clipboard 控件。Flags 和 Audit 均依赖该无业务写入的展示能力，不跨上下文导入内部实现。
4. Flags 的规则/配置差异和确认弹窗使用可读字段/规则说明；保留现有固定版本和 stale/权限/请求逻辑，技术数据通过折叠入口查看。
5. unit/component/contract 和静态检查、构建、四条独立 E2E；业务后端未变复用既有 integration/race。替换已过时的“变更详情直接是 JSON”交互断言，保留原始审计、源版本和成功后置结果证明。
6. 构建后在原地址重启正常服务、核对最新资源和数据库；更新指南/UI/验证/AI 记录。
