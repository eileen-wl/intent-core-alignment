# ICAS Step 9 展示与理解增强方案  
## 基于竞品/同学项目演示的可借鉴点整理

**文档用途：** 跨对话交接与后续实现基线  
**当前项目状态：** Step 8 已完成，真实 ftrack 数据接入已经具备基础条件  
**目标阶段：** Step 9 的定向增强、视觉统一、用户测试与最终 Demo  
**重要边界：** 本文不是重新设计 ICAS，也不授权推翻既有信息架构、角色权限或页面职责

---

# 1. 背景与判断

在查看另一位同学的项目演示后，可以明显看到其页面在以下方面具有较强的“第一眼完成感”：

- 同一页面中展示大量 Anchor、Feedback、Alignment、Evidence、AI interpretation 与 Activity 信息；
- 镜头媒体素材与工作方向并置；
- 对不同部门或角色的当前目标进行集中解释；
- 深色、高密度、多栏式界面带来较强视觉冲击。

但 ICAS 当前的优势并不在于把所有内容堆在一个页面，而在于：

- 有明确的多角色 Workspace；
- 有真实的 Core Anchor / Execution Anchor 生命周期；
- 有 HumanGate、Decision、Activity 与 provenance；
- 有 Review Inbox 的多对象 work-item 架构；
- 有真实持久化数据和后端权限；
- 有真实 ftrack Project / Shot / Task / Version / Review Note 接入基础；
- 有 VFX、CG、Artist 分层职责；
- 有真实 AgentRun、ContextSnapshot 与跨角色 Assessment。

因此，后续不应照搬对方的页面结构，而应：

> **借鉴其“让能力更容易被看见”的方式，把 ICAS 已经存在的真实能力更集中、更直观地表达出来。**

---

# 2. 需要借鉴的四个方向

## 2.1 轻量的 Shot / Version 媒体预览

### 为什么值得借鉴

当用户或评审看到 Anchor、Review Note、Assessment 时，如果页面中完全没有镜头、缩略图或 Version 预览，理解成本会很高。

媒体预览可以让用户快速回答：

- 当前正在讨论哪个 Shot？
- 这个 Version 是什么？
- Feedback 与画面之间有什么关系？
- 为什么这个 Anchor 或 Assessment 有意义？

### 推荐放置位置

优先选择以下其中一个位置，不要在所有页面重复：

1. **VFX Shot Overview**
2. **Versions 页的 Production Version details**
3. 后续 Artist 的 Current Version 页面

### 推荐展示内容

- 当前 Shot 或 Production Version 的缩略图；
- 如果有可播放媒体，则提供轻量播放；
- Version 名称与编号；
- 来源；
- ftrack external link；
- media / thumbnail unavailable 的诚实空状态。

### Step 8 完成后的 ftrack 利用方式

既然 Step 8 已经完成，可以优先检查：

- ftrack Version 是否包含 thumbnail URL；
- 是否能获得 component / media URL；
- 是否能保留 ftrack external entity reference；
- 是否能从 ICAS Version 跳回 ftrack；
- 是否能区分“有媒体”“只有外链”“无媒体”。

### 不要做

- 不要为了演示而虚构媒体；
- 不要开发复杂剪辑器；
- 不要每个页面重复同一个播放器；
- 不要让媒体功能扩大成新的产品主线。

---

## 2.2 Role-aware Working Direction

### 为什么值得借鉴

对方项目中最值得借鉴的不是信息量，而是它会直接告诉用户：

- 我现在要做什么；
- 哪些内容最重要；
- 什么不能改变；
- 什么可以调整；
- 下一步应该做什么；
- 什么情况下要升级。

ICAS 已经拥有这些信息，但目前分散在多个真实对象中。后续可以用一个只读的、角色化的摘要 read model 把它们显性化。

### VFX Shot Overview

建议增加一个紧凑模块：

## Current Creative Direction

- Current creative objective
- What must remain unchanged
- What may vary
- Current risk
- What needs your decision next
- When CG / Artist issues need VFX intervention

#### 数据来源

- active Core Anchor；
- Constraints；
- Variation Zones；
- Drift Risks；
- current focus；
- Cross-role Assessment；
- latest Decision；
- latest Version / Review Note。

### CG Task Overview

建议增加：

## Current Execution Direction

- What this Task must achieve
- Relevant Core Anchor context
- Confirmed execution boundaries
- Production-ready criteria
- Current dependencies
- Latest Version status
- What needs CG action next
- When to escalate to VFX

#### 数据来源

- active Core Anchor；
- active Execution Anchor；
- Task；
- latest Production Version；
- Dependencies；
- CG current focus；
- Review Notes；
- Assessment / escalation。

### Artist Task Overview

建议增加：

## Current Working Direction

- What you are being asked to do
- Why this matters
- What must remain unchanged
- What you may explore
- Latest feedback
- Current Version
- What to do next
- When to ask CG for clarification

#### 数据来源

- Core Anchor summary；
- Execution Anchor；
- Constraints；
- Allowed refinements / Variation Zones；
- latest Review Note；
- Artist guidance；
- current Version。

