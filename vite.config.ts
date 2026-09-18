import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // ✅ يفضل إزالة cssCodeSplit: false إذا لم تكن هناك حاجة ماسة له
    // لأن Vite 8 قد يتعامل معه بشكل مختلف.
    rollupOptions: {
      output: {
        // ✅ استخدام الصيغة الدالية (Function Form) لـ manualChunks
        // لأن الصيغة الكائنية (Object Form) لم تعد مدعومة في Vite 8
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // إنشاء chunk منفصل لـ React و React-DOM
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            // يمكنك إضافة مكتبات أخرى هنا بنفس الطريقة
            // if (id.includes('lodash')) { return 'utils'; }
          }
        },
      },
    },
  },
});
