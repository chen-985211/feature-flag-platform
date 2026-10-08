# DDD + Clean Architecture

## 范式与规模

前后端统一采用 DDD 与 Clean Architecture 的混合架构。DDD 定义统一语言、限界上下文、聚合和规则归属；Clean 定义职责、端口和依赖方向。后端以模块化单体运行，前端以单个 React 应用运行。

目录先按限界上下文组织，再按 Clean 层级组织。数据库、React、HTTP 和容器是技术细节，不是新的业务上下文。不为形式完整创建没有业务意义的聚合、领域事件、抽象基类或空层。

## 依赖规则

```text
presentation ──→ application ──→ domain
infrastructure ──→ application ──→ domain
platform ──→ 装配以上各层
```

- domain 只依赖语言标准能力，不依赖 React、HTTP、pgx、SQL、TanStack Query、路由或平台配置。
- application 依赖自己的 domain、DTO 和端口，不导入具体适配器或框架。
- infrastructure 实现 application 定义的端口；入站适配器只进入应用层用例。
- presentation 通过注入的应用层用例工作，不直接实例化或导入 infrastructure。
- platform 是 composition root，负责配置解析、依赖装配、服务器启动与资源关闭，不拥有业务规则。
- 禁止循环依赖与跨上下文读取内部聚合、仓储或基础设施。边界出口为公开应用契约，返回 DTO/读模型而非可变聚合。

仓储、时钟、标识生成、哈希、授权、事务与审计接口放在调用方 application/ports。领域层接收所需对象和值，不查询数据库或读取系统时间。

## 后端职责

| 层             | 职责                                          | 示例                                           |
| -------------- | --------------------------------------------- | ---------------------------------------------- |
| domain         | 聚合、值对象、策略、不变量、领域错误          | `Flag`、`Rule`、`Priority`、`EvaluationPolicy` |
| application    | 命令/查询用例、事务边界、授权编排、端口与 DTO | 创建 Flag、评估、排序、发布、回滚              |
| infrastructure | HTTP 入站、SQL 仓储、会话存储、密码哈希       | handler、pgx repository、密码与会话适配器      |
| platform       | HTTP 中间件、配置、装配、生命周期             | 注册路由、创建连接池、优雅关闭                 |

HTTP 入站适配器归 infrastructure；后台不为凑齐层级创建空 presentation 包。HTTP DTO 与领域对象分开，SQL 扫描结构不泄露到用例层。

业务修改只进入聚合根，用例协调授权、加载、领域动作和事务提交。数据库约束提供最后防线，不能成为唯一业务解释来源。

## 前端职责

| 层             | 职责                                    | 约束                                 |
| -------------- | --------------------------------------- | ------------------------------------ |
| domain         | 客户端值对象、编辑模型及纯状态约束      | 无 React、网络、缓存与 DOM           |
| application    | 查询/命令用例、远端能力端口、DTO        | 无 React hooks、QueryClient 或 fetch |
| infrastructure | HTTP client、API DTO 映射与错误转换     | 不渲染组件，不决定匹配或授权结果     |
| presentation   | 页面、组件、表单、hooks、交互与查询缓存 | hooks 调用注入用例，组件不直接 fetch |
| platform       | 路由装配、providers、依赖注入           | 只接线，不实现领域行为               |

前端 DDD 不意味着复制后端评估引擎。匹配、灰度分桶、最终权限、版本冲突与发布行为以 Go 后端为权威；前端只做输入反馈、编辑模型和结果呈现。前端权限提示可以消费后端能力 DTO，但不能替代服务端授权。

TanStack Query 是 presentation 的服务端状态投影；表单、选中项、弹窗和拖拽预览是临时 UI 状态。保存成功后刷新权威快照，失败时保留编辑输入，不把缓存当作已提交业务事实。

## 规划目录

以下为目标结构。D1 已实现 backend/cmd/{server,migrate}、platform/{config,http,web}、migrations，以及前端 platform 技术健康用例/适配器、composition root 和 presentation 外壳。D2 已落地 Identity/Flags/Audit 核心上下文及 public 协作；D3 在既有 Flags 分层中扩展灰度、版本查询与回滚，D4 实现排序和环境流转。

```text
backend/
  cmd/server/
  cmd/seed/
  internal/
    contexts/
      flags/{domain,application,infrastructure}/
      identity/{domain,application,infrastructure}/
      audit/{domain,application,infrastructure}/
    platform/{bootstrap,http,config,logging,persistence}/
    shared-kernel/
  migrations/
  tests/{integration,contract,fixtures,support}/
frontend/
  src/
    contexts/
      flags/{domain,application,infrastructure,presentation}/
      identity/{domain,application,infrastructure,presentation}/
      audit/{domain,application,infrastructure,presentation}/
    platform/{composition-root,providers}/
    presentation/{app-shell,routes,components,theme}/
    shared-kernel/
  tests/{unit,component,integration,contract,fixtures,support}/
tests/
  e2e/
docs/
```

花括号为目录组简写。application 下按需要使用 `use-cases/`、`ports/` 与 `dto/`；domain 按规模划分实体、值对象和策略。目录只有实际职责时才创建，不生成全套空模板。

Go 单元测试遵循包旁 `_test.go` 约定；其余测试布局见 [测试布局](../testing/TESTING_LAYOUT.md)。

## 上下文与聚合

Flags 拥有 Flag 聚合、规则集合、配置版本及评估。Identity 拥有用户、会话和角色策略。Audit 拥有追加式操作记录与历史查询。具体协作由 [上下文地图](context-map.md) 维护。

一个 Flag 聚合对应一个环境的配置，规则必须经聚合修改。不同环境的同名 Key 是不同聚合；复制和发布是 Flags 内的跨聚合用例，不新增“发布微服务”。

跨上下文只通过调用方应用端口与提供方公开用例协作，适配器在 infrastructure，装配在 platform。技术事务使用 application 定义的抽象作用域，不把 `pgx.Tx` 传入领域或表现层。

## 事务与评估一致性

配置变更、版本快照、审计记录在一个 PostgreSQL 事务中提交。跨上下文的同步审计必须绑定同一事务，由基础设施装配传递事务能力；不能提交配置后异步补写历史。

Flag 的当前配置版本是单一提交点。评估通过一次查询取得当前版本的完整不可变快照，再由纯领域策略求值，防止基础字段与规则来自不同版本。关系表与快照同事务维护，快照不在前端拼装。

发布读取明确的源版本，再检查目标当前版本。排序、启停、规则编辑、回滚和发布共用同一变更提交策略，不分别维护类似但不同的版本和历史逻辑。

## 高内聚、共享与边界检查

聚合维护自身不变量，用例表达一个完整业务动作，端口抽象一种外部能力，适配器处理一种边界，组件负责一种交互职责。不得在一个模块中混写 UI、SQL、用例和领域判断。

共享内核只容纳稳定、明确且至少两个上下文确实共同需要的语义。重复几行代码不足以创建通用业务工具；禁止以 `utils`、`helpers` 或 `common` 作为业务规则收容区。

实施阶段应添加前端 import 边界与后端包依赖检查：阻止内层依赖外层、表现层导入具体 HTTP adapter，以及跨上下文内部导入。D1 已实现这些检查，命令和工具归 [质量工具](quality-tooling.md) 维护；未执行的门禁不能写成通过。
