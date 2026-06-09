// 单独的 vitest 配置 —— 不挂 vite-plugin-electron / electron-renderer
// （那俩会把 node:fs 等模块改写成 CJS wrapper，jsdom + ESM 测试环境跑不起来）
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/tests/**'],
    },
  },
});
