# Docker 启动、更新与恢复

配置与入口已实现，实际容器验收待完成。执行结果和环境阻断见 [D6 记录](../specs/006-container-delivery/verification.md)；本文命令不作为已通过证据。

前置条件为可用 Docker Engine 与 `docker compose`。容器构建安装固定 Node/pnpm/Go，宿主无需另装 Go、Node 或 PostgreSQL；Node/pnpm 只用于可选工程命令和自动化验收。源码、锁文件、固定镜像标签/index digest 由仓库提供。

## 首次启动

```sh
cp .env.docker.example .env.docker
# 模板已包含本地验收用的数据库密码和三个演示密码
docker compose --env-file .env.docker up --build -d --wait --wait-timeout 120 app
docker compose --env-file .env.docker run --rm seed
```

已有文件时保留，不能覆盖已有密码。[Docker 环境模板](../../.env.docker.example) 中的占位符密码可直接用于首次本地验收；部署时将 POSTGRES_PASSWORD 替换为足够长的随机值，并替换三个 SEED_*_PASSWORD（8～72 字节）。包含 $ 等特殊字符的值用单引号包裹；数据库密码通过 PGPASSWORD 传入 pgx，不拼接到 DSN，不要求手工 URL 编码。不要将展开的 compose config、容器完整环境或备份提交到仓库。

打开 http://localhost:8080，用 admin/editor/viewer 和本地配置密码登录。APP_PORT 改变后，同时调整 APP_ORIGIN 为实际浏览器 origin，包含协议和端口。应用默认只在宿主 127.0.0.1 发布，数据库不发布宿主端口。

db 健康后独立 migrate 服务执行 up，成功退出后 app 才启动。app 的健康探针检查 ready 响应，失败退出非零；readiness 实际访问 PostgreSQL。seed 为显式工具服务，不随 app 启动，重跑保留已有账号与配置。演示内容及步骤见 [演示手册](demo.md)。

可选统一工程命令：`pnpm docker:build` 只构建镜像；`pnpm docker:up` 构建、停止旧 app、等待迁移和新 app 健康；`pnpm docker:seed` 显式初始化；`pnpm docker:down` 停止并移除容器/网络，保留卷。Docker 命令读取 .env.docker，Node 不加载开发 .env。

## 镜像与运行

多阶段构建：Node 24.21.0/pnpm 10.33.0 frozen-lockfile → React dist → Go 1.27.0 embed 与四个静态程序。最终 scratch 镜像带 CA 证书，用户为 65532:65532，app/migrate/seed 的根文件系统只读、无额外 capabilities。容器不挂载源码、.env、宿主依赖或生成资产。PostgreSQL 17.7 使用 Compose project 专属 postgres-data named volume。

镜像名默认 didi:local，可通过 DIDI_IMAGE 修改。真实构建 ID、容器平台和验收结果见 [D6 记录](../specs/006-container-delivery/verification.md)。固定 index digest 可选择对应 CPU 平台，已验收的平台以记录为准。

## 停止与已有库更新

```sh
docker compose --env-file .env.docker down
# 卷保留；再次启动不会清空数据库
docker compose --env-file .env.docker up -d --wait --wait-timeout 120 app
```

更新源码后先备份，再构建、停止旧 app，重新启动以执行显式迁移：

```sh
docker compose --env-file .env.docker build app
docker compose --env-file .env.docker stop app
docker compose --env-file .env.docker up -d --wait --wait-timeout 120 app
```

迁移失败立即停止本次更新，app 保持停止，保留数据库和 migration dirty 状态用于诊断。不要自动 down 迁移、清卷或直接更改 dirty 标记。核对具体 SQL/库状态后再修复或从已验证备份恢复。本阶段没有新增 SQL，已有库重跑 up 为 NoChange；未来 schema 变更需单独验收升级路径。

`docker compose ... down --volumes` 会删除该项目数据库，仅在明确准备丢弃数据时使用。默认停止命令不带 --volumes；不得使用 system prune 清理其他项目。

## 数据库备份与独立恢复

业务版本回滚只恢复某份 Flag 的配置内容，不能恢复删除的数据库、用户、会话和全库历史。下面使用 PostgreSQL custom dump，恢复到另一个新项目/空卷；备份含密码哈希及会话数据，应限制访问并妥善保管。

```sh
umask 077
mkdir -p .build/backups
docker compose --env-file .env.docker stop app
docker compose --env-file .env.docker exec -T db pg_dump -U didi -d didi --format=custom --no-owner --no-acl > .build/backups/didi.dump
docker compose --env-file .env.docker up -d --wait --wait-timeout 120 app

cp .env.docker .env.docker.restore
# 编辑恢复文件：APP_PORT=8081，APP_ORIGIN=http://localhost:8081
# didi-restore 必须是尚未使用的新 project 名，避免写入现有数据库
docker compose -p didi-restore --env-file .env.docker.restore up -d --wait --wait-timeout 120 db
docker compose -p didi-restore --env-file .env.docker.restore exec -T db pg_restore -U didi -d didi --exit-on-error --no-owner --no-acl < .build/backups/didi.dump
docker compose -p didi-restore --env-file .env.docker.restore up -d --wait --wait-timeout 120 app
```

验证恢复实例的登录、配置/版本/历史和评估，确认后再决定是否切换使用。原库保持独立，不把 pg_restore 对准仍在写入的业务库。恢复后的迁移表随备份保留，up 检查当前版本。旧备份跨 schema 版本升级不属于本次单版本恢复证据。

## 隔离自动验收

```sh
pnpm verify:full
pnpm test:docker
```

test:docker 要求宿主项目 Node/pnpm 和 Chromium。它构建镜像、创建随机 project/密码/端口，在独立卷完成真实 HTTP 修改/冲突/只读、四条已有 Playwright、容器移除重建/seed/migrate、迁移失败 gate、备份到新卷恢复。finally 删除本次容器/网络/卷/临时密码文件，保留忽略目录中的浏览器产物和脱敏 verification.json；不读取 .env.docker、不操作用户已有卷或宿主数据库。

配置的依赖行为来自 [Docker 官方启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)，多阶段分工见 [官方构建说明](https://docs.docker.com/build/building/multi-stage/)。本次不包含线上部署或公开演示账号。
