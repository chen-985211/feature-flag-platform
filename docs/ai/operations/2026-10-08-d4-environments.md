# 2026-10-08 D4 排序与环境流转

用户目标：继续 D4，完成规则排序、跨环境复制/发布与第三条真实发布 E2E，沿用全部扩展纳入交付的既定范围。

工具：Codex、文件/命令工具、官方 Playwright 输入说明、项目 Playwright 和实际截图。复用开发、DDD/Clean、Flags/权限/审计、UI、测试金字塔和交付规范，无新增依赖或核心待决策项。

任务分级 Large，先保存 [Spec](../../specs/004-ordering-and-environments/spec.md) 和 [Plan](../../specs/004-ordering-and-environments/plan.md)。领域维护完整序列、跨环境配置与目标身份，用例共用 Execute；现有版本端口与 PostgreSQL schema 复用，Audit 同事务增加来源摘要。前端注入远端端口，原生拖拽/键盘共用排序契约，固定源版本和目标预览进入可访问弹窗。

有效 Red/Green 包括领域/用例策略、来源审计、HTTP 目标契约、消费者和组件。真实并发发现锁等待后的 JOIN 版本匹配失效，改为先锁当前 revision 再读固定快照；真实鼠标和键盘分别发现拖拽 drop 接线与 Tab 循环问题，修复后保留验收断言。详见 [D4 验证记录](../../specs/004-ordering-and-environments/verification.md)。

最终 verify:full 本地退出 0，前端 34 unit / 16 component / 25 contract，3 条 E2E、真实数据库和 Go race 通过。截图复核后调整弹窗滚动正文与固定确认区，再执行 check 和 test:e2e 通过；未重复未变化的低层套件。测试 schema 和专用服务清理。

D5 完整演示/稳定性、D6 Docker 仍待交付；远端 CI 未运行。未保存密码、会话/CSRF token 或数据库连接字符串。
