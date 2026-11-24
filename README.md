# IELTSyn

两款独立、离线优先的 IELTS 学习应用，使用 React、Vite 和 Electron：

- **听 · 读 · 写**：单篇与套题练习、阅读复盘、写作、连续模考、本机学习记录与可阅读的 PDF 导出。
- **口语学习**：Part 1 → 2 → 3 连续练习、本机录音、个人表达、影子跟读素材导入、字幕校正与 PDF 报告。

首次使用没有 API Key、作答、录音、批改结果或学习进度。不要求注册。AI 是可选功能；未配置时仍能练习、录音和保存。两款应用共用本机 Key，但学习记录彼此独立。

## 快速启动

需要 Node.js **24.22 或更新的 24.x**、npm 和 Git。

```sh
npm ci
npm run dev
```

主应用：<http://127.0.0.1:5173/>。

另开一个终端启动独立口语应用：

```sh
npm run speaking:dev
```

口语应用：<http://127.0.0.1:5174/>。预览仅监听本机。不要将本机接口直接暴露到公网。

macOS 也可双击 `dev.command`；脚本优先使用系统 Node，未安装时会提示。

## 可选：配置自己的阿里云百炼 Key

- 主应用：**设置 → AI 设置**。
- 口语应用：顶部 **AI 设置**。
- 粘贴自己的百炼按量付费 API Key，或从只包含一行 Key 的 TXT 文件导入；选择 Key 所属地域后保存。
- 保存无需重启。保存和“重新检查配置”不调用收费模型，也不代表已验证账户权限。实际生成消耗你自己的账户额度。
- 写作、阅读解析和图表使用 `qwen3.5-flash`；英文录音转写使用 `qwen3-asr-flash`。账号需具备对应模型的权限及额度。文字反馈不生成发音或实际流利度评分，所有分数均为练习估分。

Key 保存在用户目录 `Documents/Codex/.ieltsyn-private/ai.json`，不在源码、浏览器持久存储、学习备份和安装包中；文件权限为 0600。两款应用在同一系统用户下共享此配置。

开发者可通过服务端环境变量 `IELTS_AI_CONFIG` 指定私有配置位置；`DASHSCOPE_API_KEY` 会覆盖文件 Key，此时 UI 明确显示由环境管理。**不要使用包含密钥的 `VITE_*` 变量，不要提交 `.env` 或私有配置。**

## 内容范围

这个公开版本附带 **4 个原创听力示例（含合成旁白）、3 篇原创阅读、Task 1/Task 2 原创写作示例、1 组原创口语话题**。示例只用于体验流程，不是官方真题、频次预测或完整备考题库。演示数据的数量不代表正式考试题量。

第三方教材、商业题库、原始文章、客户聊天记录、网盘文件、EIC 题库和下载的视频均未收入本仓库。代码开源不代表这些资料获准公开再分发。影子跟读初始素材库为空，可导入自己有权使用的视频/音频与同名 SRT/VTT 字幕；阅读 PDF 也可在页面中导入。

更换或扩展题库的格式见 [docs/CONTENT.md](docs/CONTENT.md)。软件中保留 `listening-232`、`reading-october`、`eic-bank` 等历史内部文件名，仅为兼容已有功能，不表示仓库含这些第三方资料。

## 本机数据

浏览器版使用该地址的 localStorage / IndexedDB；不同端口的数据独立。桌面开发版使用 `work/desktop-profile` 和 `work/speaking-profile`，不进入 Git；安装版保存在系统应用数据目录。克隆项目或安装软件不会带入开发者的练习。

文档一律导出排版的 PDF。备份 PDF 还带可恢复附件，原文件可重新导入；重新打印或另存可能丢失恢复附件。旧 JSON 只保留导入兼容；媒体录音和 VTT 仍按原格式下载。

## 检查与构建

```sh
npm run check
npm run check:release
npm run build
npm run speaking:build
# 桌面开发（需要本机图形环境）
npm run desktop:dev
npm run speaking:desktop
```

自动测试不需要真实 Key，不产生模型费用。`check:release` 扫描源码中的凭据、本机路径、个人档案和异常大文件。CI 同时执行测试、发布检查和两款前端构建。

当前首先验证浏览器及 macOS 开发版。Windows/Linux 的安装与音频权限仍需对应系统验证；仓库中的打包命令不代表每个平台安装包已经验收。发布安装包前请检查内容授权、系统签名、麦克风授权和平台兼容性。

## 参与开发

见 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。报告问题时请去除 Key、个人回答和本机路径。

## 许可

项目源码及原创示例采用 [MIT License](LICENSE)。依赖及内置字体保留各自许可。本项目独立开发，与 IELTS 考试机构无隶属关系，不提供官方成绩。

如果安装 Electron 时本机默认缓存目录没有写入权限，可把缓存指定到自己的可写目录再运行 `npm ci`，例如 `electron_config_cache=/tmp/ieltsyn-electron-cache npm ci`。这只影响依赖下载缓存，不改变学习数据或 AI 配置。
