# 工程基础验证记录

状态：D1 已完成，S1～S6 与 EF-01～EF-11 均有对应证据。工程基础完成不代表后续业务平台完成。过程见 [首轮记录](../../ai/operations/2026-10-08-foundation.md) 和 [收尾记录](../../ai/operations/2026-10-08-d1-completion.md)。

## 环境与版本

2026-10-08（Asia/Shanghai）：实际使用 Go 1.27.0、Node 24.21.0、pnpm 10.33.0、PostgreSQL 17.7。项目 Node 下载自官方发行目录并验证 SHA256；没有修改系统 Node 25。React 19.3.0、TypeScript 6.0.3、Vite 8.3.3、pgx v5.11.0、golang-migrate v4.20.1 和 golangci-lint 2.14.0 固定版本；npm 与 Go 锁文件已生成。

## TDD 证据

| 步骤             | 有效 Red                                                                | Green/Refactor                                                                                       |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| S1/S2 配置和健康 | 可编译未实现桩：配置解析不满足断言、健康路由返回 404；Go test 退出 1    | 纯配置与注入 probe 实现，配置/健康 unit、race、vet 通过                                              |
| S4 前端          | unit/component/contract 14 个断言在未实现桩上失败，退出 1；不是编译失败 | 用例、HTTP adapter、注入 React 页面后 14 个测试通过                                                  |
| S5 数据库        | 临时空 SQL 迁移：六张表缺失，6 个真实 PostgreSQL 场景失败               | 六表迁移及约束实现后 6 场景通过；每个测试实际提交并清理专属 schema                                   |
| S6 静态资源      | 注入空实现：根页面/资源/SPA 路由与缺失构建断言失败                      | 静态文件、SPA、API 排除、方法约束与明确未构建 503 通过；完整 unit 还发现根路径空字符串判断问题并修复 |
| 刷新回归         | 浏览器发现失败刷新仍显示旧请求 ID；新增组件断言 1 失败、4 通过          | 仅在本次不可用状态显示对应 request ID；5 个组件测试通过                                              |

前端最终为 unit 2、component 5、HTTP 消费 contract 8，共 15 个测试。Go internal 3 个包的配置/健康/资源测试通过；数据库 integration 6 个场景：空 schema up/repeat/down、环境 Key 唯一、延迟优先级唯一与实际排序、规则形状、当前版本外键、审计写入失败后的事务回滚。

最后一个数据库场景证明 SQL 事务基础，不把它表述为尚未实现的业务提交用例已完成。用户/会话表基础约束已建，登录与角色应用行为在 D2 验收。

## 质量门禁有效性

九项临时违规均返回非零并命中预期诊断：表现层导入 HTTP adapter、TypeScript 类型不匹配、表现层直接 fetch、未使用文件、格式违规、Go 未处理 os.Open 错误、Go domain 引入 pgx，以及前后端跨上下文内部导入。合法应用层同层导入曾被 platform 路径误判；修复后有效同层导入通过，非法跨层和内部导入仍失败。临时文件全部删除，未扩大忽略列表。

Python 检查已删除；Node 文档检查保留链接、锚点、H1、fence、空白与导航可达性。自定义检查仅依赖 Node 标准库。Knip 仅声明 Go/gofmt 为原生外部程序；不忽略业务文件和依赖。ESLint 包括类型感知 Promise、Hooks、网络归属，以及 Node mjs/cjs 配置。

## 实际完整验证

`pnpm verify:full` 最终退出 0：文档、精确依赖/规模、Prettier/gofmt、TypeScript、ESLint、go vet、golangci-lint（0 issues）、前后端依赖方向、Knip、Go/前端 unit、component、contract、PostgreSQL integration、React/内嵌 Go 服务/迁移 CLI 构建及全包 race 均通过。

文档、mjs/cjs 检查范围与架构门禁收尾后再次完整运行 verify:full，并验证 frozen-lockfile 安装。CI 配置已接入相同 verify:full，action commit 与运行时版本锁定；仓库没有远端，因此没有声称 GitHub CI 已运行。

## 实际运行与浏览器

- didi_development 已执行版本 1 迁移，dirty=false，无隐式业务 seed；didi_test 的本次测试 schema 清理后为 0。
- 编译服务实际提供页面、静态资源、SPA 与 live/ready；正常数据库返回 ready 200，不存在的数据库返回 ready 503，live 仍 200，错误仅稳定码和 request ID。
- 原生开发命令实际启动 API 与 Vite，Vite 健康代理返回真实 ready；终止后本次端口没有遗留监听。
- 浏览器验证浅/深色、真实就绪、503 不可用、服务停止后的连接失败、刷新与窄屏；390px 的 clientWidth/scrollWidth 均 390，无横向溢出。窄屏按钮排版经真实截图修正，桌面再验证 1024px 布局和键盘操作。
- 浏览器技能的本机原生组件不兼容，尝试失败后使用应用提供的浏览器 UI 验收，未伪造浏览器结果。截图和详细日志存放在忽略的 test-results，不提交凭据或完整 DSN。

## 后续阶段

D2～D5：登录、Flag/规则、评估、灰度、完整业务版本提交、审计、回滚、拖拽、环境流转、演示数据和少量关键 E2E。D6：Docker 文件及真实容器构建/运行；本机尚无 Docker CLI。线上部署不属于本次要求。
