# 正式数据库与持久化演示

日期：2026-10-08（Asia/Shanghai）。AI 工具：Codex。用户要求对照 question.md 使用正式数据；此前已讨论正常服务、开发库、初始化与重启验证方案，本次授权执行。

## 分析与决定

- 按 Large 保存 [Spec](../../specs/009-persistent-demo/spec.md) 和 [Plan](../../specs/009-persistent-demo/plan.md)，复用开发、配置生命周期、技术栈、质量、测试和交付规则。领域规则、API/schema 与分层不变。
- 调查发现人工页面是 Node 预览代理到 Go E2E fixture；该 fixture 使用真实 PostgreSQL，但退出会删除自己的 schema。普通开发库已迁移，业务数据为空。因此问题是人工运行入口与生命周期，而不是此前没有实现数据库持久化。
- 复用既有 SQL 迁移和 Go seed；新增 Node 的 demo 编排，迁移 → 幂等初始化 → 构建 → 正常服务。没有新增 Python、依赖、手工业务历史或领域逻辑。
- 正式账号为 admin/editor/viewer；初始化凭据只保存在忽略的本机环境文件。保留旧用户作为历史操作者，旧会话不迁移，切换后重新登录。

## 数据与服务切换

先将临时 schema 和目标 public 备份到权限受限的忽略目录，暂停旧写入；恢复到目标库的本次 staging schema。目标业务表为空的前提下，用一笔事务复制 users/flags/rules/flag_versions/audit_entries，五表逐列双向 EXCEPT 为零才提交，再移除本次 staging。原始密码哈希、ID、seed、revision、时间、Actor 和历史均保留；不复制 sessions。

随后正常 seed 补齐正式三角色，已有五份配置原样保留。空闲端口先验证正常服务器，再将人工地址 18091 切到 cmd/server；旧预览和 fixture 退出，仅清理旧 fixture 拥有的测试 schema。原始备份未删除，不打印/提交其内容。

正常 admin 经 Go API 创建一份持久化验收配置，新增属性/百分比规则、停用/启用并编辑，形成 r1～r6。数据库有 6 份配置、7 条规则、11 个版本和 11 条审计；额外旧用户来自保留历史，正式账号仍是三角色。新记录的全部 Actor、版本和审计由真实接口产生。

## 验证与边界

真实 API 与 SQL 断言当前配置、两条规则、六个完整版本、六条历史和 admin Actor 一致；CN 返回 true/attribute_rule，空属性返回 false/default。重跑 seed 后五张持久化表指纹不变；正常服务真实停止并重新通过 demo 启动，再验证配置、全部版本/历史和评估结果，指纹仍不变。

demo 对测试库/缺失密码实际返回稳定错误码，退出 1；未执行迁移，五表前后无变化。该任务以真实运行配置错误作为基线，编排通过真实命令验证，没有故意破坏现有业务制造 Red，也没有声称新增领域 TDD。

完整回归与最终结果以 [验证记录](../../specs/009-persistent-demo/verification.md) 为准。未使用浏览器工具，既有 Playwright 自动化兜底；Docker/远端 CI 仍按用户决定最后验收。没有线上部署或远端推送，日志移除密码、Cookie、令牌与连接字符串。
