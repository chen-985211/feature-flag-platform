# UI Plan：交互 primitives 收敛

先保存 Spec/Plan，复用用户直接执行授权及 polished-tool-ui/apple-design 原则。按 Large，因为跨表单/导航的键盘与 portal 控件交互被替换；业务 owner 不改变。

1. Workbench component Red：身份不重复/列表无多余环境行；自定义 Select listbox 和键盘选择环境后 URL/权限正确。补齐已有保存/冲突 oracle，不制造业务回归。
2. 下载官方 new-york-v4 Select、Card、Alert、Collapsible、Tooltip、Pagination、NavigationMenu，保存来源/hash，使用已固定 radix-ui；仅保留用到的导出，不扩大质量忽略。共享 Dropdown/Notice/PageHeader/PagePagination adapter 只封装控件。
3. 全部 NativeSelect 切换受控 Dropdown，保留 label/实际 value/disabled/placeholder；对应 component/E2E 从原生 selectOptions 改为真实 combobox→option 交互，保留业务断言。空筛选用专用 UI sentinel，由 adapter 转回原值。
4. 导航、折叠审计、分页、图标提示及 Card/Alert 全部接入；删除重复身份和过时 CSS，页头两层排版。普通语义 HTML 不强行包装成无意义的交互组件。
5. pnpm check、component、unit/contract、build 和 E2E_PORT=18190 pnpm test:e2e；Go/持久化源码未变化，复用上次真实 integration/race，不重跑无关套件。保留 18090，更新 18091；记录实际结果与未做人工视觉复验。

测试基础设施只补 jsdom 缺少的 DOM API，不伪造几何断言；UI 控件在 E2E 连接真实后端/PostgreSQL。没有 schema 迁移或生产服务重启。

补查拖拽后的执行补充（实现前保存）：固定 @dnd-kit/core 6.3.1 / sortable 10.0.0 / utilities 3.2.2（npm registry 的兼容 peer 与官方 Sortable 文档已核实）。Sortable 管理测量、碰撞、位移及指针/键盘传感器，RuleOrder 沿用完整顺序保存契约。原生 fireEvent drag 测试改为按钮通路表征，保留完整序列断言；物理拖拽精确 payload oracle 进入原有 E2E，同一场景同时证明权威 revision 与评估结果。追加键盘取消的真实 E2E 检查，不把 jsdom 零几何当成真实拖拽。
