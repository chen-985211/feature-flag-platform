# D6 Spec：容器复现与最终交付

状态：已完成并验收。设计基线 fc52d7f，远端验收提交 ee5cf60，结果见 [验证记录](verification.md)。Docker 交付属于既定完整范围，在线部署不要求。

## 目标与范围

从干净 checkout 用 Docker Compose 构建同一 React/Go 源码，启动独立 PostgreSQL、显式迁移和应用，显式初始化演示；证明容器中业务结果与持久化，并保存最终交付证据。涉及平台运行适配器与工程编排，按 Large 执行，复用现有架构、生命周期、身份/审计及金字塔规则。

## DDD 与事实归属

Flags/Identity/Audit 的领域、应用及 PostgreSQL 数据仍是业务 owner，Docker 不增加业务上下文。容器装配复用现有 server/migrate/seed，前端作为内嵌资源与 API 同源。健康探针属于平台技术适配器，不读取或修改业务配置。

1. 镜像从固定工具链、锁文件和源码构建，不包含本机 .env、依赖目录、生成资产或报告；运行用户非 root。
2. PostgreSQL 健康且迁移成功后才启动应用。迁移失败不能被 Compose 当作新应用就绪；普通服务启动不隐式迁移/seed。
3. 数据由项目专属持久化卷拥有，停止/重建容器保留配置、版本、审计和账号；显式销毁卷是单独操作。容器 smoke 创建并清理本次独立项目/卷，不触及宿主开发/测试库或用户已有 Compose 项目。

## 行为与交付

使用独立 .env.docker 配置数据库密码、同源地址/端口和演示密码，模板提供本地验收用的占位符值，部署时替换。数据库端口不向宿主暴露，应用默认仅在本机 loopback 暴露。演示初始化显式运行现有 demo 用例；重跑/升级不重置配置。

多阶段构建将 Node/pnpm 前端产物交给 Go embed，最终镜像包含 server/migrate/seed 与健康检查入口。健康检查确认 ready 响应并有短超时，失败退出非零。Compose 区分数据库健康依赖与迁移成功依赖。

备份/恢复手册明确 PostgreSQL 全库备份和业务配置回滚的区别；在隔离容器中实际验证数据库恢复，而不以 migration down 替代恢复。未引入新 schema，本版本的已有库升级为再次应用当前迁移且数据不变。

## 验收

| ID    | 场景                           | 后置条件                                                                         | 最低有效证据                      | 交付编号    |
| ----- | ------------------------------ | -------------------------------------------------------------------------------- | --------------------------------- | ----------- |
| D6-01 | 固定依赖、干净源码构建         | React 内嵌、四个 Go 入口可运行、非 root、实际镜像 ID/摘要记录                    | 实际 Docker build/inspect         | F13         |
| D6-02 | 空库启动/迁移失败              | 成功版本非 dirty 后 app healthy；故障迁移拒绝应用启动                            | Compose smoke                     | F13         |
| D6-03 | 容器业务链路                   | 真实登录/演示评估、修改→版本/审计、冲突/只读权限，退出；内嵌浏览器主要路径可用   | 代表 HTTP smoke + 复用 Playwright | F01～F13    |
| D6-04 | 重新启动/重复初始化/已有库迁移 | 已修改配置及版本/历史不变，数据库卷保留，seed/migrate 可重跑                     | 实际 Compose 生命周期             | F04/F07/F13 |
| D6-05 | 数据库备份恢复                 | 隔离恢复库保留用户及完整配置/版本/审计，评估一致                                 | PostgreSQL dump/restore smoke     | F06/F13     |
| D6-06 | 最终交付                       | 完整低层门禁、关键 E2E、Docker 证据与 README、AI/限制说明齐全；只清理 owned 资源 | 门禁/记录/差异检查                | F01～F13    |

## 风险与确认

镜像 Node 24.21.0-bookworm-slim、Go 1.27.0-bookworm、PostgreSQL 17.7-bookworm 已锁定 index digest。首次本机 Docker 引擎/磁盘阻断属于历史实施环境问题；D6-01～06 已在 Ubuntu 24.04 / linux/amd64 的远端 CI 实际通过，见 [记录](verification.md)。

其他 CPU 架构和长期容量尚未验证；固定多架构 index digest 不等于所有平台都通过验收。参考 [Docker 启动依赖](https://docs.docker.com/compose/how-tos/startup-order/) 与 [多阶段构建](https://docs.docker.com/build/building/multi-stage/)。
