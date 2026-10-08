# UI Plan：组件与交互结构

状态：实施完成，实际结果见 [验证记录](verification.md)。先保存 Spec/Plan，再实施；复用用户 shadcn/ui 指令和既定架构/开发/测试标准。使用 polished-tool-ui 与 apple-design，优先基础、一致性和信息层级。

执行补充：用户后续指定不再使用浏览器工具，以测试兜底。最终样式统一字体尺度与行距，调整字段分组、规则条件、历史元信息和判断轨迹；只改变 presentation 排版，不改变保存/权限/版本契约。最终继续跑静态、组件、构建及真实 E2E；已有 Go 单元/集成/race 结果在相关源码未变时复用。

## 路径与依赖

frontend/src/presentation/components/ui 存官方 new-york-v4 registry 源码；presentation/lib/cn 与语义主题支持它。记录 registry 内容 hash/来源，保留必要许可；仅新增实际使用的固定 Radix 依赖。components.json、TS/Vite/Vitest alias 同源配置，不升级无关依赖。

上下文 presentation 消费共享 UI，调用现有应用 contracts；platform、domain/application、HTTP 和数据库接口不变。工作台外壳、列表、表单、详情、评估、版本/历史、流转使用统一 primitives 和布局。

## 顺序与 TDD

1. 新建弹窗与键盘详情 tabs component Red：当前 inline form/普通导航不能满足新的 Dialog/tab 契约。保留现有保存/错误/权限 oracle。
2. 官方组件和主题基础、列表新建 Dialog、可访问详情 Tabs Green；改造表单/基本信息/规则编辑。
3. 流转 native dialog 改为 Radix Dialog，保留固定源/冲突/只读/忙状态，component 回归验证焦点和关闭；回滚同一交互规范。
4. 外壳/列表/规则/评估/版本/历史的布局、密度、图标、状态和浅/深 token；组件接入阶段已用实际浏览器，后续按用户指令停止浏览器工具，完成统一文字排版。不编造 CSS unit 或最终视觉复验。
5. 18090 当前人工验收继续运行；E2E fixture 与 Playwright 支持另一个专属端口，通过实际服务启动和四条回归验证配置。临时前端预览复用当前后端，不重建人工数据。
6. pnpm verify:full（独立 E2E 端口）；最后文字排版后重跑 check/component/build/E2E，复用未变的业务 unit/contract/integration/race。检查完整差异与 AI 记录，交接新 UI。

官方生成的无用组件/导出应删除，不为整库源码增加 Knip/ESLint 忽略。输入与授权分支在现有 component/contract/Go 底层覆盖，复用四条真实 E2E证明接线，不为每个控件增加全流程。

## 迁移与恢复

无新增业务 API/数据库迁移。保留完整测试失败诊断，不以组件重构删除回归断言。当前人工验收服务不停止，避免其清理临时 schema；测试创建/清理自己的新 schema，最终预览 URL 与凭据如实交接。Docker/远端 CI 未实际运行不能宣称完成。
