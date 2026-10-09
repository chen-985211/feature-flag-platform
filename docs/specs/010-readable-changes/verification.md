# 可读配置与变更验证

状态：已完成并验证，代码基线 71ec49f。2026-10-09（Asia/Shanghai），Spec/Plan 在生产实现前保存。修改范围为前端展示、测试与相关文档，业务接口、评估、角色和持久化数据保持原有行为。

## 验收结果

| ID    | 证据                                                                                                                           | 结果 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ---- |
| RC-01 | component 与真实创建 E2E：默认新增规则摘要及 r1→r2；展开只有新增规则的前后值，原始对象另行折叠                                 | 通过 |
| RC-02 | unit 覆盖创建/基本字段/启停/规则增删改/排序/复制/发布/回滚；未来 schema、无源、revision 不一致等保底；真实发布读取源 r5        | 通过 |
| RC-03 | equals/in 中文描述及精确 expected_json；true/false 对应开启/关闭；灰度、优先级与首条结果由后端决定，原关键路径仍通过           | 通过 |
| RC-04 | rollback component 确认内展示 Current→Original 与 r4；publish 说明 staging/key、固定 r4、目标 r8；原精确提交/冲突/只读断言保留 | 通过 |
| RC-05 | JSON unit 保留 9007199254740993、1e999、转义字符串；Clipboard 拒绝后可重试且复制完整原文本                                     | 通过 |
| RC-06 | 静态、40 unit、30 component、25 contract、4 E2E；最后构建在正常 18091；五张业务持久化表指纹相同                                | 通过 |

## 实现与测试过程

先补目标 component，实际 6 failed / 6 existing passed；失败原因分别为缺少历史具体摘要、变更对比/复制入口、兼容保底、中文操作符、确认变更与目标新版本说明。实现后目标 12/12 通过；没有故意修改后端制造 Red。

历史投影只读取既有 PascalCase/ExpectedJSON 审计，按事实比较业务字段；新 ID 的发布规则按优先级/内容比对，避免将纯身份更新误报为全部新增删除。创建和未来格式保底均保留完整原始文本。Flags 的版本/发布预览仍是后端事实，新增说明没有改变可提交条件、权限或固定源/expected revision。

公共 presentation 接收最小展示结构，没有跨上下文私有导入，也不复制评估引擎。原始 JSON 只添加空白，审计复制使用原始字符串；普通期望值按原始文本展示，避免精度损失。版本完整配置的技术数据也可展开查看与复制，seed 改变说明可能影响稳定分组。

实际执行：

- pnpm --dir frontend test:unit：40/40（5 文件），其中新增 6 个纯展示/兼容/精度场景。
- pnpm test:component：30/30（8 文件），新增 6 个用户交互场景；原历史分页断言改为业务详情→原始数据的嵌套展开，保留真实 offset/禁用后页检查。
- pnpm test:contract：25/25；API 和 HTTP mapper 未改变。没有新增与后端数据格式分叉的网络契约。
- pnpm check：文档/格式/规模/精确依赖、TypeScript、ESLint、go vet/golangci-lint 0 issues、分层与 Knip 均通过；70 个前端模块/271 条依赖无违规。初次 lint 提示两处无用正则转义，修正后重跑 formatter unit 与完整检查，未扩大忽略。
- E2E_PORT=18190 pnpm test:e2e：最后四条全部通过，10.4 秒、retries=0。沿用核心配置/回滚/排序复制发布/只读四个流程；补充真实历史摘要、原始 source/r5 保留和深色 390px 展开原始数据后的页面不溢出。
- 后端业务/integration/race 源码未改变，复用 [正式数据库任务](../009-persistent-demo/verification.md) 的 Go unit、PostgreSQL integration/race 结果。

## 运行与视觉核对

检查 E2E 自动产生的发布深色窄屏、历史深色 390px 截图：对比列在窄屏堆叠，长文本换行，原始内容有界滚动，动作可见。历史页宽度通过 E2E 几何断言验证；视觉核对限于上述自动化场景。

当前构建 JS index-5bVLvJz4.js 637.81 kB（gzip 198.33），CSS index-CMp-4TP1.css 56.21 kB（gzip 10.98）。正常 Go 服务从 PID 25307 优雅退出，以最后构建重启 PID 69531，仍用 18091。ready 为 200，HTML 与最后 frontend/dist/index.html 一致。

重启前后 users/flags/rules/flag_versions/audit_entries 的完整行指纹一致，计数分别为 6/7/10/24/24；用户创建的 review-checkout-01 当前为 r13/100% 灰度，原样保留，未执行 seed 或修改配置。测试用独立 18190/测试库 schema，正式库不参与 fixture 清理。

日志在忽略的 .build/readable-{red,green,unit-final,component-final,contract,check,e2e-final,server}.log；截图与报告在忽略的 test-results/e2e / playwright-report。原始数据和认证凭据不写入提交文档。收尾文档和最后 E2E 断言另跑静态检查。

## 剩余边界

未来审计格式无法生成摘要时仍可访问完整原始数据。Clipboard 权限不可用时有失败及手动选取提示。

实际 Docker/远端 CI 验收仍待完成，状态见 [D6 记录](../006-container-delivery/verification.md)。Vite 单包仍超过 500 kB，构建成功，性能优化尚未完成。
