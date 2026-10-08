# 正式数据库演示验证

状态：完成，全部原生验收通过。基线 30fc42e，Spec/Plan 在执行前保存；结果绑定包含本记录的本地提交。2026-10-08（Asia/Shanghai），Node 24.21.0 / pnpm 10.33.0、Go 1.27.0、PostgreSQL 17.7。未使用浏览器工具，保留用户以自动测试兜底的要求。

## 验收结果

| ID    | 实际证据                                                                                                            | 结果 |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ---- |
| PD-01 | 18091 为 cmd/server；ready 200；HTML 与最后构建一致；Go API 从 didi_development/public 读取配置                     | 通过 |
| PD-02 | 源/目标完整 SQL dump 可读、权限 600；五表逐列双向 EXCEPT 为零后单事务提交；原始 Actor/ID/seed/revision/时间保留     | 通过 |
| PD-03 | admin/editor/viewer 均通过正常登录；重复 seed created=0 preserved=5；五张持久化表的完整内容指纹不变                 | 通过 |
| PD-04 | admin 经 API 创建、两次加规则、停用/启用、编辑；r1～r6、六条审计、关系表与完整快照一致，所有新 Actor 均为真实 admin | 通过 |
| PD-05 | 正常服务 PID 80252 优雅停止；demo 重启后 PID 81136；五表指纹、配置/规则/全部版本/历史与评估一致                     | 通过 |
| PD-06 | demo 对测试库/缺失密码退出 1，未执行迁移，五表无变化；正常 demo 初始化/启动/重启成功；完整原生门禁各步骤最终通过    | 通过 |

## 数据与运行状态

原人工页面是 Node 预览 → Go E2E fixture，数据在测试库的 owned schema。开发库 public 已迁移，但六张业务表为空。切换前暂停旧写入，备份源 schema 与目标 public，再将源恢复到目标库的本次 staging schema。

单事务复制 users、flags、rules、flag_versions、audit_entries，逐列双向 EXCEPT 验证后提交；目标原有业务表必须为空，循环外键使用既有 deferrable 约束。只有本次 staging 被删除。旧 sessions 不搬迁，因此浏览器切换后重新登录。导入时各表分别为 3/5/5/5/5；既有五份示例及其原始操作者/历史原样保留，没有改写过去的 Actor。

正常 seed 新增 admin/editor/viewer，已有配置输出 created=0 preserved=5。先在 18192 验证正常服务器，再将 18091 切到正常 Go 同源服务，旧预览与 E2E fixture 退出。旧 fixture 清理自己的源测试 schema，正式数据已独立保存；18192 验证实例也停止。最终仅保留正常 18091；18190 自动测试服务退出。正式数据库和测试库的临时 owned schema 均为 0。

正常 admin 使用 CSRF/Origin/Cookie，经真实 API 创建 development/acceptance-persistence（「演示：持久化验收」）。依次创建 r1、属性规则 r2、25% 灰度 r3、停用 r4、启用 r5、基本编辑 r6；未直接 SQL 插入业务/版本/历史。当前表数量：

| 表            | 数量 | 说明                                  |
| ------------- | ---- | ------------------------------------- |
| users         | 6    | 保留的三个旧 Actor + 三个正式角色账号 |
| flags         | 6    | 原五份配置 + 一份真实 API 验收配置    |
| rules         | 7    | 原五条 + 新属性/灰度两条              |
| flag_versions | 11   | 原五个 + 新 r1～r6                    |
| audit_entries | 11   | 原五条 + 新六次真实操作               |

真实 SQL 核对基本信息、当前 r6、两条规则的完整字段、六个版本及逐 revision 的审计/Actor；API 读取每个完整版本并将 r6 与当前详情对比。CN 返回 true/attribute_rule 并命中优先级 1；空属性返回 false/default；r4 停用时返回 false/disabled。

重跑 seed 前后，users/flags/rules/flag_versions/audit_entries 的完整行指纹相同；真实停止/重启后再次比较相同，API 全部版本、历史与评估不变。完整回归结束后再次验证同样结果，证明隔离测试没有修改正式数据。密码/Cookie/CSRF 不保存到证明文件或报告。

## 命令与自动化结果

- pnpm migrate、pnpm seed:demo 实际成功；HTTP_ADDR/APP_ORIGIN 同时设为本次 18091 后 pnpm demo 完成迁移 → 初始化 → 构建 → 正常启动，重复运行保留所有数据。项目默认端口仍由配置决定。
- demo 负向命令：DATABASE_URL 指向 TEST_DATABASE_URL 返回 DEMO_DATABASE_REJECTED；SEED_VIEWER_PASSWORD 为空返回 DEMO_PASSWORD_REQUIRED。均退出 1、未运行 Go/迁移，SQL 五表前后指纹一致。
- E2E_PORT=18190 pnpm verify:full 首次运行：check、Go/前端 unit、component、contract、真实 PostgreSQL integration、build 通过；race 在链接 core/foundation 测试二进制时因磁盘空间不足中断。该条聚合命令退出 1，不能记为成功。
- 清理可重新生成的 Go 构建缓存后，pnpm check 退出 0（70 Markdown、文档链接/格式/规模/精确依赖、TypeScript、ESLint、go vet/golangci-lint 0 issues、分层和 Knip）；pnpm test:race 退出 0，包含全部真实数据库 integration 包。
- E2E_PORT=18190 pnpm test:e2e 退出 0，真实构建后四条 Playwright 全部通过（11.1 秒、retries=0）：核心配置、排序/复制/固定源发布、viewer/editor 权限、百分比与回滚。unit 34/34、component 24/24、contract 25/25 复用本次聚合命令已通过的结果；相关业务与测试源码未变化。
- 最终 API/SQL 复验通过；ready 200，18091 前端 HTML 与 frontend/dist/index.html 完全一致；测试库/开发库临时 schema 均清理。文档收尾后另行执行文档与格式检查。

本地详细日志位于忽略的 .build/formal-{transfer,acceptance,seed-proof,restart-proof,final-proof,guards,verify-full,check-final,race-retry,e2e}.log。源/目标 SQL、权限受限的 manifest 和一次性切换/检查脚本只保存在忽略的 .build；备份内容含认证哈希，不打印或提交。

## 边界

正式数据指普通 PostgreSQL 中可编辑、持久化的演示业务记录，不将初始化场景称为真实公司的线上数据。新 checkout 标准 seed 仍是五份配置，额外验收配置由本次真实接口操作产生。迁移/seed/领域规则/API/schema 未改变；新增 Node 编排用实际命令验证，没有编造领域 Red/TDD 或 mock 数据库重启证据。

按用户要求，Docker/远端 CI 最后验收，本次没有执行或将其标为通过。Vite 仍提示 630.18 kB 单包超过 500 kB，构建成功，未调整阈值；未做线上部署或远端推送。后续启动与验收按 [README](../../../README.md) 和 [演示手册](../../delivery/demo.md) 复现。
