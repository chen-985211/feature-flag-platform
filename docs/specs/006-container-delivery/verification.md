# D6 验证记录

状态：部分完成，实际容器验收受本机磁盘空间阻断。基线 fc52d7f，Spec/Plan 先于实现保存。F13/D6 尚未完成，不能以配置文件或原生门禁代替 Docker 证据。

## 已实现与低层证据

Dockerfile 固定 Node 24.21.0、pnpm 10.33.0、Go 1.27.0 与 PostgreSQL 17.7 index digest；多阶段前端 embed、四个静态程序、scratch/65532 用户。Compose 设置数据库健康→显式迁移成功→app 健康、只读根文件系统与 dropped capabilities，seed 独立，PGPASSWORD 不拼接 DSN。构建上下文排除 .env、依赖与本机产物。

Node 提供 docker:build/up/down/seed 与 test:docker；后者使用本次随机项目/端口/密码/数据库卷，复用四条 E2E，计划验证持久化、迁移故障与独立数据库恢复。CI 配置追加 test:docker，远端尚未运行。

有效 TDD Red：healthcheck Ready stub 总返回失败，实际合法 ready 响应测试失败。实现 HTTP 状态/内容/超时/取消后 Go unit Green。首次门禁的 no-unsafe-finally 与 errcheck Body.Close 失败属于质量诊断，修正显式控制流和资源关闭后通过。

| 执行                                                           | 实际结果                                                                                                                  | 对应验收                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| pnpm verify:full                                               | 通过；前端 34 unit / 16 component / 25 contract，真实 PostgreSQL、Go race、四个本地二进制与四条原生 E2E（4/4，retries=0） | D6-06 低层回归、D6-01 健康消费者部分 |
| docker compose -f compose.yaml config --quiet（占位密码）      | 通过；仅解析配置，不连接引擎                                                                                              | D6-02 配置部分                       |
| Colima didi profile 启动                                       | 失败：VM 镜像解压时宿主磁盘不足                                                                                           | 环境阻断，非有效业务 Red             |
| Docker build / Compose 业务、持久化、迁移故障与恢复 / 容器 E2E | 未执行成功；没有实际镜像 ID/平台与容器报告                                                                                | D6-01～05 尚待验收                   |

## 环境阻断与恢复条件

最后相关改动后 pnpm check 再次通过，文档/格式/规模/类型/lint/架构/unused 均成功；Git diff --check 无错误。使用空密码模板实际解析 Compose 被拒绝，确认没有可启动的默认数据库密码。原生测试的 owned schema 剩余数为 0，18090 无监听。

pnpm test:docker 已调用，入口在 Docker info 步骤以非零退出，诊断为引擎 socket 不存在；未进入构建或创建项目。这是运行环境阻断，没有跳过 smoke、伪造容器报告或禁用 CI 步骤。

macOS ARM 宿主原先没有 Docker 引擎。异步询问运行环境选择后，独立实施期间没有收到其他选择，按已说明的推荐方案准备 Colima。安装的 Colima 0.10.3、Docker CLI 29.8.2、Compose 5.6.0、Buildx 0.38.0 不属于项目运行依赖；使用单独 didi profile，未挂载宿主目录、未修改 SSH 配置。

VM 创建在基础镜像解压阶段失败；诊断时可用空间约 111 MB。只删除本次失败的半解压 image 文件，恢复约 3.2 GB；未启动应用容器，未产生业务卷。已请求宿主释放至少 10 GB，之后启动引擎并运行 pnpm test:docker，按真实失败修正后补充镜像 ID、平台、迁移、容器业务/浏览器、持久化、数据库恢复和 owned 清理结果。仍不要求线上部署。

原生门禁与该版本实现绑定；后续业务/Go/E2E 变化才重跑受影响范围。容器配置与 smoke 仍需真实执行，不能因磁盘阻断将阶段标记完成。未运行远端 CI、其他 CPU 架构、长期容量或在线实例。
