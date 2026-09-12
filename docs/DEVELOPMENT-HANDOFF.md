# 班里手记开发交接

日期：2026-09-12。不含密钥、真实儿童信息或数据库内容。

## 入口

| 项 | 值 |
| --- | --- |
| 日常主目录 | `/Users/xiaoruirui/Downloads/班里手记` |
| 微信开发者工具导入 | `/Users/xiaoruirui/Downloads/班里手记/miniprogram` |
| GitHub | https://github.com/qiushuji2077/kindergarten-eval |
| 当前分支 | `main`（跟踪 `origin/main`） |
| 功能合并 | [PR #3](https://github.com/qiushuji2077/kindergarten-eval/pull/3) 已合入，含筛选/保存实录/去掉旧网页运行树 |
| 已关闭 | [PR #1](https://github.com/qiushuji2077/kindergarten-eval/pull/1) 随 #3 合并；[PR #2](https://github.com/qiushuji2077/kindergarten-eval/pull/2) 已关闭（README 已被 1.2 说明取代） |
| AppID | `wx8e8daba1d8b01cc5`（与老师工具箱历史共用） |
| 云环境 ID | `cloud1-d0gos8gobac3c3623`（代码中的现有值，未改线上） |

Cursor 工作区已切到新主目录。

## 怎样运行

```bash
cd "/Users/xiaoruirui/Downloads/班里手记"
node --version   # 本轮实际为 v26.7.0；说明写的是 22，未改全局环境
npm test
npm run check
node scripts/build-preview.js
```

打开 `preview/index.html` 只看版式。用开发者工具导入 `miniprogram/` 才是原生运行。

示例路径：进入示例 → 写观察（可先点保存实录）→ 手记列表回看 → 请 AI 找线索 → 教师采纳/调整/仅留实录 → 回看页汇总 → 生成 Word。

## 本轮代码改动

- 运行树去掉旧网页 `client/`、`server/` 和未使用的 1.1 `common.wxss`。
- 手记页增加孩子、日期筛选，读取前过滤，与回看/导出同一套 `observations` 范围；关键词仍只搜索已读到的条目。
- 写观察：主按钮改为「保存实录」；键盘 `cursor-spacing` / `hold-keyboard`；保存条说明可稍后看线索。
- 关于页：退出并切换身份；当前示例/真实班级状态分开写清。
- 字号与长文本换行、空状态、错误提示略放大；语音附件与自动转文字在发送前预览中再次区分。
- 测试由 52 项增至 55 项（筛选与范围），原断言未放宽。
- 上线说明改为 1.2 准备稿，去掉「整包覆盖已上传 1.1」的过时指引。

`archive-local/` 只在本机，已 gitignore。

## 两个产品共用 AppID 的发布方案（需确认后才执行）

本地整理**不会**切换线上产品。需要负责人先在微信公众平台看清楚：

1. 当前**正式版**实际是老师工具箱还是 1.1 观察记录。
2. 当前**开发版**上传的是哪一份代码。
3. 云环境 `cloud1-d0gos8gobac3c3623` 里 `noticeService` / `evalService` 是否仍为旧实现。

建议顺序（均需确认）：备份现网 → 独立开发环境编译 1.2 → 上传同版本 `noticeService` 与 `evalService`（或下线后者）→ 建 `banli_*` 集合且客户端不可读写 → 保持 `BANLI_FORMAL_ENABLED=false` → 真机虚构数据验收 → 再决定是否提审。不要用本目录直接覆盖现网。

真实班级开关保持关闭。不要迁移旧儿童数据。

## 回滚

- Git：`git revert` 合并提交，或将 `main` 回退到合并前的 `a520820`（须负责人确认，不使用强推除非明确要求）。
- 线上：GitHub 合并不会改微信现网；现网回滚仍取决于公众平台里当前版本。
- 旧目录：废纸篓还原。

## 剩余问题

- 微信开发者工具 CLI 报「需要重新登录」，本轮未能原生编译、预览或真机。
- 真实云函数、安全规则、混元调用、媒体权限、Word 真机排版未测。
- GitHub 已合并并推送；未上传小程序代码、未提交审核。
