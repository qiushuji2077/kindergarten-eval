# 本轮验证记录

日期：2026-09-12。机器：本机 Node v26.7.0。不含儿童实录或密钥。

## 已执行

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 旧目录 Git / PR | 整理当时幼儿园在 `export-ai-motion`；PR #1 其后已随 PR #3 合入 `main` | 当时检查记录；现 GitHub PR #3 |
| 克隆 1.2 并建工作分支 | `dev/banli-launch` @ `69aebe81cc9e25513097de7ded0e8ba4fd59cc95` | `git log -1` |
| 归档核对 | bundle 可克隆；补丁可 apply --check；未跟踪 7 文件哈希一致；SQLite 表计数一致；14 个上传文件保全 | `archive-local/`、`SHA256SUMS.txt` |
| `npm test` | 55 通过，0 失败 | 本轮终端输出 |
| `npm run check` | 语法 / JSON / 8 路由 / 云函数别名一致；35 个 JS | 同上 |
| `node scripts/build-preview.js` | 生成 `preview/index.html`（已 gitignore） | 同上；WXML 可被预览解析 |
| `git diff --check` | 无空白错误 | 同上 |
| 运行树旧路径 | 无脚本再指向两个旧目录绝对路径 | ripgrep |
| 微信 CLI `islogin` | 返回 login true | CLI 输出 |
| 微信 CLI `open --project miniprogram` | 失败：需要重新登录 | CLI code 10 |

本地 HTTP 打开 `preview/index.html`，核对进入、手记（含孩子/日期筛选）、写观察（「保存实录」）、回看四页结构与暖白深绿麦色。浏览器排版**不能**代替原生编译。

## 未执行

- 微信开发者工具原生编译成功
- iOS / Android 真机
- 真实云函数部署、数据库规则、存储规则、混元调用
- 真实媒体、外发 Word 在 WPS / Microsoft Word 中的图文
- 上传小程序代码、提交微信审核、开通付费、迁移或删除云端数据
- 清空废纸篓或永久删除

已于 2026-09-12 将 `dev/banli-launch` 经 [PR #3](https://github.com/qiushuji2077/kindergarten-eval/pull/3) 合并并推送到 `main`。

## 与发布门槛的关系

`docs/RELEASE-GATES.md` 中的勾选框仍保持未完成，除非该项在本轮真实执行。本轮只完成了不依赖账号覆盖线上环境的本地工作。
