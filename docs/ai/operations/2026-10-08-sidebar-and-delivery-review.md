# 侧栏修复与题面交付核对

日期：2026-10-08（Asia/Shanghai），基线 6369d45。用户提供截图，指出侧栏不如之前，并要求核对剩余任务，随后明确以 question.md 为依据。工具：Codex、Node/pnpm、Vitest、Playwright、Go 构建与本机 PostgreSQL。未使用浏览器工具；本文为脱敏操作摘要。

沿用 AGENTS 路由的开发、架构、上下文、质量、UI 与测试约定，补读原题、范围、交付计划/映射和 D6 验证。按 Small：只修共享导航的控件组合与样式、补文档状态，不改变应用/领域、API、权限、schema 或写入语义。继续使用 polished-tool-ui 和 apple-design 的一致性、层级及空间布局原则，用户不用浏览器工具的要求优先。

根因是 NavigationMenuLink 的 asChild 经 Radix Slot 合并 className，而 NavLink 传入函数形式；Slot 将函数与字符串拼接，使 nav-item/active 未生效，组件默认 flex-col 形成上下排列。改为把静态类及同一个路由选中状态交给 NavigationMenuLink，保留 NavLink 的真实 URL/aria-current；图标继承整行颜色，恢复横向对齐及主色选中态。没有退回手写导航控件。

已有核心 E2E 追加真正的布局、颜色与路由断言：浅色/深色桌面行内对齐、选中与未选中区分、图标颜色一致、900px 图标导航、390px 移动导航。首次新增测试把 Radix 的 data-active 错写为字符串 true，实际为存在的空属性；纠正为属性存在断言，这次不算产品 Red。随后同一实际场景因 computed flex-direction=column 失败，1 failed / 3 existing passed，属于有效 Red；修复后四条 E2E 通过，retries=0。不是 jsdom 几何或 CSS 字符串快照。

题面核对覆盖四项必做、六组扩展、迁移/演示/真实 API/数据库约束、README 和 AI 记录。未发现额外待开发的题面业务能力；发现 README 没有直接说明优先级方向，已补充数字越小越先执行、拒绝重复、首条 false 终止、默认与停用语义。早期 decisions 的待实现标记已链接实际 D2～D5 结果。D6 的当前安排改为用户决定的远端 CI 最后验收，保留原本机磁盘失败历史，没有声称 Docker 已通过。

最终 pnpm check 与 pnpm test:component（24/24）通过；E2E_PORT=18190 pnpm test:e2e 先构建前后端，四条真实 PostgreSQL/Go/Chromium 流程通过。静态检查曾指出 DOMRect.toJSON 的 any 返回值，改为显式读取数字几何字段后重新通过，不扩大类型/lint 忽略。业务低层未改变，复用 6369d45 对应的 unit/contract 和前次 integration/race，不为纯 presentation 修复重跑无关套件。详细本地日志为忽略的 .build/sidebar-{red,check,component,e2e}.log；所有原有业务结果断言保留。

18090/18091 ready 均 200，18091 与最新 frontend/dist 资源一致，人工数据与账号保留；测试库只剩一份人工验收 schema，本次独立 fixture 已清理。自动布局断言不等于人工审美确认。单 bundle 大小提示仍存在，未增加性能完成声明。

剩余交付任务归 [交付计划](../../delivery/roadmap.md#未完成项核对)：F13 的镜像、迁移/启动、容器业务与 E2E、持久化/备份恢复及清理真实验收；仓库当前无远端，远端 CI 与对外提交尚未发生。线上部署不要求，本机 Docker 不在此次请求中继续运行。未提交密码、Cookie、DSN 或临时预览脚本。
