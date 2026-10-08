# D5：演示与系统验收

日期：2026-10-08（Asia/Shanghai）。用户目标：继续既定完整项目计划，完成 D5。工具：Codex、Node/pnpm、Go、PostgreSQL、项目 Playwright。本文是脱敏操作摘要。

任务按 Large；复用已读的架构/上下文、开发流程、Flag 生命周期/评估、Identity/Audit、工程质量和金字塔规则，先保存 [Spec/Plan](../../specs/005-demo-and-system-acceptance/spec.md)。无新增待用户决策，继续授权来自会话。

Flags application 拥有五份完整示例与原子初始化；Scope Create 表达存在则保留，SQL 用主键唯一约束处理并发，共享现有完整快照写入。CLI 保留账号模式，加 demo 模式；平台读取真实 Actor 并共享 API 的 Flags/Audit 装配。稳定 ID 避免改 Key 后重建或覆盖。账号与配置事务边界明确。

真实 Red 覆盖应用零创建、SQL 未创建/未拒绝冲突、CLI 忽略 demo、viewer 登录接线缺失；Green 后 refactor 保存内容与服务装配。姓名段落与登录 URL 的测试定位失败按实际页面修正，未混入业务 Red。详细证据见 [验证记录](../../specs/005-demo-and-system-acceptance/verification.md)。

pnpm verify:full 通过，包括各层静态/测试、构建、实际 PostgreSQL 和 Go race；四条 E2E 通过。pnpm test:e2e:stability 三轮分别 4/4，独立随机 schema/密码与报告，retries=0。查看 production 只读截图；结束时 owned schema 数为 0，专用端口释放。

补 README 数据模型/取舍、[演示手册](../../delivery/demo.md) 和 [验收映射](../../delivery/coverage.md)。D0～D5 完成，D6 Docker 待实施。未改 .env 或开发数据，未运行远端 CI/容器/线上部署，未编造覆盖率和投入时长。最终状态及记录同本次提交保存。
