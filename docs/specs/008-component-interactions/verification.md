# 完整交互组件验证

状态：实施完成，自动验收通过。基线 914a556，Spec/Plan 在对应实现之前保存；结果绑定包含本记录的本地提交。用户要求全面替换手写交互控件，并根据截图删除重复身份、收敛页头与下拉样式。整个任务未使用浏览器工具，沿用用户以测试兜底的要求。

## 验收结果

| ID     | 实际证据                                                                                                                          | 结果 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ---- |
| CUI-01 | Workbench component 断言身份只出现一次、列表无重复环境行；列表/评估/概览共享 PageHeader，标题 22px、说明 13px                     | 通过 |
| CUI-02 | 真实 Select listbox/option；键盘选择 production 后 URL、查询环境与写入能力同步；禁用项拒绝选择，空筛选还原为空业务值              | 通过 |
| CUI-03 | 原有规则/版本/流转 component 保留精确请求与冲突断言；菜单内 Escape 返回触发点，下一次 Escape 关闭 Dialog；发布/回滚真实 E2E       | 通过 |
| CUI-04 | NavigationMenu 保留路由与选中态；Pagination 真正禁用边界按钮；历史 Collapsible 展开原始变更、下一页查询 offset 50；Tooltip 接线   | 通过 |
| CUI-05 | 官方 16 个组件来源/hash/许可；移除 NativeSelect 与过时 CSS；ui 目录之外无原生手写 select/button/input/textarea/details 等交互元素 | 通过 |
| CUI-06 | 18190 独立服务的四条 E2E；18090/18091 ready 均 200，18091 引用最后构建；测试库只保留一份人工验收 schema                           | 通过 |
| CUI-07 | dnd kit Sortable 处理实际拖拽；键盘取消不提交，指针排序精确提交唯一完整序列及 expected_revision；按钮/键盘冲突恢复 component      | 通过 |

普通 form、标题、正文、列表、定义列表和链接继续使用语义 HTML；库组件内部的原生元素及 Radix asChild 并非遗留手写交互。领域、应用、后端 API、数据库与权限语义未修改。

## 组件清单与适配

| 用途           | 实际组件                                                                | 适配职责                                                                                         |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 按钮与表单     | Button、Input、Textarea、Label、Checkbox、Select                        | Dropdown 统一受控 string/number、label、禁用项及空值；UI sentinel 不进入 API                     |
| 导航与弹窗     | NavigationMenu、Tabs、Dialog、Tooltip                                   | 工作台导航保留 URL；显式图标提示用 Tooltip；自动聚焦的弹窗关闭按钮不额外开启提示                 |
| 分页与审计展开 | Pagination、Collapsible                                                 | PagePagination 共用 offset 契约及真实禁用 Button；历史默认折叠，展开保留原始审计内容             |
| 内容与状态     | Table、Badge、Card、Alert                                               | Card asChild 保留 section/form 语义；Notice 保留 alert/status/note 与错误、权限反馈              |
| 拖拽排序       | @dnd-kit/core 6.3.1、@dnd-kit/sortable 10.0.0、@dnd-kit/utilities 3.2.2 | Sortable 的碰撞、测量、位移、指针/键盘传感器；RuleOrder 继续负责完整顺序提交、失败恢复与冲突阻止 |

官方 new-york-v4 七个新增组件使用固定 radix-ui 1.7.0，保留 registry 原始 SHA-256 与 MIT 许可。只改本地 import、主题及用到的导出；未扩大 Knip/ESLint 忽略。Select 弹层由 portal 管理，宽度对齐触发点、高度有界、选中/禁用态一致；浅深主题共享文字层级。顶部为唯一身份入口，详情保留有用的环境/revision。

## Red / Green / Refactor

- 先添加 Workbench 两个目标 component：重复身份和缺少实际 Select listbox，实际运行 2 failed / 4 existing passed，属于有效行为 Red。移除重复身份、接入 Select 后 Green。
- 新增三个组件回归：空筛选还原/禁用项、嵌套 Select→Dialog Escape 与焦点、真实历史折叠及分页请求。其他 component/E2E 从原生 selectOptions 改为 combobox→option，保留保存 payload、固定 revision、冲突、权限与最终结果断言。
- jsdom 缺少滚动与 pointer capture 的 API，仅增加无几何效果 shim；不把缺失 DOM API 当有效 Red，不用伪造几何证明拖拽。Tooltip 初次包裹所有图标按钮时会在 Dialog 自动聚焦关闭按钮后先消耗 Escape，改为仅显式 title 启用提示，原关闭行为回归通过。
- 全量排查发现原生 drag/位移/碰撞仍手写，先补充 Spec/Plan，再按原定技术栈接入固定 dnd kit。原 native fireEvent drag 测试改为移动按钮表征，仍断言完整序列；物理拖拽的精确 payload 迁入已有发布 E2E，不把 jsdom 零几何当真实拖拽。
- 新 E2E 在零间隔按空格激活后立即输入时出现键盘取消失败；库源码确认 KeyboardSensor 在激活后延迟注册 document keydown。测试改为实际 20ms key-down/up 间隔，并等待真实激活与碰撞状态；未增加固定 sleep、重试或删除取消断言。临时事件诊断已移除，最终四条真实 E2E 全部通过。该场景还确认取消没有请求、指针保存只有一条 exact 完整序列请求，后续 revision、目标评估及审计正确。

## 实际执行与边界

2026-10-08（Asia/Shanghai），Node 24.21.0 / pnpm 10.33.0、Go 1.27.0、PostgreSQL 17.7、Chromium。

- pnpm check 退出 0：文档、文件规模、精确依赖、格式、类型、ESLint、go vet/golangci-lint（0 issues）、分层与 Knip。前端 67 个生产模块/257 条依赖无违规，Go 依赖方向正常。
- pnpm test:unit 退出 0：Go internal 与前端 34/34 unit；pnpm test:contract 25/25；pnpm test:component 24/24（7 文件）。
- E2E_PORT=18190 pnpm test:e2e 退出 0，先真实构建 React/Go，四条 Playwright 全部通过，retries=0。涵盖登录/创建/属性规则/评估/历史/退出，排序/复制/固定源发布/目标评估与审计，viewer 演示/editor production 只读，百分比编辑/预览/回滚/恢复后的评估。既有主题/窄屏与弹窗焦点检查保留。
- Go/领域/应用/HTTP/持久化/integration/race 源码未修改，复用基线 [上次完整门禁](../007-shadcn-workbench/verification.md) 中的真实 PostgreSQL integration 和 Go race；不声称本次再次运行。
- 最终构建 JS 约 630.17 kB（gzip 195.77 kB），CSS 55.69 kB（gzip 10.88 kB）。Vite 仍有单包超过 500 kB 提示，构建成功；未调整阈值，尚未拆包或量化性能。
- 18090、18091 /health/ready 均 200；18091 HTML 的资源引用与最后构建的 frontend/dist/index.html 一致。测试库只余一份持续人工验收的 didi_e2e schema，integration schema 为 0；18190 服务退出并清理自己的 schema。没有重启原服务或重建用户数据。

详细本地输出在忽略的 .build/controls-{red,check,component,unit,contract,e2e}.log；E2E 报告与截图在忽略的 playwright-report、test-results/e2e。没有把自动截图声称为人工视觉复验。预览是当前会话临时服务，正式发布仍由 Go embed 同源提供资源。按用户要求，实际 Docker/远端 CI 验收留到最终阶段，未执行线上部署；密码、Cookie、DSN 和临时预览脚本不提交。