### 实现原则

这不是新增一个新的 `WorkingDirection` 权威领域对象。

它应该是：

> **从现有真实数据派生出的角色化只读摘要 read model。**

不能让它：

- 取代 Anchor；
- 创建新的权威状态；
- 混淆 Agent 建议与 Human Decision；
- 变成无法追踪来源的静态文案。

---

## 2.3 Production Evidence / Agent Interpretation / Human Decision 分层

### 为什么值得借鉴

对方演示中把 Evidence、AI interpretation 与其他说明分开，因此观众比较容易理解不同信息的来源。

ICAS 更适合使用三层结构：

```text
Production Evidence
Agent Interpretation
Human Decision and Provenance
```

### A. Production Evidence

显示真实生产事实：

- Core Anchor；
- Execution Anchor；
- Production Version；
- Review Notes；
- source / ftrack linkage；
- role outputs；
- dependency；
- previous human feedback；
- related media / thumbnail。

这部分回答：

> 实际发生了什么？系统正在依据什么？

### B. Agent Interpretation

显示 advisory 分析：

- observations；
- inferences；
- agreements；
- tensions；
- drift risks；
- local-optimum risks；
- open questions；
- recommendations；
- confidence；
- evidence references；
- AgentRun / model / prompt provenance。

这部分回答：

> Agent 如何解释这些制作事实？

### C. Human Decision and Provenance

显示权威判断：

- HumanGate；
- Decision；
- actor；
- human role；
- rationale；
- confirmed / rejected / acknowledged；
- superseded Decision；
- timestamp；
- resulting state；
- write-back request status。

这部分回答：

> 最终由谁作出了什么决定？为什么？它改变了什么？

### 推荐应用页面

优先用于：

- VFX Alignment；
- VFX Intent；
- CG Execution；
- CG Version Review；
- Artist Feedback History；
- 最终 Demo 的关键决策页面。

### 不建议直接加入产品的内容

不建议在生产工作区里直接展示论文或研究访谈作为 `Research Evidence`。

研究证据更适合：

- Evidence Deck；
- 项目文档；
- Evaluation report；
- 作品集说明。

产品内部主要显示 production evidence，除非某条研究资料本身就是正式 reference。

---

## 2.4 Department Execution Overview

### 为什么值得借鉴

对方项目通过 Animation / Compositing / Layout 等部门切换，让观众直观看到：

> 同一个创作方向如何被不同部门理解和执行。

ICAS 不应复制这种直接部门 tab，因为 ICAS 已经有更严谨的结构：

```text
Shot
→ Tasks
→ 每个 Task 的 Execution Anchor
```

但 VFX Supervisor 仍然需要一个跨部门概览。

### 推荐模块

在 VFX Shot Overview 或 Alignment 增加：

## Department Execution Overview

每个 Task / Department 显示：

- Department / Task name
- Execution Anchor state
- Latest Production Version
- Current focus
- Open dependency
- Current alignment concern
- Escalation status
- Last updated time

示例：

```text
Compositing
Execution Anchor: Confirmed
Latest Version: v4
Current concern: Contrast drift
Open dependency: None

Animation
Execution Anchor: Confirmed
Latest Version: v7
Current concern: None

FX
Execution Anchor: Draft
Current concern: Awaiting CG confirmation
```

### 交互方式

点击某个 Task 后：

- 进入对应 CG Task 的只读上下文；
- 或打开与该 Task 相关的 Alignment / Assessment；
- 不能让 VFX 在这里直接编辑 Execution Anchor；
- 不应把 CG Workspace 嵌套到 VFX 页面。

### 数据来源

- Tasks；
- Execution Anchors；
- Production Versions；
- Dependencies；
- Assessments；
- Review Inbox work-item；
- ftrack linkage。

---

# 3. Step 8 已完成后，可直接利用的 ftrack 数据

既然 Step 8 已完成，后续增强应优先复用真实 ftrack 数据，而不是继续增加 Demo-only 信息。

建议检查并利用：

## Project / Shot / Task

- ftrack external ID；
- name；
- source；
- parent relationships；
- deep link；
- sync metadata。

## Production Version

- Version name / number；
- description；
- source；
- related Task / Shot；
- created time；
- creator；
- ftrack external link；
- thumbnail / media availability；
- sync state。

## Review Note

- Note content；
- author；
- time；
- target Version；
- source；
- external link；
- review context。

## Media

按诚实程度分成：

1. Real playable media；
2. Real thumbnail；
3. ftrack external link；
4. No media available。

禁止因为 Step 8 已经接入 ftrack，就默认声称所有 Version 都能在 ICAS 内播放。

---

# 4. 推荐后续顺序

```text
Step 8 已完成
        ↓
Step 9A：端到端功能、权限与真实数据验证
        ↓
Step 9B：展示与理解增强
        ├── Media preview
        ├── Working Direction
        ├── Evidence / Agent / Human Decision 分层
        └── Department Execution Overview
        ↓
Step 9C：Design skill 全平台视觉统一
        ↓
Step 9D：学生可用性测试
        ↓
Step 9E：Synthetic role evaluation
        ↓
Step 9F：最终 Demo、录屏、Evidence Deck 与作品集
```

