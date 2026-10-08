# D6：容器交付与最终检查

日期：2026-10-08（Asia/Shanghai）。用户目标：继续既定最后阶段，完成 Docker 复现与交付。工具：Codex、Node/pnpm、Go、PostgreSQL、Playwright、Docker CLI/Compose、Colima。本文是脱敏操作摘要。

按 Large 执行；复用架构/开发流程、工程质量/技术栈、测试策略/矩阵/要求/执行手册、交付及日志规则，先保存 [Spec](../../specs/006-container-delivery/spec.md) 与 [Plan](../../specs/006-container-delivery/plan.md)。无新增业务决定；线上平台不在既定交付范围。

多阶段构建将固定 Node/pnpm 的前端产物嵌入固定 Go 构建，最终 scratch/非 root 镜像提供 server/migrate/seed/healthcheck。Compose 用专属 PostgreSQL 卷、数据库健康与迁移成功依赖、显式 seed、loopback 应用端口；密码独立于 DSN。工程与验收编排统一用 Node，Docker 任务不加载开发 .env。

健康消费者的有效 Red 为合法 ready 响应被 stub 拒绝；Green 后覆盖 503、alive、无效 JSON、取消与连接不可用。完整门禁先发现 Node finally 的 unsafe control flow 和 Go Body.Close 未处理，均修正后重跑通过，没有禁用工具或删除断言。

pnpm verify:full 通过：静态、各层测试、真实 PostgreSQL、四个本地产物、Go race 与四条原生 Playwright。Docker Compose 配置解析通过。新增容器 smoke 复用四条既有 E2E，计划验证容器修改/冲突/权限、移除重建保留卷、重复 seed/migrate、dirty 迁移阻止 app、custom dump 恢复到新项目与资源清理；目前未实际执行成功，不作为验收证据。

本机最初没有 Docker 引擎。已异步询问 Colima/Docker Desktop 偏好，在独立工作期间没有收到选择，按已说明的推荐方案安装 CLI/Compose/Buildx/Colima；这是实施默认选择，没有虚构用户明确选择。创建单独 didi profile，关闭宿主目录挂载与 SSH 配置修改。启动在镜像解压阶段失败，磁盘可用空间仅约 111 MB；只清理本次半解压文件后恢复约 3.2 GB。已请求释放至少 10 GB，实际构建/启动/恢复仍待完成。

补 Docker 启动/更新/备份恢复手册、工程入口、CI 容器检查步骤和状态说明。未修改用户 .env 或开发数据库，未删除已有 Docker 数据；未运行远端 CI/线上部署、未获得实际镜像 ID，不把 D6/F13 标为完成。详细结果见 [D6 验证记录](../../specs/006-container-delivery/verification.md)。

最后改动后 pnpm check 通过，空 Docker 密码模板实际解析被拒绝；原生 owned schema 为 0，18090 已释放。pnpm test:docker 入口实际调用后在 Docker info 因引擎不可用失败，未进入构建/创建项目。源码与真实状态一起保存到本次本地提交，实际容器验收仍待环境恢复。
