# 幼儿园评价系统（幼师手机观察记录）

面向幼儿园的 **COA 观察记录系统**：老师用手机像发朋友圈一样记录（拍照 / 拍视频 / 打字 / 说话），指定幼儿姓名后入库；后台可一键生成与样例一致的 Word《儿童观察记录汇总》。

## 功能

- **手机端动态流**：班级观察时间线
- **发布观察**：拍照/相册、拍视频、录音、语音转文字、点选幼儿、可选发展领域阶段
- **幼儿管理**：本班新增幼儿
- **后台报告**：按幼儿 + 日期区间一键下载 `.docx`（含照片嵌入、视频二维码）

## 技术栈

- 前端：React + Vite（手机优先 PWA 式网页，手机浏览器即可用）
- 后端：Node.js + Express + 内置 `node:sqlite`
- 报告：`docx` + `qrcode`

> 说明：这是可立即部署的 **手机网页 App**（老师 Safari / 微信内置浏览器 / Chrome 打开即可）。若后续要上架 App Store / 应用宝，可用同一套 API 再包一层 React Native / 小程序。

## 快速启动

需要 Node.js 22+（推荐 22 LTS 或 26）。

```bash
# 1) 安装依赖
cd server && npm install
cd ../client && npm install

# 2) 启动后端（默认 http://localhost:3789）
cd ../server && npm run dev

# 3) 另开终端启动前端（http://localhost:5173 ，已代理 API）
cd client && npm run dev
```

手机访问：电脑与手机同一 Wi-Fi，浏览器打开 `http://<电脑局域网IP>:5173`。

生产模式（前后端合一）：

```bash
cd client && npm run build
cd ../server && npm start
# 访问 http://localhost:3789
```

## 演示账号数据

首次启动自动写入：

- 班级：中二班
- 教师：杨飞、李美慧、王老师
- 幼儿：小麦、小糖果、熙熙、周彦静
- COA 发展框架：健康 / 语言 / 社会 / 科学 / 艺术 领域及阶段

## 报告样例对齐

报告字段对齐你提供的 `XXXX.docx`：

- 幼儿园名称、儿童姓名、班级、观察起止、报告日期
- 每条：记录类型、教师、时间、班级、对象、观察实录、发展状态
- 有视频时附加「扫码观看」二维码

## 目录

```
server/   API、SQLite、Word 生成、媒体上传
client/   幼师手机端 + 简易后台
```

数据文件位于 `server/data/kindergarten.db`，上传媒体在 `server/data/uploads/`。
