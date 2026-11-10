import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'app/client',
  publicDir: 'public',
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // data: URL にせずファイルで出す（CSP の img-src は data: も許すが、出所を分かりやすくする）
    assetsInlineLimit: 0,
    // 利用者アプリ（index.html）と運営向け（admin.html、ADMIN_MODE=1 のときだけサーバーが返す）の2つの入口
    rollupOptions: { input: { main: resolve('app/client/index.html'), admin: resolve('app/client/admin.html') } },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // サーバーの Origin 検査（ADR-005）は 3000 だけを自分とみなす
      '/api': { target: 'http://127.0.0.1:3000', headers: { origin: 'http://127.0.0.1:3000' } },
    },
  },
});
