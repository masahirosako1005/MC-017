// 運営向け画面の入口（/admin。ADMIN_MODE=1 のときだけサーバーが返す）。利用者アプリの CSS・状態は読み込まない。
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/admin.css';
import { AdminApp } from './AdminApp.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
