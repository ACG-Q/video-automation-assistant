# UI 刷新实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将侧边栏和题库管理页面的 UI 从深色主题改为简约明亮风格，同时完善题库页的手动添加表单和卡片选项展示。

**架构：** 新建 `feature/ui-refresh` 分支（从 master 创建），独立于之前的 `feature/question-bank`。侧边栏 CSS 变量值全部替换为明亮色系，题库页面同理。题库页 JS 功能复用之前的逻辑，但手动添加表单改为 textarea 输入选项。

**技术栈：** Chrome Extension MV3, HTML/CSS, Rollup

---

### 任务 1：侧边栏 CSS → 明亮简约

**文件：**
- 修改：`src/sidepanel/sidepanel.html`

CSS 设计系统：

```
背景:     #f8f9fa
卡片:     #ffffff
主色:     #5b6abf
文字主要:  #1a1a2e
文字次要:  #6b7280
边框:     #e5e7eb
阴影:     0 1px 3px rgba(0,0,0,0.06)
圆角:     8px / 12px
间距:     4px 网格
```

新增规则：
- `focus-visible`: `2px solid var(--primary)` + `outline-offset: 2px`
- `prefers-reduced-motion`: 禁用动画
- `aria-live`: toast 添加 `role="status"`

### 任务 2：题库页面 → 明亮简约 + 手动添加表单重构

**文件：**
- 创建：`src/question-bank/question-bank.html`
- 创建：`src/question-bank/question-bank.js`

手动添加表单改为：
```
题目:   [input]
选项:   [textarea, 每行一个选项]
答案:   [input]
题目来源: [input, 默认值 "手动添加"]
[添加] [取消]
```

卡片展示补充选项行：
```
Q: 题目文本
A. 选项一  B. 选项二  C. 选项三  D. 选项四
答案: B
来源: manual
[编辑] [删除]
```

### 任务 3：构建入口 + 侧边栏入口

**文件：**
- 修改：`rollup.config.js` — 新增 question-bank 入口
- 修改：`scripts/build.mjs` — 新增 HTML 复制
- 修改：`src/shared/actions.js` — 新增 `REQUEST_SYNC` / `SYNC_RESULT`
- 修改：`src/background.js` — 新增 `REQUEST_SYNC` 处理
- 修改：`src/sidepanel/sidepanel.js` — 新增 bankBtn + database 图标

### 不做
- 不修改来源分类逻辑
- 不新增数据字段或迁移
- 不包含 version-check 功能
- 不改 config.html / manual-select.html
