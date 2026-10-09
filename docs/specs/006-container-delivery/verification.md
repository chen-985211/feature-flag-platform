# D6 验证记录

状态：已完成。D6-01～06 与 F13 已由真实远端 CI 验收。Spec/Plan 在设计基线 fc52d7f 上先于实现保存；首次完整远端验收提交为 ee5cf60b8cbbd058299e8e87c518f539b1e9f572。

## 远端执行与产物

2026-10-09（Asia/Shanghai），[Verify 37888253012](https://github.com/chen-985211/feature-flag-platform/actions/runs/37888253012) 在 13:22～13:28 执行，整个工作流及 verify:full、test:docker 均为 success。环境为 GitHub 托管 Ubuntu 24.04 / linux/amd64；日志记录 Go 1.27.0、GOARCH/GOHOSTARCH=amd64。

容器构建使用固定 Node 24.21.0、pnpm 10.33.0、Go 1.27.0 与 PostgreSQL 17.7 index digest；前端嵌入 Go，scratch 镜像含 server/migrate/seed/healthcheck，用户为 65532:65532。Compose 的只读根文件系统、ALL capabilities 移除、健康与迁移成功依赖均经过实际运行检查。

首次 CI 镜像 ID：sha256:5b5931e02c10d02993fb2afde6b0fa81d809f9f0f068b1a89b8d823bc688b2da。容器报告生成于 test-results/docker/didi-smoke-eda1b6956cc3/verification.json；日志保留全部 smoke 成功检查点及最终 PASS。后续工作流将 verification.json 上传为 docker-verification artifact，保留 14 天，便于核对镜像平台、数据计数、备份大小和清理状态。

## 验收结果

| ID    | 实际后置结果                                                                                                           | 结果 |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| D6-01 | 真正构建 didi:local；内嵌页面可访问，四个 Go 入口可运行，非 root/只读根文件系统，镜像 ID 已记录                        | 通过 |
| D6-02 | 空卷完成 migration v1/clean 后 app ready；dirty 迁移非零退出且 app 保持停止，恢复 marker 后可重新健康启动              | 通过 |
| D6-03 | 真实登录、演示修改到 r2、旧 revision 返回 409、viewer 写入返回 403、评估与两条真实历史、退出；容器 Playwright 四条通过 | 通过 |
| D6-04 | 移除重建容器保留同一卷；重复 seed 为 created=0/preserved=5，migrate 重跑，配置及用户/规则/版本/审计计数保持一致        | 通过 |
| D6-05 | PostgreSQL custom dump 恢复到另一空项目/卷；登录、完整配置、评估 revision=2、历史及数据计数与备份前一致                | 通过 |
| D6-06 | 完整原生门禁和容器验收均成功；原始项目与恢复项目的容器、网络、卷均清理，finally 断言没有遗留 owned 资源                | 通过 |

## 完整门禁

远端 pnpm verify:full 包含文档、格式、规模/依赖、TypeScript、ESLint、Go vet/golangci-lint、分层/Knip、Go 与前端 unit、component、contract、真实 PostgreSQL integration、完整构建、Go race 和四条原生 Playwright，全部通过。

- 前端 unit：40/40（5 文件）。
- component：30/30（8 文件）。
- contract：25/25（4 文件）。
- 原生 Playwright：4/4，16.0 秒，retries=0。
- 容器 Playwright：4/4，13.1 秒，retries=0。
- pnpm test:docker：六个部署 smoke 检查点完成，最终打印 Docker delivery verified；清理失败会使命令失败。

容器 smoke 复用既有四条浏览器流程，实际验证内嵌应用至 PostgreSQL 的接线；算法边界、权限矩阵、事务与并发仍由低层套件证明。人工验收数据不参与 CI 的随机 schema/Compose project 清理。

## CI 运行时与复现

首次成功运行有一条 pnpm/action-setup v4 的 Node 20 运行时弃用警告。工作流已升级到固定完整 SHA 的 v6.1.0，action.yml 声明 runs.using=node24；项目 Node/pnpm 与现有完整门禁保持原样。报告上传 Action v7.0.2 同样固定完整 SHA 并使用 Node 24 运行时。

在 [Verify 工作流](https://github.com/chen-985211/feature-flag-platform/actions/workflows/verify.yml) 核对目标提交、各步骤结果及 artifact。原生和容器的本地复现命令分别为 pnpm verify:full 与 pnpm test:docker；容器需要可用 Docker Engine/Compose 和 Chromium，具体步骤见 [Docker 手册](../../delivery/docker.md) 与 [测试执行手册](../../testing/TESTING_RUNBOOK.md)。

## 最初实施记录（2026-10-08）

健康消费者的有效 Red 为 stub 拒绝合法 ready 响应；实现状态/内容/超时/取消处理后 Go unit Green。首次 no-unsafe-finally 与 Body.Close 检查失败修正后通过，没有禁用工具或删除断言。该阶段原生 verify:full 已通过，前端为 34 unit / 16 component / 25 contract，四条原生 E2E 通过。

首次本机容器验收在 Docker info 因引擎 socket 不存在退出；独立 Colima didi VM 又在镜像解压阶段受磁盘空间阻断，没有完成本机镜像构建。只清理当次半解压文件，未产生业务卷。此处保留当时环境失败，当前 D6 完成证据来自上述真实远端运行。

## 验证边界

实际验收平台为 linux/amd64，其他 CPU 架构、长期容量及线上实例尚未验证。当前已有库验证为重新应用现有 v1 迁移且数据保留，没有新增 schema 升级。配置回滚和全库备份恢复分别验证；前者不能替代后者。

原始详细日志、临时报告与截图保留在忽略目录或对应 CI 运行中；本文件保留可审查摘要、镜像标识和执行链接。后续改变业务、构建或部署配置时须运行受影响门禁并绑定新的提交结果。
