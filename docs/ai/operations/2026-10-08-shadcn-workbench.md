# shadcn 工作台与文字排版

日期：2026-10-08（Asia/Shanghai）。用户目标：继续使用原方案的 shadcn/ui，全面美化界面与文字层级。工具：Codex、Node/pnpm、Go、PostgreSQL、Vitest、Playwright；组件接入阶段使用浏览器工具，用户后续明确停止该工具，以自动测试兜底。本文为脱敏操作摘要。

复用 AGENTS 路由的架构、上下文地图、质量、技术栈、开发流程、界面、上下文业务规则和测试策略/矩阵/要求/执行手册。因为共享组件及核心导航/保存呈现变更，按 Large，先保存 [Spec](../../specs/007-shadcn-workbench/spec.md) 与 [Plan](../../specs/007-shadcn-workbench/plan.md)。使用 polished-tool-ui 与 apple-design 的一致性、层级、焦点和减少动效原则；用户不再使用浏览器工具的后续指令优先于技能的视觉复验建议。

网络最初不能访问官方 registry/npm；用户「再试试」后连接恢复，采用官方 new-york-v4 registry 的十个组件源码，保存来源/原始 SHA-256 和 MIT 许可。固定 radix-ui 1.7.0，复用 CVA/clsx/tailwind-merge/Lucide，调整本地路径；没有升级无关直接依赖。

工作台外壳、列表、表单、详情标签、评估、版本/回滚、历史与环境流转统一 primitives 和浅/深主题。新建/编辑改为 Radix Dialog，详情 Tabs 支持键盘与 URL；保持已有 save/revision/冲突/权限契约。后续统一标题、区块、正文、标签和辅助信息尺度，表单字段与说明成组，规则条件/返回值、历史动作/元信息、评估标识/状态分别排版。没有修改领域、应用、HTTP 或数据库业务接口。

有效 Red 是原 UI 缺少新建 Dialog 和实际 Tabs 键盘/URL 契约，2 个失败；接入后 Green。组件回归的 ResizeObserver/原生 dialog cancel 定位失败属于测试基础设施变化，添加无几何行为的 jsdom shim 并使用真实 Escape；React 焦点 ref 读取规范问题修正后静态检查通过。最后增加保存中禁止误关闭、失败保留输入的表征回归，19 个组件全部通过，不为样式写镜像实现测试。

完整 verify:full 已通过，包括前端 34 unit / 18 component / 25 contract、真实 PostgreSQL、Go race 与四条 E2E。最终排版后 check、19 component、build、四条真实 E2E 再次通过；未变业务低层结果复用。53 个前端模块/189 条依赖无违规，golangci-lint 为 0 issues，没有扩大忽略、跳过套件或减少断言。细节和剩余限制见 [验证记录](../../specs/007-shadcn-workbench/verification.md)。

为保留用户当前人工验收数据，E2E fixture/Playwright 支持 E2E_PORT，本次使用 18190；测试服务只清理本次 schema。当前 18090 持续运行，18091 临时前端预览复用其后端与账号。两端健康检查为 200，最后预览产物引用正确；测试库保留一份人工验收 schema，其他 owned integration/E2E 已清理。密码、Cookie、DSN 和临时预览脚本均不提交。

按用户要求，最终排版没有再用浏览器工具人工复验。此前截图记录对应组件接入阶段，最终 E2E 截图未声称被人工查看。Vite 单 bundle 约 511 kB 有大小提示，构建成功，未修改阈值；未量化性能。Docker 仍留到远端 CI 最后验收，实际容器/远端 CI/线上部署未运行。
