# 测试目录、命名与数据

生产目录由 [架构](../engineering/architecture.md) 维护。本项目测试按类型与上下文组织，Go 单元测试采用语言惯例就近放置，不照搬参考项目的 TypeScript 全集中布局。

## 规划布局

```text
backend/
  internal/contexts/flags/domain/evaluation_test.go
  internal/contexts/flags/application/create_flag_test.go
  internal/contexts/identity/domain/access_policy_test.go
  tests/
    integration/{flags,identity,audit}/
    contract/{flags,identity,audit}/
    fixtures/
    support/
frontend/
  tests/
    unit/contexts/{flags,identity,audit}/
    component/contexts/{flags,identity,audit}/
    component/presentation/
    integration/
    contract/
    fixtures/
    support/
frontend/tests/e2e/
  core.e2e.spec.ts
  auth.e2e.spec.ts
  flag-evaluation.e2e.spec.ts
  publish-rollback.e2e.spec.ts
  readonly.e2e.spec.ts
tests/container/
  smoke.mjs
  support.mjs
test-results/
```

这些文件名表示计划的行为分组，不代表已存在测试。小功能无需创建没有测试职责的空目录。

容器验收实际入口为 tests/container/smoke.mjs；Node 维护部署资源和 HTTP 后置状态，复用 frontend/tests/e2e 的四条现有流程。它是部署 smoke，不替代领域、数据库 integration 或普通 unit。Docker 路径使用随机 Compose project/数据库卷/端口/密码，结束只删除本次资源。

## Runner 与命名

- Go unit：`*_test.go`，测试函数说明业务行为，表用例名称表达场景。
- 前端 unit/component：`*.test.ts(x)`；integration/contract 可使用明确类型后缀，并通过 Vitest projects 分离执行环境。
- E2E：`*.e2e.spec.ts`，frontend/playwright.config.ts 仅收集 `frontend/tests/e2e/`，不能混入普通 unit suite。
- unit 使用 Node 环境，React component 使用 jsdom；真实布局使用浏览器，jsdom 不能证明 CSS 几何。
- 后端 integration/contract 使用独立目录，普通 unit 运行不启动数据库。

## 测试支持与数据隔离

factory 默认生成有效最小对象，边界变化显式覆盖。静态 fixtures 用于 JSON 契约、快照兼容或稳定哈希向量；不包含真实账户和生产属性。

测试 support 只被测试导入，production 不导入测试工厂。复用 helper 不隐藏关键行为断言，错误、权限和事务结果使用显式 oracle。

数据库只从 `TEST_DATABASE_URL` 读取，必须验证与应用数据库不同，并使用明确测试库/独立 schema；拒绝生产连接。并行用例独立数据，清理不能删除共享或线上资源。

前端 E2E 独立用户和 Flag 数据，不依赖执行顺序或上一用例留下的配置。独立数据库测试真实 commit/rollback；不能让每个用例外包事务遮蔽被测提交边界。

时钟、ID 和随机源用确定性 fake；真实会话/网络边界由 integration 验证。并发用同步屏障或受控协作，不使用睡眠猜测时序。

## 产物

报告、覆盖率、Playwright trace、临时截图与服务日志放入忽略目录。只有规范化契约 fixtures 和必要稳定快照入库；截图基线须说明长期风险，不能自动把一次样式检查产物提交。
