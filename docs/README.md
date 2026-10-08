# 项目文档中心

本项目是 React、Go 与 PostgreSQL 实现的 Feature Flag 与灰度规则平台。规范已提交，[工程基础](specs/001-engineering-foundation/verification.md)、[D2 核心业务](specs/002-core-configuration/verification.md)、[D3 灰度与版本](specs/003-percentage-and-versions/verification.md)、[D4 排序与环境流转](specs/004-ordering-and-environments/verification.md) 和 [D5 演示与系统验收](specs/005-demo-and-system-acceptance/verification.md) 已完成并验证。[D6 容器交付](specs/006-container-delivery/verification.md) 已实现配置与工具，实际容器验收待完成；在线部署不属于必交付项。

Docker 首次启动、更新、持久化与独立数据库备份恢复见 [容器手册](delivery/docker.md)。

仓库级 AI 入口为 [AGENTS.md](../AGENTS.md)。本页只维护文档目录、归属和状态，不重复业务及工程规则。

当前可执行启动和检查入口见 [项目 README](../README.md)。

工作台共享组件、布局与文字排版已统一到官方 shadcn/ui；下拉、导航、分页、折叠、提示和拖拽也已完成组件化，实际自动验收与限制见 [完整交互组件记录](specs/008-component-interactions/verification.md)。前次 UI 检查范围见 [工作台记录](specs/007-shadcn-workbench/verification.md)。

前后端已落地的质量检测工具、固定版本与 CI 入口见 [质量工具](engineering/quality-tooling.md)。

## 文档地图

| 目录                 | 职责                               | 文档                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `product/`           | 交付范围、产品与界面约定           | [范围](product/scope.md)、[界面](product/ui.md)                                                                                                                                                                                      |
| `engineering/`       | 全仓架构、技术栈、开发与质量规范   | [技术栈](engineering/tech-stack.md)、[架构](engineering/architecture.md)、[上下文地图](engineering/context-map.md)、[开发流程](engineering/development.md)、[工程质量](engineering/quality.md)、[日志与错误](engineering/logging.md) |
| `contexts/flags/`    | Flag、规则、灰度、版本、复制与发布 | [评估](contexts/flags/evaluation.md)、[配置生命周期](contexts/flags/configuration.md)                                                                                                                                                |
| `contexts/identity/` | 登录、会话、角色与授权             | [登录与权限](contexts/identity/access-control.md)                                                                                                                                                                                    |
| `contexts/audit/`    | 真实操作者与操作历史               | [审计历史](contexts/audit/history.md)                                                                                                                                                                                                |
| `testing/`           | 金字塔、测试选择、组织和执行       | [策略](testing/TESTING_STRATEGY.md)、[矩阵](testing/TESTING_MATRIX.md)、[布局](testing/TESTING_LAYOUT.md)、[要求](testing/TESTING_REQUIREMENTS.md)、[执行手册](testing/TESTING_RUNBOOK.md)                                           |
| `delivery/`          | 分阶段产出与最终交付验收           | [交付计划](delivery/roadmap.md)、[验收要求](delivery/acceptance.md)、[本地演示](delivery/demo.md)、[证据映射](delivery/coverage.md)                                                                                                  |
| `specs/`             | 大任务的需求、实现计划与验证证据   | [归档约定](specs/README.md)                                                                                                                                                                                                          |
| `templates/`         | Spec、Plan 的可复用模板            | [Spec](templates/spec.md)、[Plan](templates/plan.md)                                                                                                                                                                                 |
| `ai/`                | AI 辅助开发记录与需求决策          | [记录约定](ai/README.md)、[需求决策](ai/decisions.md)                                                                                                                                                                                |

## 阅读路径

- 理解项目：范围 → 技术栈 → 架构 → 上下文地图 → 交付计划。
- 开始修改：从 AGENTS 路由到开发流程、目标所属上下文及最低有效测试层。
- 处理大任务：开发流程 → 相关业务规则 → Spec → Plan → TDD → 验证记录。
- 准备交付：验收要求 → 测试执行手册 → 已完成的 Spec/Plan 与验证证据。

## 归属与状态

每类规则只由一份归属文档定义，其他文档通过链接引用。架构文档拥有依赖规则；开发流程拥有任务分级与 SDD；测试目录拥有 TDD 和验证细节；上下文文档拥有业务语义；交付目录拥有完成标准。

用户明确指令和已确认决策优先。发现文档间冲突时，先查对应归属文档并在当前任务内消除冲突，不能依赖读取顺序决定规则。

[question.md](../question.md) 保留原题及先前范围补充；原题最低要求继续有效，本次扩展范围与细化规则由本目录维护。参考项目只提供方法，不构成本仓库运行依赖。

文档区分“已确定的设计”“待实现的能力”和“已验证的事实”。规范中的目录和命令若尚未落地，必须明确标记，不能据此宣称功能已经完成。
