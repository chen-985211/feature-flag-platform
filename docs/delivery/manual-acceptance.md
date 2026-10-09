# 人工验收指南

面向第一次接触项目的验收者，按顺序操作即可。对应 [question.md](../../question.md) 的必做功能和已约定扩展；每节写明输入、操作和预期结果。功能语义归 [验收要求](acceptance.md) 与上下文文档，本指南只组织操作步骤。标准演示数据见 [演示手册](demo.md)。

已有可用实例时，从第 2 步开始，使用运行者提供的账号密码；自行运行时先完成第 1 步，新建账号可直接使用 [环境模板](../../.env.example) 中的本地演示密码。

## 1. 启动并确认可用

本机先安装并运行 PostgreSQL 17，准备 Node 24.21.0、pnpm 10.33.0、Go 1.27.0。在项目根目录操作；新 checkout 首次执行：

```sh
pnpm install --frozen-lockfile
cp .env.example .env
createdb didi_development
```

已有 `.env` 或数据库时跳过对应创建步骤，保留原内容。按本机认证修改 DATABASE_URL。

> **环境模板已提供三个可直接用于本地演示的初始化密码：**
>
> - `SEED_ADMIN_PASSWORD`：admin 的初始化密码。
> - `SEED_EDITOR_PASSWORD`：editor 的初始化密码。
> - `SEED_VIEWER_PASSWORD`：viewer 的初始化密码。
>
> 复制模板后可直接使用其中的密码，或在 `.env` 中修改；部署时替换示例密码。每项须为 8～72 字节，任一项为空或长度不符合要求，命令会报 `DEMO_PASSWORD_REQUIRED` 并停止。Node 会自动读取 `.env`，无需手动 `export`。

已有账号使用其实际密码；修改 SEED_*_PASSWORD 后重跑初始化不会重置已存在的账号密码。

```sh
HTTP_ADDR=127.0.0.1:8080 APP_ORIGIN=http://127.0.0.1:8080 pnpm demo
```

保持此终端运行，打开 http://127.0.0.1:8080。使用其他端口时同时修改 HTTP_ADDR、APP_ORIGIN 和访问地址；由他人运行时使用对方提供的地址。此实例连接普通开发数据库，正常退出不会删除数据。

另开终端检查：

```sh
curl --fail http://127.0.0.1:8080/health/live
curl --fail http://127.0.0.1:8080/health/ready
```

预期：显示登录页；两个端点均成功，ready 返回 `{"status":"ready"}`。首次初始化创建五份示例，已有数据则保留；不要以列表总数作为通过条件。

## 2. 登录、新建、搜索与校验（F01、F11）

1. 使用 admin 和其初始化密码登录，进入「功能配置」。顶部环境选择 Development。
2. 本轮使用独立 Key，例如 `review-20261008-abc`，下文简称 K。每位验收者/每次重跑换一个未使用的后缀，后续所有输入都替换为自己的 K。
3. 点击「新建 Flag」，先留空名称尝试保存。预期：提示必填，未创建配置。再填写名称「验收：结账开关」、Key 为 K，勾选「启用配置」「默认返回 true」，点击「保存配置」。
4. 预期：打开新配置详情；development、K、已启用、默认 true、revision 1、创建/更新时间可查看。「版本」有 r1，「操作历史」有「创建配置」及真实 admin 操作者。
5. 返回列表，分别用名称和 K 搜索，应找到该配置；搜索一个不存在的名称，应显示空状态。清空搜索、选择「已启用」，该配置应在列表中。
6. 再尝试创建同一 development/K，预期提示「当前环境已存在相同 Key」，已有配置不变。取消弹窗，后续继续打开原配置。

记录 K 和详情地址。新建/编辑通过弹窗完成，覆盖题面对应页面范围。

## 3. 基本编辑、默认值与启停（F01、F02、F03）

1. 从详情点击「运行评估」，确认顶部仍为 Development，Flag Key 为 K，用户属性 JSON 输入 `{}`，点击「运行评估」。预期 true /「默认值」，使用默认值为「是」、命中规则为「无」。
2. 返回 K 的详情，「基本信息」→「编辑基本信息」；名称改为「验收：结账开关已编辑」，取消「默认返回 true」，保存。预期名称/默认值更新、revision 加一；刷新页面仍是保存后的内容。
3. 再评估 `{}`，预期 false /「默认值」，revision 与当前详情一致。
4. 返回详情点击「停用配置」，评估 `{}`，预期 false /「配置已停用」，使用默认值为「否」。回列表用「已停用」筛选应找到 K。
5. 在详情点击「启用配置」，恢复已启用。后续步骤均使用该状态、默认 false。