---

# 5. 实现优先级

## Priority 1：必须优先

1. Role-aware Working Direction
2. Evidence / Agent / Human Decision 分层
3. Department Execution Overview

这些主要复用现有数据，能够明显增强系统理解。

## Priority 2：有真实数据时做

4. Shot / Version thumbnail
5. ftrack deep link
6. media unavailable state

## Priority 3：只有时间充足时做

7. 内嵌视频播放
8. 更复杂的媒体比较
9. 跨 Version 视觉 diff

---

# 6. 明确不借鉴的内容

## 6.1 工作区顶部直接切换角色

ICAS 保持：

```text
Role-selection Home
→ 进入单一 human role workspace
→ Exit role view
→ 重新选择角色
```

原因：

- 符合真实权限；
- 避免一个人随意扮演多个角色；
- 便于测试 Role boundary；
- 与 ftrack identity / role resolution 更一致。

## 6.2 将所有内容塞入一个超长 Shot 页面

ICAS 保持：

### VFX Shot

- Overview
- Intent
- Versions
- Alignment
- Activity

### CG Task

- Overview
- Execution
- Version Review
- Dependencies
- Activity

### Artist

继续使用角色任务层级，而不是把三个角色内容放在一个页面。

## 6.3 为了显得丰富而重复同一信息

不应：

- 在多个页面复制完整 Anchor；
- 用静态文本制造“功能很多”；
- 每个页面都放同一段 Working Direction；
- 重复显示同一 Assessment；
- 混淆 Production Version 与 Anchor Revision。

## 6.4 让 AI Recommendation 与 Human Decision 混在一起

必须继续保持：

```text
Agent output = advisory
HumanGate = requires human authority
Decision = authoritative human result
```

## 6.5 伪造 ftrack / media 完整度

不应：

- 用 `Live ftrack` 标签代替真实数据链路；
- 有 external link 就声称“已完整媒体同步”；
- 无法播放时仍展示假播放器；
- 将 Demo seed 当真实 ftrack 数据。

---

# 7. 完成后的体验目标

用户进入任何一个核心 Workspace，都应该能在较短时间内回答：

1. 我现在在哪个 Project / Shot / Task？
2. 当前权威方向是什么？
3. 哪些内容必须保持？
4. 哪些内容可以变化？
5. 当前 Version / Feedback 是什么？
6. Agent 发现了什么？
7. 哪些只是建议？
8. 哪些已经由人类确认？
9. 我当前应该做什么？
10. 什么情况下需要升级给其他角色？
11. 当前数据是否来自 ftrack？
12. 我能否看到相关媒体、缩略图或外部来源？

---

# 8. 验收标准

## Media preview

- [ ] 使用真实 ftrack / ICAS Version 数据
- [ ] 无媒体时显示诚实状态
- [ ] 不影响主流程
- [ ] 不重复占据多个页面
- [ ] external link 可追踪

## Working Direction

- [ ] 根据角色显示不同内容
- [ ] 每条信息能追溯到真实对象
- [ ] 不创建新的权威状态
- [ ] 不覆盖 Anchor
- [ ] 不把 Agent 建议写成事实
- [ ] 下一步动作与当前权限一致

## Evidence layering

- [ ] Production Evidence 与 Agent Interpretation 分离
- [ ] Human Decision 独立展示
- [ ] actor / role / time / rationale 可见
- [ ] AgentRun / evidence references 可追溯
- [ ] Decision supersession 可见
- [ ] 不在产品里混入未经授权的研究资料

## Department overview

- [ ] 使用真实 Task / Execution Anchor 数据
- [ ] 能看出不同部门状态
- [ ] VFX 只能查看或导航，不越权编辑 CG 对象
- [ ] 与 Review Inbox / Alignment / Task Workspace 链接正确
- [ ] 空状态诚实

---

# 9. 给下一对话的执行说明

请在继续实现前：

1. 先检查 Step 8 的最终报告与真实 ftrack 数据模型；
2. 确认现在能获得哪些 Version、Review Note、external link、thumbnail 或 media 字段；
3. 重新检查 Step 7 的最终 VFX / CG / Artist route map；
4. 不要推翻现有 IA；
5. 不要重新合并角色工作区；
6. 不要新增一个权威 `WorkingDirection` 表；
7. 优先做 read model 与展示层；
8. 所有 Agent 内容继续保持 advisory；
9. 所有 Human Decision 继续由正确人类角色完成；
10. 每次实现前明确当前是在 Step 9A、9B、9C、9D、9E 还是 9F。

---

# 10. 最终定位

这次借鉴的核心不是：

> “对方页面信息很多，所以 ICAS 也要增加更多功能。”

而是：

> **ICAS 已经具备更完整的角色架构、权限、状态、真实数据和 provenance。后续需要做的是让这些能力在页面中更容易理解、更容易被评审看见，并通过真实 ftrack 数据、媒体上下文和角色化摘要形成更强的 Demo 叙事。**
