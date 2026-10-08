# Feature Flag 与灰度规则平台

React + Go + PostgreSQL，前后端 DDD + Clean，大任务 SDD、行为变更 TDD。

## 当前状态

工程基础任务实施中。当前实现后端配置校验、进程存活与真实数据库就绪端点，以及对应单元测试和后端命令。前端、Flag/规则/灰度、登录/权限、版本/审计、迁移和 Docker 文件仍待实现；此版本不是完整业务应用。

需求与工程规范见 [docs](docs/README.md)，当前任务见 [工程基础 Spec/Plan](docs/specs/001-engineering-foundation/spec.md)。本次交付要求本地与 Docker 可复现，不要求线上地址。

## 当前后端启动

先决条件：Go 1.27.0、PostgreSQL 17、Make；文档检查还需要 Python 3。当前前端尚未搭建，其未来支持基线为 Node 24 LTS 与锁定 pnpm。

确保 PostgreSQL 可用，首次运行显式创建项目开发库：

```sh
createdb didi_development
cp .env.example .env
make dev-backend
```

已有数据库时不重复 createdb，按本机认证方式修改 `.env` 的 DATABASE_URL。配置加载后不会打印数据库 URL。Make 读取本地 `.env`，文件被 Git 忽略；不得写入真实生产凭据。

```sh
curl http://127.0.0.1:8080/health/live
curl http://127.0.0.1:8080/health/ready
```

live 表示进程正常服务；ready 实际调用 PostgreSQL，失败/超时返回 503 和稳定错误码，liveness 不受影响。使用 Ctrl-C/SIGTERM 有界关闭服务。

## 当前可执行验证

```sh
make check-docs
make test-backend
make test-race
make vet-backend
make build-backend
```

`make check-backend` 聚合这些检查。当前 unit/race 不访问数据库；实际连接需另用开发数据库 smoke 验证。完整 integration、前端测试和 Docker smoke 将在对应步骤落地，不使用空命令冒充通过。

## 配置与限制

`.env.example` 提供数据库 URL、监听地址、APP_ORIGIN、SESSION_TTL、READINESS_TIMEOUT 与 SHUTDOWN_TIMEOUT。非法配置明确指出字段，错误不返回原值。当前尚无迁移、seed、登录或演示账户；后续阶段完成时更新本页。

所有已确定扩展仍在 [交付范围](docs/product/scope.md)，完成状态由 [任务验证记录](docs/specs/001-engineering-foundation/verification.md) 和 [交付计划](docs/delivery/roadmap.md) 维护。AI 辅助过程见 [决策记录](docs/ai/decisions.md)。
