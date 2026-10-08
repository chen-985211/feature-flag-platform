# D2 实现 Plan

状态：已验证，实际证据见 [验证记录](verification.md)。依据 [Spec](spec.md) 与既有用户授权；先保存本计划，再实现行为。

## 分层与事务

后端各上下文使用 domain/application/infrastructure，公开协作放 public。Flags application 定义授权、仓储事务、时钟/ID、审计端口；platform 将 Identity 公开授权与事务绑定的 Audit 公开追加用例接入。Flag 聚合维护规则和修改不变量。pgx 适配器锁当前 Flag，比较 expected_revision，维护关系表、完整 snapshot 和历史，同一事务提交。评估单次版本 JOIN 取得不可变快照。版本 codec 将规则期望值存为原始 JSON 文本 ExpectedJSON，防止 JSONB 展开指数数字；审计变化复用相同 codec 并限制大小。关系表仍按合法 JSONB 维护。

Identity application 定义密码、令牌、用户/会话存储端口。bcrypt 在外层实现；随机 32 字节会话令牌只保存 SHA-256 摘要。CSRF 使用以秘密会话令牌为密钥、固定域标识为消息的 HMAC-SHA-256，可在有效会话恢复时重建；数据库仍只保存其摘要。HTTP 负责 Cookie、Origin、CSRF 和有界登录限速，每次读取当前服务端角色。HTTPS Origin 启用 Secure。

前端上下文 application 暴露注入式远端用例，infrastructure 负责 fetch/DTO 映射，presentation 使用 Query 和表单。跨上下文外壳与 platform 装配身份、配置、审计和健康页面。权限显示消费服务端 write_environments，评估不复制后端算法。

## HTTP 契约

所有响应 JSON 使用 snake_case。规则另返回 expected_json 原始文本、历史返回 changes_json 原始文本，浏览器显示和再次提交大整数时避免 JavaScript Number 舍入；评估属性及规则期望值以原始 JSON 文本构造请求。错误遵循 [稳定错误契约](../../engineering/logging.md)，并带 request_id。

| 入口                                  | 行为                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------- |
| POST /api/auth/login                  | username/password，返回 user、write_environments、csrf_token 和会话 Cookie |
| GET /api/auth/session                 | 恢复会话与当前能力                                                         |
| POST /api/auth/logout                 | 校验 Origin/CSRF，撤销并清除 Cookie                                        |
| GET /api/flags                        | environment、q、enabled、limit/offset，返回 items/total                    |
| POST /api/flags                       | name/key/environment/enabled/default_value，创建 revision 1                |
| GET /api/flags/{id}                   | 完整权威快照                                                               |
| PUT /api/flags/{id}                   | name/key/default_value/expected_revision                                   |
| PATCH /api/flags/{id}/enabled         | enabled/expected_revision                                                  |
| POST /api/flags/{id}/rules            | attribute/operator/expected/priority/result/expected_revision              |
| PUT /api/flags/{id}/rules/{ruleId}    | 同上，修改现有规则                                                         |
| DELETE /api/flags/{id}/rules/{ruleId} | JSON expected_revision                                                     |
| POST /api/evaluations                 | key/environment/attributes 对象；只读                                      |
| GET /api/flags/{id}/history           | limit/offset，确定性分页，历史目标 Key 来自对应版本                        |

除登录/健康外均要求会话。配置写入及退出额外要求 Origin 和 X-CSRF-Token；评估是只读 POST。分页默认 50、上限 100。拒绝自报 actor/role 和未知字段。无 Flag 删除 API。

## TDD 步骤与最低有效层

1. 领域：先运行权限矩阵、equals/in 精确比较、优先级/聚合与首条 false 行为 Red；纯 Go 实现后 unit Green。
2. 应用：fake 端口验证授权/冲突/审计编排 Red；统一提交、读/evaluate、会话与 Audit 应用入口 Green。
3. 适配器：隔离 PostgreSQL 先验证业务写入/并发/审计失败回滚与会话恢复 Red；接入真实 SQL、bcrypt、令牌后 Green。HTTP 覆盖各类写入权限、Origin/CSRF、Cookie、非法 JSON 与 Actor 来源。
4. 前端：消费者契约、表单错误保留/权限反馈 component Red，接入远端用例与真实路由、列表/详情/规则/评估/历史 Green。
5. 装配：显式 seed:users、本地构建与真实浏览器关键路径；按用户新增指令，D2 建立第一条 Playwright 登录→创建→规则→评估冒烟，D3/D4 随能力增加回滚/发布，D5 统一稳定性验收；浏览器只证明系统接线、主题和布局，不重跑底层矩阵。
6. 验收：完整 Node/Go 门禁、unit/component/contract/数据库 integration/race/build，更新状态、AI 记录与 [验证记录](verification.md)，提交可审查结果。

## 数据与初始化

复用 D1 schema，无新增迁移。账号初始化显式调用，ON CONFLICT DO NOTHING，不重置密码或角色，不自动 seed。既有 env 加载连接配置，不在日志/错误/截图保存凭据。独立测试使用 *_test 数据库随机 schema，不触碰开发业务数据。

## 官方接口核对

密码哈希采用 [bcrypt 官方接口](https://pkg.go.dev/golang.org/x/crypto/bcrypt)，并按其 72 字节边界限制输入；会话绑定实现参考 [Go HMAC](https://pkg.go.dev/crypto/hmac)。E2E 服务准备与优雅退出采用 [Playwright webServer](https://playwright.dev/docs/test-webserver) 配置，CI 浏览器依赖按 [官方 CI 指引](https://playwright.dev/docs/ci) 安装。
