# 工程质量工具与门禁

统一入口使用 Node 24.21.0 和 pnpm 10.33.0；自定义检查只有 Node 标准库依赖，不要求 Python。原生 Go 工具仍负责 Go 分析，Node 负责调用与失败传播。依赖和配置分别由 package.json/pnpm-lock.yaml、go.mod/go.sum 与 .golangci.yml 固定。

## 已实现检查

| 范围             | 工具                                      | 发现的问题                                                       | 入口                                     |
| ---------------- | ----------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| 前端             | TypeScript strict                         | 类型错误、未使用局部变量、非法边界输入                           | `pnpm typecheck`                         |
| 前端/脚本        | ESLint 10、typescript-eslint、React Hooks | 未处理 Promise、不安全类型操作、hooks 误用和代码错误             | `pnpm lint`                              |
| 非 Go 源码与文档 | Prettier                                  | 格式漂移                                                         | `pnpm format:check`                      |
| 前端             | dependency-cruiser                        | 循环、未解析导入、分层逆向依赖、跨上下文内部导入                 | `pnpm check:architecture`                |
| 前端/脚本        | Knip                                      | 未使用文件、导出、依赖和未声明依赖                               | `pnpm check:unused`                      |
| Go               | gofmt、go vet                             | 格式、可疑调用与语言层错误                                       | `pnpm format:check` / `pnpm lint`        |
| Go               | golangci-lint 2.14.0                      | errcheck、staticcheck、unused、ineffassign、gocritic、nolintlint | `pnpm lint`                              |
| Go               | Node + go list                            | 领域/应用层引入外层或第三方库，跨上下文内部导入                  | `pnpm check:architecture`                |
| 全仓             | Node                                      | 文档链接/锚点/导航、700 行上限、精确依赖版本、遗留 Python 检查   | `pnpm check:docs` / `pnpm check:project` |

Knip 中仅声明 Go/gofmt 为外部原生程序；不忽略业务文件、依赖或导出。golangci-lint 已包含 Staticcheck，因此不再重复安装独立 Staticcheck。React 19/Vite 8 与 TypeScript 6 的版本依据官方包元数据和工具兼容性选择；所有直接依赖精确锁定。

`pnpm tools:install` 把固定 Go 检查工具安装到忽略的 .tools/bin，check 不隐式下载工具。`pnpm format` 是显式修复；check 不修改代码。临时违规验证结果归档到 [工程基础验证](../specs/001-engineering-foundation/verification.md)。

## 组合门禁与 CI

- `pnpm check`：文档、工程规范、格式、类型、lint、架构、未使用代码。
- `pnpm verify`：check + Go/前端 unit + component + HTTP 消费 contract + PostgreSQL integration + 前后端构建。
- `pnpm verify:full`：verify + Go race（包括隔离数据库场景）。

CI 的 .github/workflows/verify.yml 使用 PostgreSQL 17.7、固定 Node/Go/pnpm 和锁定 action commit，执行同一 verify:full；本地执行通过不能声称远端 CI 已运行。业务 E2E、seed 和 Docker 属于后续交付阶段，当前不放置空门禁。

数据库约束与 SQL 的有效性由真实 PostgreSQL integration 验证，测试布局与金字塔归 [测试执行手册](../testing/TESTING_RUNBOOK.md) 维护。

工具依据：[ESLint 配置](https://eslint.org/docs/latest/use/configure/configuration-files)、[类型感知 lint](https://typescript-eslint.io/getting-started/typed-linting/)、[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)、[Knip](https://knip.dev/overview/getting-started)、[golangci-lint](https://golangci-lint.run/docs/welcome/install/)。

## D2 浏览器门禁

根 workspace 固定 @playwright/test 1.64.0，负责真实前端、Go 与 PostgreSQL 的跨系统冒烟。pnpm test:e2e 构建后运行；pnpm verify:full 在底层与 race 检查通过后运行同一套用例。CI 显式安装 Chromium，不增加 unused 排除项。D3 已增加回滚用例，D4 增加发布，D5 检查稳定性。
