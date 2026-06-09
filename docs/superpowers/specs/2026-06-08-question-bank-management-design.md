# 题库管理页面设计规格

## 概述
新增独立页面 `question-bank.html`，提供完整的题库浏览、搜索、编辑、删除、导入导出、远程同步和手动添加功能。

## 架构

```
src/question-bank/
├── question-bank.html    # 页面骨架（暗色主题 CSS 嵌入）
└── question-bank.js       # 全部逻辑，rollup 打包到 dist/question-bank.js
```

- 独立页面模式，遵循现有 `config.html` 模式
- 所有 CRUD 操作直接通过 `chrome.storage.local` 完成
- 远程同步通过 `sendMessage` 走 background 中转
- 新增 actions: `REQUEST_SYNC` / `SYNC_RESULT`

## 功能清单

| # | 功能 | 实现方式 |
|---|------|----------|
| 1 | 题目列表 | 分页卡片列表，显示题目标题(截断)、答案、来源、日期 |
| 2 | 搜索过滤 | 输入框即时按标题/关键词过滤 |
| 3 | 编辑答案 | 行内展开修改，确认后写入 storage |
| 4 | 删除单题 | 二次确认后删除 |
| 5 | 清空题库 | 二次确认后清空 |
| 6 | 导出 JSON | `loadQuestionBank()` → `Blob.download` |
| 7 | 导入 JSON | 文件上传 → 解析 → 按 hash 去重合并 → 保存 |
| 8 | 远程同步 | 读取 config.bankUrl → `REQUEST_SYNC` → background → `SYNC_RESULT` |
| 9 | 手动添加 | 表单：标题 + 选项(A-F 可动态增减) + 答案选填 → 计算 hash 写入 |
| 10 | 统计栏 | 总题数、各来源分布 |

## 数据流

### CRUD 操作（直接读写 storage）
```
页面初始化 → loadQuestionBank() → 渲染列表
用户编辑/删除/添加 → 更新内存数组 → saveQuestionBank() → 重渲染
```

### 远程同步（中转 background）
```
页面 → sendMessage(REQUEST_SYNC) → background
  → background 读取 config.bankUrl → fetch() → syncRemoteQuestionBank()
  → sendMessage(SYNC_RESULT, { added, total }) → 页面
```

### 导入导出（页面内 File API）
```
导出: JSON.stringify(bank) → new Blob() → URL.createObjectURL → <a>.download
导入: <input type=file> → FileReader → JSON.parse → 按 hash 去重合并 → save
```

## 页面布局

```
┌──────────────────────────────────────────┐
│  题库管理    ← 标题                      │
│  [搜索框]    ← 过滤                      │
├──────────────────────────────────────────┤
│  总题数: 123  |  来源: 本地 98  远程 25  │  ← 统计栏
├──────────────────────────────────────────┤
│  ┌─ 题目卡片 ──────────────────────────┐ │
│  │ Q: 根据资料判断...  (展开编辑按钮)    │ │
│  │ A: B. 市场经济  [删除]               │ │
│  │ 来源: config | 2026-06-08            │ │
│  ├───────────────────────────────────────┤ │
│  │ (点击展开编辑区)                       │ │
│  └───────────────────────────────────────┘ │
│  ┌─ 题目卡片 ──────────────────────────┐ │
│  │ ...                                  │ │
│  └───────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│  [同步] [导出] [导入] [手动添加] [清空]    │  ← 操作栏
└──────────────────────────────────────────┘
```

## 新增 Actions

```js
// sidepanel/page → background
REQUEST_SYNC: 'requestSync',

// background → sidepanel/page
SYNC_RESULT: 'syncResult',
```

## 约束
- 暗色主题，风格与 config.html / sidepanel.html 一致
- 所有确认操作使用 `confirm()` 而非自定义弹窗（保持轻量）
- 导入去重规则：按 `questionId` (sha256 hash) 判断，已存在则跳过
- 手动添加的题目 `source` 字段值为 `"manual"`
