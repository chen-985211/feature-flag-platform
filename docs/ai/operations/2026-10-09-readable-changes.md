# 可读配置与变更说明

日期：2026-10-09（Asia/Shanghai）。AI 工具：Codex。目标：完善历史摘要、可读规则、发布/回滚影响说明和可复制原始数据。

按 Large 保存 [Spec](../../specs/010-readable-changes/spec.md) / [Plan](../../specs/010-readable-changes/plan.md) 后实施，复用架构、上下文、UI、Audit/Flags、测试金字塔和交付规则。使用 polished-tool-ui 与 apple-design 技能，沿用 shadcn/Radix、主题与字体。

先补真实结构的历史、Clipboard、规则和确认 component，实际 6 failed / 6 existing passed，失败对应缺少摘要/对比、复制入口、自然语言操作符和具体影响说明。实现后目标 12/12 通过，再补纯展示 unit：创建/启停/增删改/排序、复制/固定源发布/回滚、未来格式保底及数字词法。

Audit 展示从 PascalCase/ExpectedJSON 的既有记录投影，保留 Actor 与原始文本，不将技术 ID/时间当业务差异；发布重新生成规则 ID 不伪造新增/删除。未知结构退回原始数据。Flags 继续读取后端预览，原权限、固定源版本、revision 和冲突处理不改动。

公共展示模块只接收最小规则展示结构；原始 JSON 格式化只增空白，复制审计时使用原始文本，避免大整数/指数词法变化。Clipboard 实际 Promise 拒绝/重试由 component 验证。静态检查首次指出两处多余正则转义，按提示修正并重跑格式器 unit 与完整检查，没有关闭规则。

原生检查、前端 unit/component/contract、四条真实 E2E 与运行实例结果见 [验证记录](../../specs/010-readable-changes/verification.md)。在既有 E2E 补充摘要与原始来源一致、嵌套展开及窄屏几何，并检查对应场景的自动截图。

正常 Go 验收服务以最后构建重启，正式库五张持久化表前后指纹一致，已有配置与历史保留。
