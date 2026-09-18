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
