# معمارية aqsaty

يوضح هذا المستند حدود البيانات المحلية ومسار المزامنة الاختيارية. **IndexedDB** هو مصدر العمل المحلي، بينما Supabase طبقة مزامنة مشروطة بالمصادقة والاتصال.

```mermaid
flowchart LR
    accTitle: aqsaty Data Architecture
    accDescr: The browser application writes locally first, then synchronizes authenticated workspace data to Supabase with revision conflict checks.

    ui["واجهة React RTL"] --> domain["طبقة المجال والحسابات"]
    domain --> local["IndexedDB\nمصدر العمل المحلي"]
    domain --> backup["نسخة AES-GCM\nتصدير واستيراد"]
    domain --> auth["Supabase Auth"]
    auth --> sync["مزامنة revision\nمع كشف التعارض"]
    sync --> cloud["Supabase\nRLS + JSON payload"]

    classDef app fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a5f
    classDef storage fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d
    classDef security fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f

    class ui,domain app
    class local,backup,cloud storage
    class auth,sync security
```

## قواعد التشغيل

1. تحفظ العمليات محليًا أولًا حتى عند انقطاع الإنترنت.
2. لا ترفع صور المنتجات إلى السجل السحابي؛ تبقى محلية لتقليل حجم البيانات الحساسة.
3. لا تُنفّذ الكتابة السحابية إذا تغيّر `revision` منذ آخر سحب ناجح.
4. يجب أخذ نسخة احتياطية مشفرة قبل الاستيراد أو إعادة الضبط.
5. يجب تهيئة سياسات RLS وإضافة المستخدم إلى Workspace قبل تفعيل المزامنة.

## أوامر الجودة

```bash
npm run lint
npm run check
npm test
npm run build
```

لا تضع `service_role` أو أي سر خاص داخل ملفات الواجهة أو المستودع. استخدم متغيرات البيئة المحلية وأسرار GitHub عند الحاجة.
