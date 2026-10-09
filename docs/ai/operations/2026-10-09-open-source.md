# 开源仓库准备

日期：2026-10-09（Asia/Shanghai）。AI 工具：Codex。Small 发布准备任务，复用开发流程、文档路由和交付要求。

通过 gh 创建公开仓库 [chen-985211/feature-flag-platform](https://github.com/chen-985211/feature-flag-platform)，配置本地 origin。增加顶层 MIT License，保留 shadcn/ui 原有版权与许可；README 提供仓库链接、克隆命令及许可入口。

检查 Git 历史：本地环境配置、构建和测试产物未入库；567 个历史 blob 中未发现本次检查的令牌或私钥特征。验证范围为许可、文档和远端配置，业务代码保持已验证版本。

`pnpm check:docs`、受影响文档的 Prettier 检查及 `git diff --check` 通过。完整业务自动化结果复用现有验收记录；远端 CI 和容器验收结果需以实际流水线执行为准。

## CI Action 运行时迁移

Small CI 配置调整。首次 [Verify](https://github.com/chen-985211/feature-flag-platform/actions/runs/37888253012) 完整通过，但固定的 pnpm/action-setup v4 声明 Node 20，产生运行时弃用警告。

核对 [GitHub 迁移说明](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/) 与 [上游 v6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0) 后，升级 Action 并固定完整提交 ea17c68df8912ef543352723c149a84f56e3d413。该提交的 action.yml 声明 runs.using 为 node24；现用 version 输入和默认安装/缓存行为兼容。项目 Node 24.21.0、pnpm 10.33.0、依赖锁文件与验收步骤保持原样。

验证范围为工作流格式、文档及真实远端 Verify：核对 pnpm 安装、完整原生/容器门禁和运行时警告。此配置调整不新增镜像实现的单元测试。

D6 完成状态及容器证据保留同步更新，详见 [D6 记录](../../specs/006-container-delivery/verification.md) 与 [操作摘要](2026-10-08-d6-containers.md#2026-10-09远端验收完成)。
