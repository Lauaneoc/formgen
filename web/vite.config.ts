import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { aiAssistancePlugin } from './server/ai-assistance-plugin';
import { reactGenerationPlugin } from './server/react-generation-plugin';

export default defineConfig(({ mode }) => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, projectRoot, '');

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [
      react(),
      aiAssistancePlugin({
        apiKey: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL || process.env.OPENAI_MODEL,
      }),
      reactGenerationPlugin(),
    ],
    build: {
      outDir: '../dist-web',
      emptyOutDir: true,
    },
  };
});
