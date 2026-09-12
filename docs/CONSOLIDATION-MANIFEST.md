# 旧目录资产整理清单

日期：2026-09-12。本文件不含密钥、数据库内容或真实儿童姓名。

## 结论

- 日常开发主目录已统一为 `/Users/xiaoruirui/Downloads/班里手记`。
- 有价值源码、未提交修改、独有配置和必要数据已迁入或归档到 `archive-local/`（已写入 `.gitignore`，不进入 Git 与小程序上传包）。
- 两个旧目录在完成核对后已移入废纸篓，未永久删除，未清空废纸篓。
- 旧网页前后端不再作为运行版本；老师工具箱未混入班里手记功能。

## 核对方

| 项 | 结果 |
| --- | --- |
| PR #1 | 仍为草稿、未合并；头提交 `69aebe81cc9e25513097de7ded0e8ba4fd59cc95`；分支 `improve/banli-notes-v1.2` |
| 新目录 | 原先为空目录，已按该分支克隆并建立 `dev/banli-launch`，未覆盖、未嵌套第二份仓库 |
| Git bundle | `git bundle verify` 通过，并从 bundle 克隆出 `export-ai-motion` / `main` / `priority` |
| 未提交补丁 | 对 784b765 执行 `git apply --check` 通过 |
| 未跟踪文件 | 7 个文件副本哈希与源一致 |
| SQLite | 一致备份与源库 11 张表计数一致；未导入 1.2 |
| 上传媒体 | 14 个文件（11 个不同内容）以哈希文件名保全 |
| 老师工具箱 | 无 Git；源码、vendor、lockfile、测试、文档、参赛输出已归档；未复制 node_modules |
| 旧路径引用 | 当前运行树脚本不再依赖两个旧目录的绝对路径 |

## 分类去向

### A. 迁入当前小程序

未把旧 1.1 小程序文件覆盖到 1.2。逐项比较后：

- 旧 `miniprogram/utils/session.js` 调用网页 `/api/classes`，与 1.2 云开发会话不兼容，只归档。
- 旧 Tab 图标属于图标导航；1.2 已改文字导航，只归档。
- `project.private.config.json` 两边均为 `libVersion 3.15.1`，无额外密钥，1.2 已有同结构文件。
- 1.2 云函数、页面、测试均新于旧目录 miniprogram，保留 1.2。

### B. 归档历史资产

见 `archive-local/README.md`。

幼儿园旧项目：

- Git 历史 bundle、`uncommitted.patch`、未跟踪 PWA 文件（`RecordSheet.tsx`、`ShareRoom.tsx`、`edge-functions/` 等）
- 含未提交修改的源码快照（无 node_modules / dist / 活数据）
- SQLite 与上传媒体单独放在 `data-preserve/`，**不导入** `banli_*`

老师工具箱：

- 完整必要源码、测试、文档、`miniprogram/vendor/xlsx.full.min.js` 及许可、`package-lock.json`、参赛与验收输出
- 排除可再生成的 `node_modules`、云函数依赖目录、`.tmp`

### C. 依赖

- 班里手记根目录测试无需安装依赖；云函数锁定 `wx-server-sdk@4.0.2`，未改电脑全局 Node。
- 老师工具箱与旧网页依赖未混入当前小程序。
- 本机当前 `node` 为 v26.7.0；项目说明仍写 Node 22，未切换全局版本。

### D. 当前运行目录清理

已从运行树删除 `client/`、`server/`、遗留 `miniprogram/styles/common.wxss`（1.1 蓝按钮，未被 1.2 页面引用）。浏览器预览 `preview/` 仍是开发辅助，已忽略入库。

## 恢复方法

```bash
# Git 历史
git clone "/Users/xiaoruirui/Downloads/班里手记/archive-local/kindergarten-eval/git/kindergarten-eval-all.bundle" restore-kg
git -C restore-kg apply "/Users/xiaoruirui/Downloads/班里手记/archive-local/kindergarten-eval/git/uncommitted.patch"
# 再把 untracked/ 按相对路径拷回

# 老师工具箱
# 用微信开发者工具打开 archive-local/teacher-toolkit/source
```

数据库与媒体只允许从 `data-preserve/` 作保全恢复，禁止自动写入班里手记云端。

## 旧目录处理

| 原路径 | 处理 |
| --- | --- |
| `/Users/xiaoruirui/Downloads/幼儿园评价系统` | 核验后移入废纸篓 |
| `/Users/xiaoruirui/Downloads/教师减负小程序集` | 核验后移入废纸篓 |

从废纸篓还原即可得到整理前的完整目录（含 node_modules）。
