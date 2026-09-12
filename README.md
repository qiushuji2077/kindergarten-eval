# 幼儿观察记录（班里手记）

给幼儿园带班老师用的观察记录工具。老师在现场写下孩子正在做的事，或拍照、录像、录音；点选观察对象后发表。

**主产品是微信小程序**，代码在 [`miniprogram/`](miniprogram/)。`main` 基线对应开发版 **1.1.0**，与线上开发版一致。公众平台审核与正式发布尚未完成。

仓库描述中的「班里手记」与小程序内名称「幼儿观察记录」指向同一产品。赛事与上线材料见 [`contest/`](contest/)。

`client/` 与 `server/` 是早期手机网页原型，**不是**当前上线路径。根目录 `npm run dev` / `npm start` 只启动该网页，打不开小程序。

## 做什么

系统做三件事：

1. 把实录对应到教育部《3—6 岁儿童学习与发展指南》的领域、子领域、目标和年龄段典型表现。
2. 调用微信云开发混元大模型写一句发展解读，供教研对照，不代替老师判断；混元不可用时退回规则匹配。
3. 按幼儿汇总一段时间的记录，在手机上生成 Word《儿童观察记录汇总》。

页面：进入、记录流、写观察、幼儿名单、导出，以及站内《隐私保护指引》《用户服务协议》和使用说明。没有打卡、积分或社交。

## 从哪里看

| 目录 | 说明 |
| --- | --- |
| [`miniprogram/`](miniprogram/) | 当前产品：页面、工具、云函数。开发以本目录为准。 |
| [`miniprogram/上线说明.txt`](miniprogram/上线说明.txt) | AppID、云环境、开发版版本与公众平台步骤 |
| [`contest/作品说明.md`](contest/作品说明.md) | 2026 微信小程序开发大赛作品说明（另有 PDF） |
| [`contest/上线与报名清单.md`](contest/上线与报名清单.md) | 审核、改名、隐私指引、混元、报名材料勾选 |
| [`contest/隐私保护指引填写稿.md`](contest/隐私保护指引填写稿.md) | 公众平台隐私指引填写稿 |
| [`client/`](client/) + [`server/`](server/) | 历史 React + Express 网页原型，仅供对照，不承载真实儿童数据 |

## 打开小程序

需要[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，并已开通该号的云开发。

1. 导入项目，目录选 `miniprogram/`（不要选仓库根目录）。
2. AppID：`wx8e8daba1d8b01cc5`（沿用原教师减负号，整包覆盖）。
3. 云开发环境：`cloud1-d0gos8gobac3c3623`；实际调用的云函数是 `noticeService`。
4. 基础库约 `3.15.1`（见 `miniprogram/project.config.json`）。

演示班为「中二班」，可直接选教师「杨飞」进入。名单为示例数据，不是真实在园儿童。正式带班前须在「幼儿」里改成本班名字。当前登录是点选演示教师，无密码、未按微信身份做班级隔离。

评委路径：中二班 / 杨飞 → 同意隐私 → 点 + → 点小麦 → 写实录（例如「积木倒了，他说我们一起修好」）→ 看指南对应 → 发表 → 导出小麦的 Word。

## 技术栈（现行小程序）

- **客户端**：原生微信小程序。拍照/视频 `wx.chooseMedia`，录音走微信录音，说话转文字走微信语音。观察时间取手机时钟，发表后冻结。
- **后端**：微信云开发。班级、教师、幼儿、观察记录在云数据库（集合前缀 `kg_`）；媒体走云存储。云函数不可用时，客户端可回退本机 `localStore`。
- **指南对应**：关键词规则 + 混元（`cloud.extend.AI`）。只把实录文字送给模型，不发送幼儿照片。
- **报告**：Word 在手机本地生成；有视频时可附二维码。封面园所名称可填，不填则写「幼儿园」。
- **隐私**：`__usePrivacyCheck__`、拍照前隐私弹窗、站内指引与协议。

`miniprogram/cloudfunctions/evalService` 是旧别名，与 `noticeService` 不完全同步；改云函数请改 `noticeService`。

## 仓库结构

```
miniprogram/     当前产品
  pages/         login / feed / compose / kids / export / about / legal
  cloudfunctions/noticeService   实际调用
  cloudfunctions/evalService     旧别名
contest/         作品说明、上线与报名清单、隐私指引填写稿
client/          历史 React 网页（Vite + TypeScript）
server/          历史 Node API 与 SQLite
```

## 尚未完成（仓库已写明）

见 [`contest/上线与报名清单.md`](contest/上线与报名清单.md)。开发版 1.1.0 已上传，不等于已上线。公众平台仍需：名称改为「幼儿观察记录」、按填写稿发布隐私指引、确认混元已开通、提交审核并发布、下载正式版码。赛事报名材料尚未齐。

幼儿照片不送大模型。演示数据与正式带班要分开说明。

## 历史网页原型（非生产）

需要 Node.js 22+。仅本地对照旧交互，不要对公网暴露，也不要用它存真实儿童数据。网页登录同样是点选班级/教师，API 无鉴权。

```bash
cd server && npm install
cd ../client && npm install

# 后端默认 http://localhost:3789
cd ../server && npm run dev

# 另开终端：前端 http://localhost:5173（已代理 API）
cd client && npm run dev
```

生产合一（仍是网页，不是小程序）：

```bash
cd client && npm run build
cd ../server && npm start
# 访问 http://localhost:3789
```

SQLite 在 `server/data/`，上传媒体在 `server/data/uploads/`。
