# 2026-10-08：开始工程基础

工具：Codex；日期采用 Asia/Shanghai。本文是过程摘要，不是完整逐字会话。

## 目标、分级与路由

用户要求开始任务并识别需要共同决定的技术事项，随后澄清原题不强制线上部署。任务为 Large；先建立 [Spec](../../specs/001-engineering-foundation/spec.md) 和 [Plan](../../specs/001-engineering-foundation/plan.md)，然后开始后端 TDD。

路由实际读取：开发流程、架构/上下文、技术栈/工程质量、交付范围/验收、业务配置与身份边界、测试五份规范及日志/界面约定。当前代码只涉及 platform/config、platform/http 和 cmd/server，业务上下文仍待实现。

## 需求与技术决定

- 保留原题和扩展能力，最后一组选前端自动化 + Docker 可复现，不要求线上地址。
- 先使用现有 PostgreSQL 17，本机没有 Docker，容器最终验证稍后落实。
- 固定 Go 1.27.0、pgx v5.11.0；前端支持 Node 24 LTS，依赖在前端步骤锁定。
- 没有增加审批流、自助注册、SDK 或其他未授权能力。

## 实际过程与证据

先添加配置/健康边界和测试，运行 Go 测试实际观察因目标行为缺失产生的 Red，再实现 Green。配置测试覆盖有效输入、缺省/显式设置和非法字段脱敏；健康测试覆盖真实 probe 结果、存活独立性、超时和取消。

随后实际通过 Go unit、race、vet 和 build。创建项目开发数据库并启动编译后服务，用有效/不存在的数据库分别验证 200/503，确认内部数据库错误不泄露；两次 SIGTERM 均正常退出，服务已清理。

建立当前可执行 Make 命令、根 README、.env.example、.gitignore 与无外部依赖的文档检查。私有 .env 只在本机，未提交；没有记录密码或令牌。

## 剩余范围

前端、迁移、Flags/Identity/Audit 全部业务、正式 integration/contract 套件、关键 E2E 和 Docker 构建运行尚待完成。本阶段不标记 D1 或完整交付完成，没有自动创建 Git 提交。
