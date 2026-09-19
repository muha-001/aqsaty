// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ✅ استيراد ملف الأنماط الرئيسي
import './styles.css';

// (اختياري) إذا كنت تستخدم Tailwind أو أنماط إضافية
// import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  });
}
