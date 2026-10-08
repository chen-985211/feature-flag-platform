# Plan：正常初始化、数据保留与服务切换

状态：已实施并验证，结果见 [验证记录](verification.md)。先保存 Spec/Plan，再实施。用户已要求按 question.md 使用正式数据，授权复用本次和前次确认。

1. 核对 DATABASE_URL/public 与 TEST_DATABASE_URL/owned schema；当前正式库为空、当前页面连接 E2E 服务作为真实环境问题证据。无新领域规则，不故意破坏业务实现制造 Red。
2. scripts/tasks.mjs 的 demo 编排复用 migrate → seed-demo → build → start；只在编排层提前拒绝 `_test`/同测试库及非法密码。package.json/Makefile/README 提供入口，不新增 SQL 或依赖。构建编排用真实正常/负向命令验证，不写镜像脚本逻辑的单元测试。
3. 本机凭据只写忽略 .env，生成/复用本次本地密码。备份源 owned schema 和目标 public，暂时暂停旧 fixture 防止切换窗口写入。用 pg_dump 恢复到目标库内本次独立 staging schema，单事务插入已有 users/flags/rules/flag_versions/audit_entries；循环外键用现有 deferrable 约束，双向 EXCEPT 验证五表完整一致再提交。删除仅本次 staging；保留源备份，旧 sessions 不导入。该一次性操作脚本留在忽略目录，不成为通用产品导入能力。
4. 用正常 seed 补齐三个正式账号，保留已有五份配置。先在空闲端口启动 cmd/server，验证真实 API/数据库；确认后停止旧预览与 fixture，18091 改为正常同源服务。故障时恢复旧 fixture，不在备份/导入验证前停止它。
5. 用正式 admin 经 API 生成一个可见的持久化演示配置：创建、属性/灰度规则、停用/启用、基本编辑；核对规则、版本、历史、Actor 与评估后置条件。退出正常服务并重启，确认完整数据与结果不变。
6. 完整原生 verify:full 使用独立 18190 fixture，保持正式库不变；真实 demo 前置失败与 seed 重跑验证。完成 docs/AI 记录、初始化/验收指南和本地提交。

测试金字塔沿用现有 unit/component/contract/真实 PostgreSQL integration/race；正常部署的数据库与生命周期不能由 mock 或 fixture 重启替代，因此额外执行有限的真实 API/SQL smoke。不使用浏览器工具，既有 Playwright 自动测试继续兜底。18091 为当前人工验收实例；项目默认启动仍由环境配置管理，密码/DSN不出现在代码或提交。
