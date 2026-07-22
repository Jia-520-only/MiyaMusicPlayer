# MiyaMusicPlayer

Minradio · 弥娅专用版 —— Windows 桌面沉浸式音乐播放器，深度适配[弥娅 (MIYA) AI 系统](https://github.com/Jia-520-only/Miya)。

通过 WebSocket 桥接插件，弥娅可以**完全控制** Mineradio：搜索点歌、播放暂停、切歌调音量、管理歌单、获取歌词——从 QQ、微信、飞书等任意平台一句话操控。

---

## 弥娅控制功能

弥娅通过 MCP 协议控制播放器，支持 20 个工具：

| 工具 | 功能 |
|------|------|
| `mineradio_play_song` | 搜索并播放歌曲（传歌名即可，自动搜索） |
| `mineradio_search` | 搜索歌曲/歌手/歌单 |
| `mineradio_play` / `mineradio_pause` | 播放 / 暂停 |
| `mineradio_next` / `mineradio_prev` | 上一首 / 下一首 |
| `mineradio_set_volume` | 设置音量 (0-100) |
| `mineradio_get_status` | 获取当前播放状态 |
| `mineradio_get_playlists` | 获取用户歌单 |
| `mineradio_get_lyrics` | 获取当前歌词 |
| … | 还有更多 |

### 使用示例

```
在 QQ/微信/桌面端对弥娅说：

  "帮我放一首周杰伦的晴天"
  "下一首"
  "音量调到50"
  "现在在放什么歌？"
```

弥娅会自动调用 Mineradio，在你的电脑上播放音乐。

---

## 架构

```
弥娅 AI (CCE / 守护进程)
  └── MCP ──▶ miya-mineradio MCP Server (Python)
                └── WebSocket ──▶ Mineradio
                      ├── miya-plugin.js   (WS 服务端, /miya)
                      └── index.html       (前端桥接)
                            └── server.js  (网易云/QQ 音乐 API)
```

弥娅的 `mcpserver/miya_mineradio/` 通过 WebSocket 连接到 Mineradio 的 `miya-plugin.js`（端口 3000，路径 `/miya`）。前端 `index.html` 中的桥接代码负责执行实际的搜索和播放操作。

---

## 下载与使用

**注意：此仓库为弥娅专用版。** 普通用户请使用原版 [Mineradio](https://github.com/XxHuberrr/Mineradio)。

### 配合弥娅使用

1. 启动 Mineradio：双击 `start.bat` 或 `npm start`
2. 启动弥娅守护进程
3. 对弥娅说 "帮我放首歌"

弥娅首次调用时会自动连接 Mineradio，无需额外配置。

### 开发运行

```bash
npm install
npm start
npm run build:win
```

---

## 原始项目

Mineradio 由 [XxHuberrr](https://github.com/XxHuberrr) 设计与打造，是一款融合天气电台、歌词舞台、粒子视觉和 3D 歌单架的 Windows 桌面音乐播放器。

弥娅适配版新增：

| 文件 | 说明 |
|------|------|
| `miya-plugin.js` | WebSocket 服务端，挂载于 `/miya` 路径 |
| `start.bat` | Windows 一键启动脚本 |
| `public/index.html` | 注入弥娅控制桥接（搜索/播放/暂停等） |
| `server.js` | 新增 `/api/miya/health` 端点 + 插件加载 |

---

## 音乐源

- **网易云音乐**（主源）：搜索、歌单、每日推荐、播客
- **QQ 音乐**（辅源）：搜索、歌单、换源补位

---

## 致谢

- **Mineradio** 原作者：[XxHuberrr](https://github.com/XxHuberrr/Mineradio)
- **弥娅系统**：[Jia-520-only/Miya](https://github.com/Jia-520-only/Miya)

采用 GPL-3.0 授权。详见 [LICENSE](./LICENSE)。
