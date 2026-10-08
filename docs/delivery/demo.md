# 本地演示手册

第一次验收请先看 [人工验收指南](manual-acceptance.md)，按独立 Key 逐项操作并记录预期结果。本手册维护标准 seed 示例及其初始语义。

先按 [README](../../README.md) 准备 PostgreSQL、DATABASE_URL 和三个 SEED_*_PASSWORD，执行 `APP_ORIGIN=http://127.0.0.1:8080 pnpm demo`。该入口显式迁移、初始化、构建，再运行普通 Go 服务，直接打开 http://127.0.0.1:8080。需要热更新时仍可使用 `pnpm migrate` → `pnpm seed:demo` → `pnpm dev`。以下预期对应首次初始化；演示中修改后重跑 seed 会保留修改，不把数据恢复成初始状态。

## 数据与持久化验收

人工演示连接 DATABASE_URL 的普通 PostgreSQL 数据库，默认 didi_development/public；列表、详情、规则、版本与历史均由 Go API 读取数据库。演示数据是真实数据库记录，可以继续编辑；初始化配置用于展示规则语义，不代表真实公司的线上业务数据。

正常服务停止不会删除表或数据。退出后重新执行相同 demo 命令，再登录即可检查之前的配置。E2E fixture 会清理自己的测试 schema，因此它只用于自动测试，不作为持续人工验收的运行方式。

本次本地实例已经保留旧验收配置，切换到普通 Go 服务，并使用正式 admin 经 API 新建 development/acceptance-persistence（「演示：持久化验收」）。该配置有 country equals CN 返回 true、25% 灰度两条规则，默认 false、已启用，当前 r6；版本与历史保存创建、两次添加规则、停用、启用、基本编辑共六次真实操作。输入 `{"country":"CN"}` 返回 true / attribute_rule，输入 `{}` 返回 false / default。旧示例及其原始操作者和历史也保留；新的操作使用当前登录用户。

这份额外配置是本次真实接口验收的结果；新 checkout 的标准 seed 仍创建下文五份示例，不伪造额外操作历史。SQL、seed 重跑和真实停止/启动的验证见 [持久化记录](../specs/009-persistent-demo/verification.md)。

## 初始化与账号

`pnpm seed:users` 只创建 admin/editor/viewer；`pnpm seed:demo` 先完成同样的账号初始化，再初始化五份配置。密码由本地配置提供，没有公共默认值。重复执行保留名称、角色和密码，Actor 使用数据库中 admin 的实际身份。若 admin 已失去全环境写权限，返回 SEED_FORBIDDEN，不重置角色。

首次配置输出 created=5 preserved=0，重跑输出 created=0 preserved=5。固定 ID 识别演示，即使改名/改 Key 也保留。其他 ID 占据尚未创建的演示 Key 时返回 SEED_KEY_CONFLICT，整批新配置回滚。账号步骤独立提交，配置失败后已创建账号仍存在，可以修复冲突后重跑。服务不自动 seed。

| 账号   | Development / Staging    | Production               |
| ------ | ------------------------ | ------------------------ |
| admin  | 读、评估、配置和版本修改 | 读、评估、配置和版本修改 |
| editor | 读、评估、配置和版本修改 | 只读和评估               |
| viewer | 只读和评估               | 只读和评估               |

## 五份示例

| 环境        | Key           | 首次内容                                                                                        |
| ----------- | ------------- | ----------------------------------------------------------------------------------------------- |
| development | demo-checkout | 已启用、默认 false；tier equals blocked 返回 false → country in CN/SG 返回 true → 25% 返回 true |
| staging     | demo-checkout | 已启用、默认 false；country equals CN 返回 false                                                |
| production  | demo-checkout | 已启用、默认 false、无规则                                                                      |
| development | demo-off      | 已停用、默认 true；country equals CN 返回 true，停用优先返回 false                              |
| development | demo-default  | 已启用、默认 true、无规则                                                                       |

首次每份配置为 revision 1，有完整配置版本和真实 admin 创建历史。初始化不伪造编辑、发布或回滚记录。

## 评估与只读演示

viewer 登录，打开 development 的「演示：结账灰度」。查看有序规则、基本信息、r1 完整配置与创建历史；新建、编辑、启停和添加规则不可用。进入运行评估，使用下表输入。结果展示来源、revision 与逐条轨迹；读取/评估不产生配置版本或审计。

| 环境 / Key                  | 用户属性 JSON                                               | 预期结果 / 来源                                 |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| development / demo-checkout | `{"tier":"blocked","country":"CN","user_id":"demo-user-4"}` | false / attribute_rule；首条 false 终止后续命中 |
| development / demo-checkout | `{"country":"CN"}`                                          | true / attribute_rule；in 命中                  |
| development / demo-checkout | `{"user_id":"demo-user-4"}`                                 | true / percentage_rule；固定 bucket 1191 < 2500 |
| development / demo-checkout | `{"user_id":"alice"}`                                       | false / default；固定 bucket 5452，灰度未命中   |
| development / demo-checkout | `{}`                                                        | false / default；缺少属性及 user_id 在轨迹说明  |
| development / demo-off      | `{"country":"CN"}`                                          | false / disabled；默认 true 和规则均不执行      |
| development / demo-default  | `{}`                                                        | true / default                                  |
| staging / demo-checkout     | `{"country":"CN"}`                                          | false / attribute_rule；独立环境配置            |

固定 bucket 由独立 Node crypto 计算，应用层示例回归保护对应评估。普通修改保持 seed；复制/发布应用所选源 seed。改变演示内容后，结果以实际快照为准。

退出后刷新仍显示登录页。editor 登录可编辑 development；切换 production 后只读提示及禁用控件仍可浏览和评估。后端权限负向证据见 [验收映射](coverage.md)。

## 排序、复制、发布与回滚

在新初始化的工作空间使用 editor：

1. 打开 development/demo-default，在「环境流转」选择 r1 和 staging，复制。目标创建 r1；再次复制相同 Key 提示冲突。目标历史保存源环境与 r1。
2. 打开 development/demo-checkout，调整规则顺序；拖拽、↑/↓ 或上移/下移提交完整顺序并生成新 revision。排序影响首条命中，演示结束可从版本页恢复初始 r1，形成另一个新版本。
3. 在 demo-checkout 的「环境流转」明确选择源 r1、目标 staging，查看预览：源为三条规则，目标为单条 CN 返回 false。确认后目标从 r1 生成 r2，CN 改为 true；源继续编辑不改变所选 r1。
4. 到 staging/demo-checkout 的版本页选择 r1，查看完整内容与差异，再确认恢复。目标生成 r3，CN 恢复 false；r1/r2 保留，历史显示被恢复版本。
5. editor 对 production 只能查看。切换 admin 后可将固定源版本发布到 production，并查看目标版本及来源审计。

并发修改后旧预览提交返回 VERSION_CONFLICT；保留所选源版本，刷新差异后重新确认。普通写入、排序、复制、发布与回滚的配置、版本和审计均原子提交。

自动化结果见 [D5 验证记录](../specs/005-demo-and-system-acceptance/verification.md)。本手册是可执行步骤，不把未执行的人工操作标为独立验收证据。