每次成功配置写入都增加 revision，并新增一个版本和一条历史；纯读取/评估和失败提交不增加。

## 4. 属性规则、首条命中与错误反馈（F02、F03）

详情「规则」→「添加规则」，规则类型选择「属性规则 · equals / in」。按表逐条填写并保存；期望值是 JSON，字符串必须带双引号。

| 规则 | 属性名称 | 操作符 | 期望值 JSON            | 优先级 | 命中返回 true |
| ---- | -------- | ------ | ---------------------- | ------ | ------------- |
| A    | tier     | equals | `"blocked"`            | 1      | 不勾选        |
| B    | country  | equals | `"CN"`                 | 2      | 勾选          |
| C    | plan     | in     | `["pro","enterprise"]` | 3      | 勾选          |

预期：按 1→2→3 显示，数字越小越先执行。再次添加优先级 2 的合法规则，应提示「优先级已被其他规则使用」，原三条规则、revision、版本/历史数量均不变；取消失败表单。

进入 K 的评估控制台，逐项输入：

| 用户属性 JSON                       | 预期返回/来源            | 其他观察                       |
| ----------------------------------- | ------------------------ | ------------------------------ |
| `{"tier":"blocked","country":"CN"}` | false / 属性规则命中     | 命中 A；后续即使能命中也不执行 |
| `{"country":"CN"}`                  | true / 属性规则命中      | 命中 B                         |
| `{"plan":"pro"}`                    | true / 属性规则命中      | 命中 C，in 生效                |
| `{"country":"cn"}`                  | false / 默认值           | 大小写不隐式转换               |
| `{}`                                | false / 默认值           | 缺少属性不命中，轨迹可查看     |
| `{"country":123}`                   | false / 默认值           | 数字不与字符串匹配             |
| `{"country":`                       | 合法 JSON 对象的错误提示 | 不显示本次成功结果             |
| `[]`                                | 合法 JSON 对象的错误提示 | 顶层数组被拒绝                 |

把 Key 临时改成一个未创建的值，例如 K 后面加 `-missing`，输入 `{}` 运行；预期「配置不存在」。随后将 Key 恢复 K。

返回规则页，编辑 B，将期望值改成 `"SG"` 并保存；CN 应返回默认 false，SG 应返回 true。再将 B 恢复 `"CN"`。删除 C 时先「删除规则」→「确认删除」；刷新后 C 消失，`{"plan":"pro"}` 返回默认 false。此时只保留 A、B，供后续验收。

## 5. 操作历史与版本记录（F04、F06）

打开 K 的「操作历史」，应看到此前实际完成的创建、基本编辑、启用/停用、添加/编辑/删除规则，带时间、操作者与 revision。「查看变更详情」可以展开变更内容；首次配置版本及旧记录仍保留。

默认摘要应直接说明发生的变化；展开后是业务内容的前后对比。技术排查时再点「查看原始数据」，检查排版后的完整 JSON，并用「复制原始数据」复制；成功/失败均有反馈。操作者应与原始历史一致。

打开「版本」，选一个旧 revision，查看当时名称、启停、默认值和完整规则。该快照应反映对应操作时的状态。失败的重复 Key/优先级以及评估请求没有额外版本或成功历史。

这里是页面观察；事务失败时配置/版本/审计全部回滚的严格证明由第 13 步真实 PostgreSQL 集成测试提供。

## 6. 拖拽及替代排序（F08）

1. 在「规则」点击「调整规则顺序」，将 B 的移动手柄拖到 A 上方。等待「规则顺序已保存」。预期 B 为优先级 1、A 为 2，revision 加一；刷新后顺序保留。
2. 评估 `{"tier":"blocked","country":"CN"}`，预期 true / 属性规则命中：B 先命中。
3. 回排序区，用「上移」按钮把 A 移回第一。预期相同输入恢复 false，顺序保存。
4. 可用 Tab 聚焦移动手柄，空格开始、方向键移动、Escape 取消；取消后顺序和 revision 不变。键盘确认及上移/下移与拖拽遵守相同保存规则。

后续保持 A→B。

## 7. 百分比灰度（F05）

添加一条「百分比灰度」规则，用户比例 (%) 为 25、优先级为 3、勾选命中返回 true。评估时让属性规则不命中，使用 `{"user_id":"review-user"}`。

