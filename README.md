# SRT AI 翻译器 SRT AI Translator 字幕文件AI翻译工具 🚀

![SRT AI Translator Banner](./public/images/translator.jpg)

本应用是一个基于网页的 SRT 字幕文件 AI 翻译工具，旨在提供高效、准确且用户友好的字幕翻译体验。🌐

## 🌐 在线演示 (Online Demo)

您可以访问 [https://sr-ttrans.vercel.app/](https://sr-ttrans.vercel.app/) 查看本应用的在线演示版本。

**注意：** 演示版本运行在"Demo模式"下，使用预设的示例数据展示界面功能，而不会进行真实的API调用。

## ✨ 功能概览 (Features)

*   📄 **SRT 文件处理**:
    *   轻松上传 `.srt` 格式的字幕文件。
    *   智能解析字幕条目，包括时间轴和文本内容。
*   🤖 **AI 驱动翻译**:
    *   支持调用可配置的 AI 服务提供商（兼容 OpenAI API 格式，如 Groq、Moonshot AI 等）。
    *   用户可自定义 API 的 Base URL、API Key、模型名称。
    *   灵活配置系统提示词 (System Prompt) 以引导翻译风格和质量。
*   🌍 **语言选择**:
    *   源语言：支持多种常见语言，并提供"自动检测"选项。
    *   目标语言：支持翻译成多种常见语言。
*   ⚙️ **翻译控制与监控**:
    *   提供"开始翻译" ▶️ 和 "停止翻译" ⏹️ 功能。
    *   实时显示当前正在翻译的字幕条目ID和进度。
*   🔗 **上下文感知翻译**:
    *   可选启用上下文翻译功能，提升翻译的连贯性和专业性。
    *   可配置发送给模型的前置字幕条数（默认为1）和后置字幕条数（默认为1）。
    *   优化的系统提示词，指导模型有效利用上下文信息。
*   🛠️ **错误处理与重试**:
    *   清晰展示翻译失败的条目及其错误详情（类型、代码、信息）。
    *   提供"重试失败条目" 🔁 按钮，方便手动重试。
    *   内置自动重试机制（用户可选择启用/禁用，默认启用）：
        *   针对特定可重试错误（如网络问题、API速率限制、服务器内部错误）。
        *   默认最多自动重试3次，每次重试间隔3秒。
*   📤 **结果导出**:
    *   一键将翻译完成的字幕（包括未翻译成功的原文）导出为新的 `.srt` 文件。
*   🎨 **用户体验 (UX)**:
    *   提供 API 服务提供商的连接性测试 ✅ 功能。
    *   流畅的界面动画效果（页面加载、设置面板、按钮交互等），由 GSAP 和 Framer Motion 驱动。
    *   现代化且统一的自定义配色方案。
    *   可滚动的翻译输出区域，方便查看和管理大量字幕。

## 🚀 自部署步骤 (Self-Hosting Guide)

本项目基于 Vite + React + TypeScript 构建。请遵循以下步骤在您自己的环境中部署：

### 一键部署到Vercel (One-Click Deploy to Vercel)

点击下方按钮，一键将本项目部署到您自己的Vercel账户：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alexcz-a11y/SRTtrans)

**控制演示模式：** 默认情况下，部署后的应用不会启用演示模式。如果您希望开启或关闭演示模式，请在Vercel项目设置中配置环境变量：
1. 进入Vercel项目的 "Settings" -> "Environment Variables"
2. 找到名为 `DEMO_MODE` 的变量（如果不存在，请创建）
3. 设置为 `true` 开启演示模式，或设置为 `false` 关闭演示模式
4. 保存设置并重新部署项目

### 🛠️ 2.1. 环境准备 (Prerequisites)

*   **Node.js**: 请确保您的系统中已安装 Node.js (建议 [LTS 版本](https://nodejs.org/))。npm 通常会随 Node.js 一同安装。
*   **代码获取**:
    *   通过 Git 克隆: `git clone https://github.com/alexcz-a11y/SRTtrans.git`
    *   或下载 ZIP 包解压。

### 📦 2.2. 安装依赖 (Installation)

1.  **进入项目目录**:
    ```bash
    cd srt-translator # 或者您克隆/解压后的文件夹名称
    ```

2.  **安装项目依赖**:
    由于开发过程中遇到特定依赖版本兼容性问题，推荐使用以下命令安装：
    ```bash
    npm install --legacy-peer-deps
    ```
    如果此命令遇到问题，您可以尝试标准的 `npm install`，但可能需要手动解决依赖冲突。
    项目依赖的动画库 `gsap` 和 `framer-motion` 会通过此命令一并安装。

### ▶️ 3. 启动应用 (Running the Application)

完成依赖安装后，您可以启动本地开发服务器：

1.  **确保在项目根目录下**。

2.  **运行开发服务器命令**:
    ```bash
    npm run dev
    ```

3.  **访问应用**:
    命令执行成功后，终端通常会显示应用正在运行的本地地址，默认为：
    `http://localhost:5173`
    在您的网页浏览器中打开此地址即可开始使用！ 🎉

## 📝 注意事项 (Important Notes)

*   🔑 **API Key**: 您需要在应用的"翻译设置"中填入有效的 API Key 和正确的 API Base URL (例如 `https://api.openai.com/v1` 或其他兼容服务商的地址) 才能使用翻译功能。**请务必妥善保管您的 API Key，不要泄露给他人。**
*   🧠 **系统提示词**: 默认的系统提示词已针对普通翻译和上下文翻译进行了优化。您可以根据具体需求在设置中进行修改以获得最佳翻译效果。
*   🐛 **错误排查**: 如果遇到任何问题，请首先检查浏览器开发者工具的控制台 (通常按 F12 打开) 输出，那里通常会有详细的错误信息。
*   🌐 **网络访问**：确保您的计算机可以访问您配置的 AI 服务提供商的 API 地址。

## 🤝 贡献 (Contributing)

欢迎对此项目进行贡献！如果您有任何建议、发现 Bug 或希望添加新功能，请随时：
1.  Fork 本仓库。
2.  创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3.  提交您的更改 (`git commit -m '''Add some AmazingFeature'''`)。
4.  推送到分支 (`git push origin feature/AmazingFeature`)。
5.  打开一个 Pull Request。

## 📄 许可证 (License)

[MIT License](LICENSE.md) <!-- 您可以后续添加一个 MIT 许可证文件 -->

---
希望这份文档对您有所帮助！如果您喜欢这个项目，请给它一个 ⭐ Star！

## 💡 开发者说明 (Developer Notes)

### Demo模式
项目包含一个演示模式（Demo Mode），用于在不需要真实API密钥的情况下展示应用功能。

* 此模式通过环境变量 `DEMO_MODE` 或 `VITE_DEMO_MODE` 设置为 `'true'` 来启用
* 在演示模式下，应用会使用预设的示例数据和模拟的翻译功能
* 如果您进行自己的部署且想使用真实功能，请确保：
  * 不要在环境变量中设置 `DEMO_MODE=true` 或 `VITE_DEMO_MODE=true`
  * 如果使用Vercel部署，可以在项目设置中移除 `DEMO_MODE` 环境变量
