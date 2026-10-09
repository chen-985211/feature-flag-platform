# AI 辅助开发记录

原题要求将 AI 对话、操作日志或其他相关信息随项目提交。本项目采用需求决策摘要 + 分任务操作/验证记录，可补充脱敏会话导出；不把摘要伪装成完整逐字对话。

## 布局

- [decisions.md](decisions.md)：范围、方案和工程约定的来源与确认状态。
- `docs/specs/<任务>/`：Large 的 Spec、Plan 与真实验证记录。
- `docs/ai/operations/`：按日期/任务保存简明过程记录，当前见 [工程基础](operations/2026-10-08-foundation.md)、[D1 收尾](operations/2026-10-08-d1-completion.md)、[D2 核心业务](operations/2026-10-08-d2-core.md)、[D3 灰度与版本](operations/2026-10-08-d3-versions.md)、[D4 排序与环境流转](operations/2026-10-08-d4-environments.md)、[D5 演示与验收](operations/2026-10-08-d5-acceptance.md)、[D6 容器交付](operations/2026-10-08-d6-containers.md)、[shadcn 工作台](operations/2026-10-08-shadcn-workbench.md) 和 [完整交互组件](operations/2026-10-08-component-interactions.md)。
- 最近的 Small 修复与题面核对见 [侧栏修复与交付核对](operations/2026-10-08-sidebar-and-delivery-review.md)。
- 人工验收从临时测试环境切到正常 Go/开发库的过程见 [持久化演示](operations/2026-10-08-persistent-demo.md)。
- 面向其他验收者的逐步操作文档见 [验收指南整理](operations/2026-10-08-manual-acceptance.md)。
- 历史、规则和确认说明的可读性优化见 [可读变更](operations/2026-10-09-readable-changes.md)。
- 项目许可证与公开仓库准备见 [开源发布](operations/2026-10-09-open-source.md)。

## 记录字段

日期/任务、用户目标、所用 AI 工具、文档路由和任务分级、主要分析与决定、修改摘要、有效 Red/Green/Refactor 证据、实际执行命令和结果、未完成内容与风险。

日期按用户时区记录；来源是会话时明确标记摘要，来源是脚本时保留真实结果。不能编造投入时长、模型信息、测试运行、覆盖率或部署记录。

## 脱敏

移除密码、令牌、Cookie、连接字符串、部署密钥和私人账号信息。必要错误可以保留稳定码和 request ID，不保存任意完整评估属性。原始详细输出如含敏感内容只保留脱敏摘要。

本目录提供可追溯辅助开发证据，不替代源码、测试、Spec 或验收结果。
