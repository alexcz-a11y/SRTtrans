import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// 这个配置确保Vercel环境变量能被正确传递到Vite构建过程中
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  // DEMO_MODE 环境变量 (允许从Vercel UI设置)
  const demoMode = env.DEMO_MODE || "false";
  
  console.log('Building with DEMO_MODE:', demoMode);
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // 将环境变量安全地暴露给客户端代码
    define: {
      'import.meta.env.DEMO_MODE': JSON.stringify(demoMode)
    }
  }
})

