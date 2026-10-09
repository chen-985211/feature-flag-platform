# 开源仓库准备

日期：2026-10-09（Asia/Shanghai）。AI 工具：Codex。Small 发布准备任务，复用开发流程、文档路由和交付要求。

通过 gh 创建公开仓库 [chen-985211/feature-flag-platform](https://github.com/chen-985211/feature-flag-platform)，配置本地 origin。增加顶层 MIT License，保留 shadcn/ui 原有版权与许可；README 提供仓库链接、克隆命令及许可入口。

检查 Git 历史：本地环境配置、构建和测试产物未入库；567 个历史 blob 中未发现本次检查的令牌或私钥特征。验证范围为许可、文档和远端配置，业务代码保持已验证版本。

`pnpm check:docs`、受影响文档的 Prettier 检查及 `git diff --check` 通过。完整业务自动化结果复用现有验收记录；远端 CI 和容器验收结果需以实际流水线执行为准。