| 操作/输入                                                | 预期                                              |
| -------------------------------------------------------- | ------------------------------------------------- |
| 25% 下连续运行同一输入三次                               | 返回值及命中来源一致；单个用户可命中也可不命中    |
| 25% 下输入 `{}`                                          | 默认 false，灰度轨迹说明缺少 user_id              |
| 25% 下输入 `{"user_id":123}`                             | 默认 false，灰度轨迹说明 user_id 必须为非空字符串 |
| 编辑比例为 100，再输入 `{"user_id":"review-user"}`       | true / 百分比规则命中；25% 时已命中的用户仍命中   |
| 100% 下输入 `{"tier":"blocked","user_id":"review-user"}` | false / 属性规则命中，停在 A，不继续计算灰度      |

记下 100% 保存后的 revision，简称 R100。然后将比例改为 0，同一 user_id 应返回 false / 默认值。不要要求随机创建配置的某个指定用户在 25% 必须命中，也不要用少量用户的实际命中数作为比例正确性的判断标准；精确分桶/扩量不变量由自动化测试证明。

## 8. 完整版本回滚（F06）

1. 当前灰度为 0%；打开「版本」，在「选择版本」选此前记录的 R100。
2. 预期：完整配置显示 A、B 和 100% 灰度；差异显示当前与该版本的比例变化。确认名称、默认值、启用和规则顺序也属于快照。
3. 点击「回滚到 r…」→「确认回滚」。预期：生成一个更大的新 revision，恢复 100%，旧 R100 与 0% 版本均保留，历史新增回滚记录。
4. 评估 `{"user_id":"review-user"}` 应返回 true / 百分比规则命中，结果显示新 revision；blocked 输入仍返回 A 的 false。

## 9. 跨环境复制、固定版本发布（F09、F10）

使用 admin。记录当前 development/K 的 revision 为 S，此时灰度 100%。

1. 详情「环境流转」：操作方式选「复制到新环境配置」，源版本 S、目标环境 staging，点击「确认复制」→「查看目标配置」。预期 staging/K 为 r1，含相同基本内容、规则顺序和灰度；development/K 独立存在，证明不同环境可用相同 Key。
2. 返回 development/K，再复制到 staging。预期冲突，原 staging 仍为 r1，未被覆盖。
3. 在 development/K 将灰度改为 0，记该 revision 为 S0。再将灰度改回 100，并将名称改为「验收：后续源修改」；这些是 S0 之后的新版本。
4. 在 development「环境流转」选「发布到已有配置」，源版本明确选择历史 S0，目标 staging。预期「源版本完整配置」和「发布差异」显示 S0 的 0%，目标当前 100%。
5. 点击「确认发布」→「查看目标配置」。预期 staging 从 r1 增加为 r2、灰度为 0%、名称取 S0 时的名称；development 当前仍为 100% 和后续名称。目标保留原身份及自己的历史，没有采用最新源配置覆盖所选历史版本。
6. staging/K 评估 `{"user_id":"review-user"}` 返回默认 false；历史有复制和发布，发布变更详情记录源环境/源 revision S0。若查看 development/K，同一输入仍为灰度 true。
7. 使用 admin 将 development/K 当前版本复制到 production，供第 11 步验证权限。三环境同 Key 是三份配置；不要修改别人的 production 示例。

## 10. 并发编辑冲突（F07）

1. 使用同一 admin，在两个标签页打开 development/K；刷新至相同 revision，两边都打开「编辑基本信息」弹窗，确认表单「基于 revision」相同。
2. A 标签名称改为「验收：A 已保存」并成功保存。
3. B 标签保持旧弹窗，不刷新；名称改为「验收：B 旧输入」并保存。
4. 预期 B 提示「配置已被更新，本地输入已保留，请查看最新版本」，旧输入保留；重新读取配置仍为 A 的名称，revision/版本/成功历史只增加 A 那一次。
5. B 可取消，或点击「加载最新版本」；后者明确用新配置替换本地输入。不要把旧输入再次提交覆盖 A。

## 11. 三角色权限与退出（F11）

通过顶部「退出」切换账号，使用各自配置的密码。

| 账号   | 操作                                                         | 预期                                  |
| ------ | ------------------------------------------------------------ | ------------------------------------- |
| viewer | 查看 development/K、规则、版本、历史并运行评估               | 可以读取和评估                        |
| viewer | 尝试新建、编辑、启停、排序、回滚及确认复制/发布              | 写入口禁用或不可用，有只读提示        |
| editor | 将 development/K、staging/K 名称分别改为「验收：编辑者更新」 | 可保存，新增历史的操作者为真实 editor |
| editor | 切换 production/K；查看、评估、尝试上述配置写入              | 可读/评估，全部写入入口只读           |
| admin  | 将 production/K 名称改为「验收：管理员更新」                 | 可以保存，新增真实 admin 操作历史     |

任意账号点击「退出」后刷新页面，预期仍要求登录。后端独立授权、会话过期、CSRF 和 production 各写接口拒绝的严格证据见自动化测试，本步骤不把前端禁用当作后端授权证明。

