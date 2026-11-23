# 转生千金～到了异世界就要悠闲地生活 (fictional-adventure)

中文 Galgame / 视觉小说《转生千金～到了异世界就要悠闲地生活》，内置 **「角色专属灵魂卡矩阵 + 小场景攒因果 → 大主线关卡变向」** 双层叙事与双模 AI 交互架构。

## 核心特性

1. **带细粒度年龄与进度认知锁的 15 角色灵魂卡矩阵（`js/ai-personas.js`）**
   - 覆盖爱丽丝、贝阿特丽丝、诺艾儿、艾诺、夏洛特、海伦娜、艾玛、阿琼、雷纳德、霍尔、索菲亚、克劳德、霁岚、霁馆主（霁清）、安娜。
   - 同时按 `ageY + phase + flags` 进行角色内部精细分档（如幼童期爱丽丝无 13 岁碎贝壳手绳与学院日程、幼年贝阿特丽丝无大学外交论文、初入学时不提前暴露后期私密心结；第三卷澄岚时期霁岚与霁馆主仅识得黑发墨绿眼的「渔」）。
2. **小场景积累暗流 → 5 轴全闭环大主线蝴蝶效应引擎（`js/branching-director.js`）**
   - 8 个支持「纯离线双幕分支 + AI 自由输入跨幕推进」的日常小场景，热点布局于舞台两侧通透区并高于立绘层。
   - 全部 5 组关系双轴（爱丽丝、诺艾儿、夏洛特、艾诺、霁岚）与 4 枚暗线情报拼图、往昔回声池均在主线拥有完整分歧闭环（含第八章冰融赠别、寒假图书馆手稿/勘误册、第十章书房暗潮推演、东逃夜巡防抄件/战书、爱丽丝双轨家书及第三卷 24 行北风堡收束章）。
3. **双模 AI 角色交谈与安全加固代理（`js/ai-chat-panel.js` + `server/gemini-proxy.mjs` + SillyTavern 扩展）**
   - **浏览器直接游玩**：打开 `index.html`，点击顶部 **「✧」** 呼出灵魂交谈抽屉，支持 Gemini `responseSchema` 直连或连接代理，单图角色亦在主舞台实时呈现 Galgame 情绪角标与光晕。
   - **启动轻量安全加固代理（适配本地与 Cloud Run）**：
     ```powershell
     $env:GEMINI_API_KEY="你的_GEMINI_API_KEY"
     $env:ALLOWED_ORIGINS="https://your-frontend.example" # 可选：额外部署前端白名单，默认仅放行同源与 localhost
     node server/gemini-proxy.mjs
     ```
     内置前端静态资源白名单隔离（严防原稿 `.txt`、服务端源码与隐藏文件下载）及严格 CORS 校验。
   - **在酒馆中游玩**：通过 `⟦state:...⟧` 轻量尾注与原著净水器实现舞台表情与因果星盘双向同步，详见 [SILLYTAVERN.md](SILLYTAVERN.md)。

## 运行自动化测试

```powershell
node tests/run.js
```
