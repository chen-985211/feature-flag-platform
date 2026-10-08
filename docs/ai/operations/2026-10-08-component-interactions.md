# 完整交互组件收敛

日期：2026-10-08（Asia/Shanghai）。用户目标：根据截图去掉左下角重复管理员、改善页头与下拉，并「全面替换手写的交互控件」。工具：Codex、Node/pnpm、Go、PostgreSQL、Vitest、Playwright；遵守用户要求，未使用浏览器工具。本文为脱敏操作摘要。

复用 AGENTS 路由的架构、上下文地图、质量、技术栈、开发流程、界面、上下文业务规则和测试文档。跨表单/导航的键盘、portal 与焦点交互按 Large；在实施前保存 [Spec](../../specs/008-component-interactions/spec.md)、[Plan](../../specs/008-component-interactions/plan.md)，复用用户执行授权。采用 polished-tool-ui 与 apple-design 的一致性、排版、焦点和减少动效原则，用户不用浏览器工具的要求优先于人工复验建议。

下载官方 new-york-v4 的 Select、Card、Alert、Collapsible、Tooltip、Pagination、NavigationMenu，记录原始 hash 与许可，复用固定 radix-ui；删除 NativeSelect，只保留实际使用的导出。所有环境/筛选/规则/版本/流转下拉切换受控 Dropdown；导航、分页、审计展开、图标提示、内容和反馈统一对应组件。删除侧栏身份，列表/评估/概览改共享两层 PageHeader。不改变业务 owner、API、权限或 schema。

全面排查发现规则排序仍自行处理原生 drag 与位移，先补充 Spec/Plan，再核实官方 Sortable 文档与 npm peer，固定 dnd kit 三个依赖。库管理传感器、测量和碰撞，现有完整顺序/expected revision/失败恢复/冲突契约保留。原零几何 fireEvent drag 测试改为按钮表征，物理拖拽 oracle 放进已有发布 E2E；同时验证键盘取消零请求、指针保存唯一 exact 请求及权威 revision。

有效 Red 为身份重复、缺少实际 Select listbox，2 failed / 4 existing passed；接入后 Green。追加三个控件回归，最终 component 24/24。jsdom 缺少 DOM API 的失败按基础设施处理，只补无几何 shim；Tooltip 对弹窗关闭按钮消耗 Escape 的问题通过显式提示策略修正。真实 E2E 的键盘取消最初失败，排查 KeyboardSensor 延迟注册监听；使用实际 20ms 按下/释放间隔与真实状态等待，保留取消和完整请求断言。最终去掉临时诊断后四条 E2E 通过，未增加 retries 或跳过。

pnpm check、Go/前端 unit（前端 34）、component（24）、contract（25）、构建及四条真实 E2E 均通过。67 前端模块/257 依赖无违规，golangci-lint 0 issues。未变化的 PostgreSQL integration/Go race 复用前次完整门禁。完整证据、组件清单与验收编号见 [验证记录](../../specs/008-component-interactions/verification.md)。

18190 使用随机隔离 schema 回归，18090 原后端及人工数据保留，18091 预览使用最新产物；两端 ready 均 200，测试 schema 最终只剩人工验收的一份。最终人工视觉复验未运行；Vite 单 bundle 大小提示仍存在，尚未拆包或量化性能。实际 Docker/远端 CI 留到最终验收，线上部署不要求。没有提交密码、Cookie、DSN 或临时预览脚本。
