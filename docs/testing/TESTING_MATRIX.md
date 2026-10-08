# 改动类型与最低有效测试层

先用最低层证明行为，只有边界风险不能被证明时才叠加。大小任务决定 SDD 流程，不能代替测试层级选择。

| 改动                       | 最低有效验证                                | 必要叠加                                   | 不应默认添加             |
| -------------------------- | ------------------------------------------- | ------------------------------------------ | ------------------------ |
| 文档、注释、格式           | 链接/格式/差异检查                          | 可执行示例受影响时验证示例                 | 行为 unit、E2E           |
| 可逆 UI 颜色、间距、排版   | 真实组件渲染与受影响静态检查                | 主题、窄屏、长文、焦点检查                 | 全流程 E2E、永久截图基线 |
| 表单、按钮、弹窗、局部交互 | Component Red/Green                         | 路由接线或 API 契约实际改变时叠加          | 每个错误分支的 E2E       |
| 领域和值对象、equals/in    | Go unit 表驱动                              | API 输入/输出改变时 contract               | 数据库与浏览器穷举       |
| 百分比分桶                 | Go unit：固定向量/阈值/稳定性               | 快照和序列化接线 integration/contract      | 大量随机用户浏览器测试   |
| 应用层用例编排             | unit + fake 端口                            | 真实事务/仓储接入 integration              | 用浏览器证明每个调用分支 |
| API/DTO/错误码             | Contract 或 HTTP integration                | 前端消费者兼容验证                         | 文案驱动的模糊断言       |
| SQL 查询、约束、仓储       | 真实 PostgreSQL integration                 | 迁移/schema 变化时迁移验证                 | 用 fake 证明 SQL         |
| 版本/审计原子性            | unit 策略 + PostgreSQL integration          | 实际失败注入、后置状态读取                 | 只断言写入次数           |
| 乐观锁/并发                | unit 策略 + 并发数据库 integration          | API 冲突契约与表单保留 component           | 任意 sleep 制造竞态      |
| 拖拽排序                   | 聚合 unit + component                       | 全序列/唯一约束/事务 integration           | 每一种顺序的 E2E         |
| 复制/发布/回滚             | unit + 数据库 integration                   | API/权限 contract、代表性关键路径 E2E      | 将全部失败矩阵放到 E2E   |
| 登录、角色与会话           | AccessPolicy unit + HTTP/数据库 integration | Cookie/CSRF/401/403 contract、少量会话 E2E | 只隐藏按钮的测试         |
| 架构边界/依赖调整          | 静态边界检查 + 相关套件                     | 真实装配/构建验证                          | 文件内容字符串快照       |
| 构建/环境/部署             | 配置检查、真实 build 与 smoke               | 迁移与发布验收                             | 复刻脚本逻辑的 unit      |

## 本项目核心矩阵

- 评估：enabled × default × 规则命中 true/false × priority × 属性类型/缺失。
- 灰度：0/100/中间比例 × 有效/缺失 user_id × 固定 seed × 重复/扩量。
- 变更：创建/编辑/启停/规则/排序/发布/回滚 × revision 正确/过期 × 审计成功/失败。
- 权限：admin/editor/viewer × development/staging/production × 每类读写操作。
- 流转：源固定版本 × 目标不存在/存在/并发修改 × 来源/目标环境 × 权限。

主要矩阵由 unit、integration 和 contract 分担。每个维度有等价类和边界覆盖，组合爆炸时重点覆盖已知交互风险，不能声称少量组合等于全组合穷举。

如果省略通常需要的层，报告具体原因和替代证据；环境不可用不等于风险被验证。
