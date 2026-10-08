# UI 验证记录

状态：UI 实施完成，自动验收通过。基线 dc73a29，Spec/Plan 先于实现保存。用户要求继续采用 shadcn/ui，并在后续明确停止浏览器工具检查，全面整理样式和文字层级，以测试兜底。最终结果绑定包含本记录的本地提交。

## 验收结果

| 验收             | 实际证据                                                                                                                                        | 结果                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| UI-01 组件与分层 | 官方 new-york-v4 registry 的十个组件源码、MIT 许可和原始内容 SHA-256；固定 radix-ui 1.7.0；TS/Vite/Vitest alias；53 个生产模块/189 条依赖无违规 | 通过                             |
| UI-02 新建流程   | component 验证可命名 Dialog、精确保存 payload、冲突保留输入、Escape 返回触发点；真实 E2E 创建/刷新读取；提交中禁止关闭的补充回归                | 通过                             |
| UI-03 标签与编辑 | component 键盘 Home 切换实际 tab/tabpanel 并更新 URL；E2E 基本信息/规则修改与刷新、历史 tab 接线                                                | 通过                             |
| UI-04 流转与回滚 | 原有冲突/固定版本/只读 component；真实 E2E 焦点循环/返回、复制、固定源发布、版本预览与回滚                                                      | 通过                             |
| UI-05 展示与权限 | 条件/结果、审计元信息、评估轨迹分层排版；四条 E2E 检查真实结果、版本、审计和 viewer/editor 权限                                                 | 通过                             |
| UI-06 主题与尺寸 | 原有 E2E 浅/深、390px、评估页面横向溢出断言和发布弹窗窄屏操作；组件接入阶段实际看过列表、详情与窄屏新建/规则/流转弹窗                           | 自动检查通过；最终排版未人工复验 |
| UI-07 工程与数据 | 完整原生门禁成功；最终 check/component/build/E2E 成功；使用 18190 独立测试服务，18090 人工数据继续由 18091 前端预览复用                         | 通过                             |

字体使用统一尺度：页面标题 24px、区块标题 16px、正文 14px、标签 13px、辅助信息 12px。表单字段及提示成组，技术值使用等宽字体，规则条件/返回值、历史动作/元信息、轨迹标识/判断状态按语义分开，浅/深主题共享层级。

## Red / Green / Refactor

- 新建 Dialog 和键盘 Tabs 两个测试先运行：原 UI 为内联表单和普通导航，2 failed / 1 existing passed，属于有效行为 Red。引入官方 Dialog/Tabs 并保持业务调用后 Green。
- 使用官方源码做本地适配：cn 与 Button 路径、语义 token、中文关闭按钮；删除未用的组件/导出，没有扩大 Knip/ESLint 忽略。Radix 的真实 ARIA 角色由 button 变为 tab，四条 E2E 相应改定位，保留既有结果断言。
- 初次组件回归失败包括 jsdom 缺少 ResizeObserver 与原生 dialog cancel 测试不适用于 Radix。添加无几何行为的测试 shim、改为真实 Escape 键盘操作；不把基础设施失败算业务 Red。React lint 发现渲染时读取焦点 ref，改为传递 ref 并只在关闭事件读取。
- 最终排版是既有行为的 presentation 重构；增加延迟请求表征测试，验证保存中 Escape/关闭/取消受阻，失败仍保留输入且可以退出。组件从 18 增至 19 个；未为颜色/间距写镜像 CSS 测试。

## 实际执行

2026-10-08，Node 24.21.0 / pnpm 10.33.0、Go 1.27.0、PostgreSQL 17.7、Chromium。

- E2E_PORT=18190 pnpm verify:full 退出 0：文档、依赖/文件规模、格式、类型、ESLint、go vet/golangci-lint（0 issues）、架构、Knip、Go unit、前端 34 unit / 18 component / 25 contract、真实 PostgreSQL integration、构建、Go 全包 race、四条 Playwright 全部通过。
- 用户追加文字排版要求后，pnpm check、pnpm test:component（19/19）、pnpm build、E2E_PORT=18190 pnpm test:e2e（4/4，retries=0）全部退出 0。前端分层 53 模块/189 依赖无违规；业务 unit/contract/Go/integration/race 源码未改变，复用此前通过结果。
- 四条 E2E 为：登录→创建→属性规则→评估→历史→退出；排序→复制→固定源发布→目标评估/审计；viewer 演示/editor production 只读；百分比→修改→预览→回滚→恢复后的评估。没有减少业务断言、增加 retries 或跳过失败套件。
- 最终产物约 511.04 kB JS（gzip 157.59 kB）、48.56 kB CSS（gzip 9.63 kB）。Vite 有大于 500 kB 的 bundle 提示，构建成功；没有调整警告阈值。尚未做路由拆包和性能量化。
- 18090、18091 /health/ready 均 200；18091 HTML 引用最后构建的 JS/CSS。测试库只剩用于持续人工验收的一份 didi_e2e schema，integration schema 为 0；本次独立回归服务已退出并清理自己的 schema。没有重建或清理用户正在验收的数据。

本地详细输出在忽略的 .build/ui-red.log、ui-verify.log、ui-final-{check,component,build,e2e}.log。最后 E2E 的 HTML 报告为 playwright-report，截图在 test-results/e2e 的各场景目录；记录不包含密码、Cookie 或 DSN。

## 视觉记录与限制

组件接入阶段的实际浏览器检查包括桌面列表/新建/详情、390px 浅色新建和深色规则/流转/版本长内容，确认焦点返回和有界弹窗。用户随后要求停止浏览器工具；只恢复临时 viewport 并保留预览页，未再检查浏览器。先前 .build/ui-review 截图仅作为那个阶段的记录，不用于证明最终排版；最终自动 E2E 生成新截图，但没有将未人工查看的截图声称为视觉验收。

18091 是当前会话的临时本机前端预览，复用 18090 后端，账号与数据相同；不改变生产代理/鉴权配置。正式构建仍由 Go embed 同源发布。Docker 按用户决定留到 CI 最后验收，实际容器/远端 CI/线上部署未运行，不在本次结果中标为通过。
