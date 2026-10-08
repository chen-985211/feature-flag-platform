# 日志、错误与诊断

本文拥有诊断日志与错误传递规范；[审计历史](../contexts/audit/history.md) 拥有业务操作证据，[登录与权限](../contexts/identity/access-control.md) 拥有会话与授权。

## 错误契约

HTTP 错误统一包含稳定 code、可理解 message、必要字段详情和 request_id。业务分支按 code 判断，不解析 message。精确 API schema 在对应 Spec/Plan 落地。

| 类型             | HTTP 状态 | 计划错误码示例                                         |
| ---------------- | --------- | ------------------------------------------------------ |
| JSON/参数非法    | 400       | INVALID_INPUT、INVALID_USER_ATTRIBUTES                 |
| 无会话或会话失效 | 401       | UNAUTHENTICATED                                        |
| 权限或 CSRF 拒绝 | 403       | FORBIDDEN、CSRF_REJECTED                               |
| 资源不存在       | 404       | FLAG_NOT_FOUND、VERSION_NOT_FOUND                      |
| 唯一或并发冲突   | 409       | FLAG_KEY_CONFLICT、PRIORITY_CONFLICT、VERSION_CONFLICT |
| 非预期内部失败   | 500       | INTERNAL_ERROR                                         |
| 技术依赖未就绪   | 503       | SERVICE_NOT_READY                                      |

领域/应用错误由 HTTP 适配器映射；数据库异常归一为应用错误。内部响应不能暴露 SQL、连接字符串、堆栈或服务文件路径。合法的评估 false 是成功结果，不当作错误。

## 诊断日志

使用结构化 `slog`，在平台或边界记录 request_id、operation、scope、outcome、duration、稳定 error_code 和必要目标 ID。domain 和 application 返回错误/结果，不直接依赖具体 logger。

预期输入、权限与版本冲突保持合理级别，内部异常使用 error；避免将每次查询、拖动预览或高频评估记录为大量 info。请求中间件捕获 panic 后返回明确内部错误并记录诊断。

request_id 在入口生成或验证后采用，不直接信任任意超长客户端字段。响应与日志使用相同 ID，方便定位。

## 脱敏与前端反馈

日志禁止完整密码、Cookie、Authorization、CSRF token、连接字符串和任意完整评估属性。只记录明确允许的业务目标、错误码和规模信息。

前端把稳定错误码映射为中文反馈。字段错误在输入附近呈现，冲突提供查看最新版本入口，网络错误保留表单，不用普通提示掩盖保存失败。

## 验证

错误映射和脱敏用 unit；HTTP 响应字段、状态码与 request ID 用 contract/integration。诊断输出不得成为配置或权限的事实来源。
