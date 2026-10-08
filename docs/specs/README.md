# 大任务 Spec 与 Plan 归档

流程与授权由 [开发规范](../engineering/development.md) 维护。本目录存放具体 Large 的规格、实现计划与验证证据。当前 [工程基础 Spec](001-engineering-foundation/spec.md)、[Plan](001-engineering-foundation/plan.md) 和 [验证记录](001-engineering-foundation/verification.md) 已建立，D1 已完成。

## 目录

```text
docs/specs/
  README.md
  001-engineering-foundation/
    spec.md
    plan.md
    verification.md
  002-core-configuration/
    spec.md
    plan.md
    verification.md
  003-percentage-and-versions/
    spec.md
    plan.md
    verification.md
  004-ordering-and-environments/
    spec.md
    plan.md
    verification.md
```

001 已完成；002 已完成，见 [Spec](002-core-configuration/spec.md)、[Plan](002-core-configuration/plan.md) 和 [验证记录](002-core-configuration/verification.md)。编号单调增加，名称表达业务/工程目标，不使用临时聊天标题；任务完成状态以对应验证记录为准。

## 生命周期

- Spec：草案 → 已确认 → 实施中 → 已验收/部分完成。
- Plan：草案 → 已确认/已授权执行 → 实施中 → 已验证。
- 确认记录注明用户指令/既有决策来源，复用已有授权，不虚构签字或强迫重复审批。
- 需求变化先更新对应 Spec 与影响记录，再更新 Plan；状态与实际代码/测试证据保持一致。
- 未解决且会改变核心语义的事项不能在实施时偷偷选择；其他独立步骤可以继续。

## 关联与证据

Spec 使用稳定验收 ID，并关联 [交付编号](../delivery/acceptance.md)。Plan 每步写明目标层、测试层、Red 行为和退出条件。verification 记录实际命令、结果、未运行原因、对应工作区/提交版本以及剩余风险。

使用 [Spec 模板](../templates/spec.md) 和 [Plan 模板](../templates/plan.md)。Small 不强制新建归档文件，必要过程摘要写入 AI 操作记录。

## D3 百分比与版本

[Spec](003-percentage-and-versions/spec.md)、[Plan](003-percentage-and-versions/plan.md)、[验证记录](003-percentage-and-versions/verification.md)。基于用户继续指令完成实施与本地验收。

## D4 排序与环境流转

[Spec](004-ordering-and-environments/spec.md)、[Plan](004-ordering-and-environments/plan.md)、[验证记录](004-ordering-and-environments/verification.md)。基于用户继续指令完成实施与本地验收。
