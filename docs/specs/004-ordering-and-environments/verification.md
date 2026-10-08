# D4 验证记录

状态：D4 已完成、本地验收通过。基线 f6ade54；最终版本为包含本记录的 D4 提交。Spec/Plan 先于业务实现保存，授权来自用户「继续」和既定范围。

## 验收证据

| 验收               | 最低有效证据                                                                                                                   | 结果 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---- |
| D4-01 完整排序     | domain 完整序列/非法序列不部分应用；真实数据库 priority 1～N、规则内容/seed 不变，重新评估按新顺序                             | 通过 |
| D4-02 排序交互     | component 拖拽/键盘共同提交完整序列、冲突恢复与禁止盲目重试；第三条 Playwright 真实鼠标拖拽形成 r4                             | 通过 |
| D4-03 固定复制     | domain 新身份与内容/seed；数据库固定历史 Key/内容、复制冲突与并发唯一约束，HTTP editor→staging 正向                            | 通过 |
| D4-04 发布预览     | 固定源及明确目标/revision、目标不存在先复制；跨环境规则 ID 不制造差异，消费者拒绝 revision/环境/Key 不一致                     | 通过 |
| D4-05 完整发布     | 真实数据库目标身份/创建时间/旧历史保留，源继续编辑不混入；独立目标 seed、名称/启停/默认值/规则均更新并重新评估                 | 通过 |
| D4-06 原子性与来源 | 三种新动作实际审计约束失败后当前内容/版本/审计不变；排序/复制/发布并发各一次成功一次冲突；成功来源摘要                         | 通过 |
| D4-07 权限与请求   | 直接请求 production 排序/复制/发布拒绝 editor/viewer；全部新 mutation 的匿名/CSRF/Origin/viewer 边界；editor 发布 staging 正向 | 通过 |
| D4-08 弹窗状态     | component 固定选择、发布冲突禁重试、只读与 Escape；真实 Tab/Shift+Tab 循环、Escape 关闭和焦点返回，主题/窄屏/滚动区截图        | 通过 |
| D4-09 真实系统     | 第三条 Playwright 排序→复制→源 r5 修改→源 r6 再改名→发布 r5 至 staging r2→百分比 false 命中→来源审计                           | 通过 |

## 有效 Red 与修复

- 领域排序/复制/发布 stub 实际运行后，顺序、配置内容/目标身份及非法目标断言 Red；实施聚合策略后 Green。应用转移与预览 stub 的固定源/授权/统一提交测试 Red 后实施。
- 真实 PostgreSQL 测试发现复制/发布审计缺少 source，实际断言 Red；AuditAdapter 增加明确来源字段后通过，回滚仍只使用 restored_revision。
- 并发实际暴露 FLAG_NOT_FOUND：JOIN 读取当前版本同时锁 flags 的查询在等待写锁后可能失去旧版本匹配。改为同事务先锁 flags/取得确定 revision，再读取不可变版本；原业务与排序/发布并发回归通过。
- 新 HTTP 入口未接线时返回普通 404，目标不存在契约 Red；接线后返回 TARGET_NOT_FOUND，全部新入口的真实权限、CSRF 与目标冲突通过。
- 前端完整序列移动 unit、转移消费 contract、排序/弹窗 stub 的行为 Red 后实施。jsdom 缺少 showModal/close 是测试基础设施限制，补测试环境实现后才记录有效组件 Red；不以 polyfill 证明浏览器焦点。
- 原生拖拽首次 E2E 未触发提交。保留拖动源 DOM 位置、以其他行位移预览排序，并由列表接收空位 drop；测试采用两次鼠标移动触发 dragover，保留完整顺序与新 revision 断言。[Playwright 官方事件说明](https://playwright.dev/docs/input#dragging-manually)支持该输入序列。临时事件诊断已移除，没有增加重试或删掉拖拽验收。
- 真正浏览器 Shift+Tab 首尾验收 Red：原生 dialog 可将焦点移到浏览器界面。补首尾 Tab 循环后，真实键盘、Escape 和焦点返回全部通过。
- 格式、类型断言和 Go ifElseChain lint 的修正不计为业务 Red；已有 seed 更新能力追加真实发布回归，不虚构先失败。

## 最终执行

2026-10-08，项目 Node 24.21.0 / pnpm 10.33.0、Go 1.27.0、PostgreSQL 17.7、Chromium，pnpm verify:full 退出 0。

- 文档、精确依赖/700 行规模、Prettier/gofmt、TypeScript、ESLint、go vet/golangci-lint 全部通过，Go lint 为 0 issues。
- dependency-cruiser 检查 41 个生产模块、119 条依赖，无违反；Go 向内依赖、Knip 通过，无新增忽略项。
- Go internal unit 通过；前端 34 unit / 16 component / 25 消费 contract，共 75 个测试通过。
- PostgreSQL foundation 6、core 12 个顶层集成场景通过；Go 全包 race 包含真实数据库场景并通过。
- React 与内嵌 Go server/migrate/seed 构建通过；Playwright 三条真实系统路径通过，retries=0，原 D2/D3 回归保留。
- 第三条链路真实拖拽排序到 r4，复制为 staging r1；源在 r5 改为首条百分比返回 false、r6 再改名，选择 r5 发布形成 staging r2，目标仍为 r5 名称。评估明确 false/percentage_rule/revision 2，目标审计含源 revision 5 和真实 Actor。
- 实际查看浅色复制、深色发布桌面与 390px 窄屏截图。长弹窗的初版操作栏会覆盖部分内容，改为独立滚动正文、固定标题/确认区后，pnpm check 和 pnpm test:e2e 再次退出 0；布局调整不重复未变化的数据库/race。截图位置覆盖发布差异，按钮持续可见且显示源版本/目标环境。
- 测试专用 schema 最后数量为 0，18090 无监听。报告和截图在忽略目录，凭据/令牌/连接字符串未写入记录。

门禁之后只更新状态、README 和 AI 记录，再检查文档/格式/差异，不重复未变化的业务套件。

## 剩余范围与限制

本阶段无新依赖或迁移，复用完整快照、唯一约束与统一提交。每次复制/发布生成目标规则新 ID，差异忽略跨环境实体 ID；固定 source revision 与提交时的 target ID/revision 分别约束来源和目标。

D5 完整演示与稳定性验收、D6 Docker 尚未实施。当前仓库无远端，远端 CI 未运行；未运行 Docker、线上部署或声称全仓覆盖率。
