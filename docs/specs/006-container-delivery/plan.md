# D6 Plan：容器复现与最终交付

状态：已授权执行、实施中。对应 [Spec](spec.md)，复用用户「继续」和 Docker 既定范围。

## 架构与修改范围

根 Dockerfile/.dockerignore/compose.yaml 与 .env.docker.example；Node 工程入口维护 Compose 生命周期和隔离 smoke。cmd/healthcheck + platform 健康响应消费者适配器使用标准库，现有业务用例/API/schema 不变。

前端 builder 固定 Node/pnpm 并 frozen-lockfile；Go builder 固定版本/模块，把本次前端 dist 复制到 embed；最终 scratch 镜像含 CA 证书与四个静态 Go 程序，以数字 UID/GID 运行。数据库固定 PostgreSQL index digest，named volume 按 Compose project 隔离。

Compose db→migrate→app：service_healthy 与 service_completed_successfully，migrate 独立命令；seed 为显式 profile/run，不成为服务启动副作用。数据库密码通过 PGPASSWORD 传入现有 pgx 环境解析，DSN 不拼接密码。开发 .env 不传入镜像或容器。

## 分步验证

| 步骤 | 验收     | Red/替代验证                                                                               | 退出条件                                                    |
| ---- | -------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 1    | D6-01/02 | 新健康消费者 stub 实际拒绝合法 ready 或接受失败响应；真实 httptest 校验状态/内容/取消      | probe 实施后 Go unit 通过                                   |
| 2    | D6-01/02 | Docker/Compose 工程配置用实际 build/config/启动验证，不编造配置镜像测试                    | 非 root 镜像、静态资源和迁移 gate 验证                      |
| 3    | D6-03/04 | smoke 复用成熟 HTTP 用例和既有 Playwright，新增部署模式只改变 fixture/地址，不重复业务分支 | 容器业务后置状态、已有卷再启动/seed/migrate、四条浏览器路径 |
| 4    | D6-02/05 | 实际故障迁移、dump/restore 到 owned 恢复项目                                               | 应用启动被阻断，恢复账号/快照/历史可用                      |
| 5    | D6-06    | verify:full + test:docker、文档/格式/差异、owned 资源清理                                  | D0～D6 状态与最终交付记录真实，提交                         |

## 金字塔与隔离

健康探针只在 unit 验证技术消费者；领域、权限、并发和原子性复用现有底层矩阵。容器 smoke 证明构建/启动/卷/迁移/恢复边界，不取代 integration。复用四条 Playwright 检查实际内嵌镜像至 PostgreSQL 接线，不新增浏览器权限组合或算法边界。

Node 创建随机 project、临时环境文件和专属端口，用生成密码，在 finally 只删除本次容器/网络/卷/临时文件；不运行 system prune/down 用户项目，不打印 compose 展开后的凭据或环境。报告在忽略目录，只留结果/镜像标识。

## 迁移、发布与限制

无新增迁移。显式 migrate up 对现有库幂等；失败状态保留以供诊断，不自动 down 或清空用户卷。数据库恢复与配置版本恢复分别验证，Docker 手册写出停止写入、备份、恢复、重跑迁移/ready 顺序。

实际容器平台、镜像 ID、执行命令、失败修复和未运行项进入 [验证记录](verification.md)。远端 CI/其他架构/在线部署没有实际执行就不宣称通过。