## 12. 重启与数据库持久化（F01、F04、F06）

在 development/K 记录当前名称、revision、规则及顺序、版本/历史数量，并保存 `{"user_id":"review-user"}` 的评估结果。

自行启动的实例：在第 1 步服务终端按 Ctrl+C，再执行同一 demo 启动命令。已有共享实例由运行者完成这一操作，验收者不停止别人的服务。

重新登录、按 K 搜索并打开详情：预期配置、规则、全部版本/历史和评估返回值/来源相同；revision 和数量不因为初始化/重启增加。账号及密码保留，旧时间与历史不被重建。

需要独立核对数据库时，按 DATABASE_URL 的配置连接同一个库。下面以本机默认 didi_development 为例，先进入 `psql didi_development`，将 SQL 中示例 Key 换为自己的 K：

```sql
SELECT environment, name, key, enabled, default_value, revision
FROM flags WHERE key = 'review-20261008-abc' ORDER BY environment;

SELECT f.environment, r.priority, r.kind, r.attribute, r.operator,
       r.expected, r.percentage_bp, r.result
FROM rules r JOIN flags f ON f.id = r.flag_id
WHERE f.key = 'review-20261008-abc' ORDER BY f.environment, r.priority;

SELECT f.environment, f.revision,
       count(DISTINCT v.revision) AS versions,
       count(DISTINCT a.id) AS history
FROM flags f
JOIN flag_versions v ON v.flag_id = f.id
LEFT JOIN audit_entries a ON a.flag_id = v.flag_id AND a.revision = v.revision
WHERE f.key = 'review-20261008-abc'
GROUP BY f.id ORDER BY f.environment;
```

预期：实际数据库行与页面一致，三环境有各自的 revision/版本/历史，重启前后配置数据不变。无需导出用户、密码哈希或会话表。

## 13. 自动化和最终 CI 验收（F12、F13）

人工主要功能完成后，工程验收者在已安装依赖的项目根目录准备独立测试库。仅首次创建时执行 `createdb didi_test`，配置 TEST_DATABASE_URL，库名以 `_test` 结尾并与 DATABASE_URL 分离。

```sh
pnpm tools:install
pnpm --dir frontend exec playwright install chromium
E2E_PORT=18190 pnpm verify:full
```

预期命令退出 0，包括静态检查、Go/前端 unit、component、contract、真实 PostgreSQL integration、构建、race 和四条 Playwright。测试自建/清理临时 schema，不修改人工验收数据；18190 必须空闲。输出和失败排查见 [测试执行手册](../testing/TESTING_RUNBOOK.md)，覆盖责任见 [证据映射](coverage.md)。已有运行结果只能证明对应提交，不能将其当作本次人工步骤已执行。

Docker/远端 CI 已在提交 ee5cf60 上实际通过 verify:full 和 test:docker，F13/D6 的对应结果见 [D6 记录](../specs/006-container-delivery/verification.md)。核对待验收提交的 [Verify 工作流](https://github.com/chen-985211/feature-flag-platform/actions/workflows/verify.yml)，确认原生与容器步骤均为 success；后续代码变化需要对应的新结果。容器启动、持久化和备份恢复操作见 [容器手册](docker.md)。

## 验收记录模板

复制此表记录本次结果；未执行保持「待验」，不预先标为通过。记录提交号、访问地址、K、执行人/日期以及失败步骤和实际现象，账号密码不写进记录。

| 步骤 | 验收项                    | 结果（待验/通过/失败） | 备注/证据 |
| ---- | ------------------------- | ---------------------- | --------- |
| 1    | 启动、登录页、健康        | 待验                   |           |
| 2    | 新建、搜索、环境 Key 唯一 | 待验                   |           |
| 3    | 基本编辑、默认值、启停    | 待验                   |           |
| 4    | 属性规则、增删改与错误    | 待验                   |           |
| 5    | 真实历史与完整版本        | 待验                   |           |
| 6    | 拖拽/按钮/键盘排序        | 待验                   |           |
| 7    | 灰度稳定性及边界          | 待验                   |           |
| 8    | 完整回滚与旧历史保留      | 待验                   |           |
| 9    | 复制、冲突、固定源发布    | 待验                   |           |
| 10   | 并发冲突、无覆盖          | 待验                   |           |
| 11   | 三角色权限与退出          | 待验                   |           |
| 12   | 重启及 PostgreSQL 持久化  | 待验                   |           |
| 13   | 原生自动化门禁            | 待验                   |           |
| CI   | 实际 Docker/远端 CI       | 待验                   |           |
