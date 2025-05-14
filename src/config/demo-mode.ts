// 检查是否处于展示模式
// 为了确保Vercel环境变量能被正确解析，我们进行了以下调整:
// 1. 优先检查import.meta.env下的变量（Vite在构建时会将这些暴露给客户端）
// 2. 然后才检查process.env（可能在某些环境下不可用）
// 3. 添加调试日志以便排查问题

const demoModeEnv = import.meta.env.VITE_DEMO_MODE || 
                   (typeof import.meta.env.DEMO_MODE !== 'undefined' ? import.meta.env.DEMO_MODE : undefined) ||
                   (typeof process !== 'undefined' && process.env ? process.env.DEMO_MODE : undefined);

// 在开发模式下输出环境变量值，便于调试
if (import.meta.env.DEV) {
  console.log('Demo mode env variable value:', demoModeEnv);
  console.log('VITE_DEMO_MODE:', import.meta.env.VITE_DEMO_MODE);
  console.log('import.meta.env.DEMO_MODE:', import.meta.env.DEMO_MODE);
  console.log('process.env.DEMO_MODE:', typeof process !== 'undefined' && process.env ? process.env.DEMO_MODE : 'process.env not available');
}

export const isDemoMode = demoModeEnv === 'true' || demoModeEnv === true;

// 示例SRT条目数据，用于展示模式
export const demoSrtEntries = [
  {
    id: 1,
    startTime: '00:00:05,000',
    endTime: '00:00:08,000',
    text: 'Welcome to our demonstration of SRT AI Translator.',
    translatedText: '欢迎使用SRT AI翻译器的演示。'
  },
  {
    id: 2,
    startTime: '00:00:09,000',
    endTime: '00:00:12,000',
    text: 'This is a tool designed to help you translate subtitle files easily.',
    translatedText: '这是一个旨在帮助您轻松翻译字幕文件的工具。'
  },
  {
    id: 3,
    startTime: '00:00:13,000',
    endTime: '00:00:16,000',
    text: 'In a real environment, you can upload your SRT files and have them translated automatically.',
    translatedText: '在真实环境中，您可以上传SRT文件并自动翻译它们。'
  },
  {
    id: 4,
    startTime: '00:00:17,000',
    endTime: '00:00:20,000',
    text: 'The translation process is powered by AI models, giving you high-quality results.',
    translatedText: '翻译过程由AI模型提供支持，为您提供高质量的结果。'
  },
  {
    id: 5,
    startTime: '00:00:21,000',
    endTime: '00:00:25,000',
    text: 'This demo version shows you the interface and functionality without making actual API calls.',
    translatedText: '这个演示版向您展示了界面和功能，而无需进行实际的API调用。'
  }
];

// 模拟API设置，用于展示模式
export const demoApiSettings = {
  baseUrl: 'https://api.demo-api-provider.com/v1',
  apiKey: 'demo-api-key-xxxxx',
  systemPrompt: "You will be provided with a main subtitle entry to translate, potentially accompanied by preceding and succeeding subtitle lines for context. Translate *only* the main subtitle entry, which will be clearly indicated. Use the context to improve the accuracy and naturalness of the translation for the main entry. Original format: {source_language}. Target format: {target_language}. Only provide the translated text for the main entry.",
  modelName: 'gpt-3.5-turbo-demo'
};

// 模拟翻译函数（在demo模式下）
export const demoTranslate = (text: string, sourceLang: string, targetLang: string): Promise<string> => {
  return new Promise((resolve) => {
    // 模拟API调用延迟
    setTimeout(() => {
      // 简单的模拟翻译，实际演示中可以预设一些翻译结果
      const sourceLanguageLabel = sourceLang === 'auto' ? 'Auto' : sourceLang;
      
      if (targetLang === 'zh-CN') {
        resolve(`${text} [从 ${sourceLanguageLabel} 模拟翻译到中文]`);
      } else if (targetLang === 'es') {
        resolve(`${text} [Traducción simulada de ${sourceLanguageLabel} al español]`);
      } else if (targetLang === 'fr') {
        resolve(`${text} [Traduction simulée de ${sourceLanguageLabel} en français]`);
      } else if (targetLang === 'de') {
        resolve(`${text} [Simulierte Übersetzung von ${sourceLanguageLabel} ins Deutsche]`);
      } else if (targetLang === 'ja') {
        resolve(`${text} [${sourceLanguageLabel}から日本語への模擬翻訳]`);
      } else {
        resolve(`${text} [Simulated translation from ${sourceLanguageLabel} to ${targetLang}]`);
      }
    }, 800); // 模拟延迟800ms
  });
}; 