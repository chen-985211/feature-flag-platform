# 项目文档路由

本文仅作为协作 AI 的阅读入口。完整目录见 [文档中心](docs/README.md)，业务、架构、开发、测试和交付规则由下列文档分别维护。

## 路由方式

- 根据目标路径与实际动作读取对应文档；多项命中时读取并集。
- 只读取相关章节；普通链接不自动要求递归阅读。
- 同一连续任务中，内容未变化的已读文档可以复用；新增范围时补充路由。
- 只读查询按问题路由；修改任务先读取开发流程中的任务分级与执行要求。

## 目标路径路由

| 目标路径或主题                                     | 阅读入口                                                                                                                                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 需求、功能范围、验收与原题差异                     | [项目范围](docs/product/scope.md)                                                                                                                                                                                                   |
| `frontend/src/**`、`backend/internal/**`           | [架构](docs/engineering/architecture.md)、[上下文地图](docs/engineering/context-map.md)、[工程质量](docs/engineering/quality.md)、[测试策略](docs/testing/TESTING_STRATEGY.md)                                                      |
| `**/contexts/flags/**`                             | [评估规则](docs/contexts/flags/evaluation.md)、[配置生命周期](docs/contexts/flags/configuration.md)                                                                                                                                 |
| `**/contexts/identity/**`、鉴权与会话              | [登录与权限](docs/contexts/identity/access-control.md)                                                                                                                                                                              |
| `**/contexts/audit/**`、操作历史                   | [审计历史](docs/contexts/audit/history.md)                                                                                                                                                                                          |
| `**/presentation/**`、`.tsx`、`.css`               | [界面约定](docs/product/ui.md)；行为变化另读测试矩阵                                                                                                                                                                                |
| `**/platform/**`、跨上下文装配                     | [架构](docs/engineering/architecture.md)、[上下文地图](docs/engineering/context-map.md)                                                                                                                                             |
| 依赖、构建、配置、`package.json`、`go.mod`、锁文件 | [技术栈](docs/engineering/tech-stack.md)、[工程质量](docs/engineering/quality.md)                                                                                                                                                   |
| `backend/migrations/**`、数据库与事务              | [配置生命周期](docs/contexts/flags/configuration.md)、[测试矩阵](docs/testing/TESTING_MATRIX.md)、[交付要求](docs/delivery/acceptance.md)                                                                                           |
| 测试文件、测试工具、CI 门禁                        | [测试策略](docs/testing/TESTING_STRATEGY.md)、[测试矩阵](docs/testing/TESTING_MATRIX.md)、[测试布局](docs/testing/TESTING_LAYOUT.md)、[测试要求](docs/testing/TESTING_REQUIREMENTS.md)、[执行手册](docs/testing/TESTING_RUNBOOK.md) |
| 日志、错误、诊断与敏感信息                         | [日志与错误](docs/engineering/logging.md)、[登录与权限](docs/contexts/identity/access-control.md)                                                                                                                                   |
| 新增、移动、删除文档                               | [文档中心](docs/README.md)及本次改变的规则归属文档                                                                                                                                                                                  |

## 动作叠加路由

| 实际动作                                          | 追加阅读                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 修改文件或项目状态、任务分级、SDD 与 TDD          | [开发流程](docs/engineering/development.md)                                                                                    |
| 新能力、API/schema 变化、核心重构、并发与权限变化 | [开发流程的大任务流程](docs/engineering/development.md#大任务流程)、相关上下文文档、[Spec 与 Plan 归档](docs/specs/README.md)  |
| 局部 UI 调整、文案、格式或文档修改                | [开发流程的小任务流程](docs/engineering/development.md#小任务流程)、[界面约定](docs/product/ui.md)或对应文档                   |
| 新增行为、修复缺陷、改变用例或边界                | [测试矩阵](docs/testing/TESTING_MATRIX.md)、[测试要求](docs/testing/TESTING_REQUIREMENTS.md)                                   |
| 修改分层、端口、规则归属或跨上下文调用            | [架构](docs/engineering/architecture.md)、[上下文地图](docs/engineering/context-map.md)                                        |
| 发布、部署、迁移、交付或完成度汇报                | [交付要求](docs/delivery/acceptance.md)、[交付计划](docs/delivery/roadmap.md)、[测试执行手册](docs/testing/TESTING_RUNBOOK.md) |
