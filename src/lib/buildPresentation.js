import pptxgen from 'pptxgenjs';

// لوحة الألوان الموحّدة للنظام
const C = {
  primary: 'A31D1D',
  primaryDark: '3A0A0A',
  primarySoft: 'FDECEC',
  bg: 'F4F4F5',
  card: 'FFFFFF',
  muted: '6B7280',
  text: '222233',
  border: 'E4E4E7',
  accent: 'F8F9FA',
  white: 'FFFFFF',
};

const FONT = 'Cairo';

// بيانات الوحدات الـ17
const MODULES = [
  { n: '١', title: 'لوحة العمليات', route: '/', lead: 'الصفحة الرئيسية — نظرة شاملة على الاستيعاب والتحليل والتنبيهات مع تصفية بالسنة.',
    features: ['بطاقات مؤشرات تفاعلية (تنبيهات، روابط، كيانات، مستندات)', 'أبرز الكيانات وأحدث المستندات المعالجة', 'استيعاب سريع بسحب وإفلات PDF', 'تصفية زمنية حسب السنة', 'تحديث يدوي للبيانات'] },
  { n: '٢', title: 'المستندات', route: '/documents', lead: 'إدارة المستندات المستوعبة ومعالجتها آلياً.',
    features: ['رفع PDF أو نصوص لبدء خط المعالجة', 'بطاقات بحالة كل مستند (انتظار/معالجة/تم/فشل)', 'بحث فوري بالعنوان', 'عدد الكيانات والروابط المستخرجة', 'صفحة تفاصيل بالنص والملخص والتاريخ المرجعي'] },
  { n: '٣', title: 'استيراد البيانات', route: '/import', lead: 'استيراد كيانات وقوائم مراقبة من ملفات CSV.',
    features: ['استيراد CSV للكيانات (الاسم يُكتشف تلقائياً)', 'إنشاء روابط عبر أعمدة مصدر/هدف', 'توحيد تلقائي للكيانات المكررة', 'دليل تنسيق مدمج مع أمثلة', 'استيراد قائمة المراقبة بمطابقة آلية'] },
  { n: '٤', title: 'الكيانات', route: '/entities', lead: 'دليل جميع الكيانات المستخرجة عبر المستندات.',
    features: ['تصفية بالنوع (شخص/شركة/منظمة/موقع/حدث)', 'تصفية متقدمة بالجنسية والخطورة والسمات', 'ترتيب بالذكر أو الخطورة أو الأحدث', 'بطاقات بصورة الكيان ودرجة الخطورة', 'صفحة تفاصيل بسمات وروابط وخط زمني ودمج'] },
  { n: '٥', title: 'قاعدة البيانات', route: '/database', lead: 'سجل بيانات الكيانات مع تحرير وتصنيف يدوي.',
    features: ['تصفح مصنّف بتبويبات واضحة', 'بحث وتصفية فورية', 'محرر سمات تفصيلي (PII) بتحديث فوري', 'إعادة تصنيف يدوي بين منظمة وشركة', 'تنقل للملف الكامل للكيان'] },
  { n: '٦', title: 'فهرس العلاقات', route: '/graph', lead: 'قاعدة بيانات الرسم البياني — شبكة علاقات متعددة الدرجة.',
    features: ['مؤشرات الشبكة (عقد، روابط، متصلة، معزولة، كثافة)', 'أعلى المحاور وتوزيع أنواع العلاقات', 'خريطة روابط تفاعلية قابلة للسحب', 'مقاييس المركزية وكشف المجتمعات', 'مستكشف الجوار وتحليل المسار'] },
  { n: '٧', title: 'شبكة الشركات', route: '/company-network', lead: 'تحليل روابط الشركات عبر الموظفين والهواتف والمستندات.',
    features: ['ربط الشركات عبر موظف/هاتف/بريد مشترك', 'خريطة شبكية بتلوين العناقيد', 'كشف مجتمعات الشركات', 'شبكة الإيغو لكل شركة', 'ترتيب الشركات بالمركزية'] },
  { n: '٨', title: 'مساحات العمل', route: '/workspaces', lead: 'مجموعات كيانات مختارة لتحليل روابط مخصص.',
    features: ['إنشاء مساحات تحليل', 'تجميع تلقائي حسب السنة', 'تبويبات (شبكة، بيانات، مستندات، تقارير)', 'شبكة علاقات بأسلوب Kharon قابلة للسحب', 'تصدير CSV وتحميل PDF'] },
  { n: '٩', title: 'الإحصاءات السنوية', route: '/yearly-stats', lead: 'تقرير تنفيذي يجمع بيانات سنة محددة.',
    features: ['تصفية بالسنة لكل المؤشرات', 'مؤشرات تنفيذية (مستندات، كيانات، روابط، تنبيهات)', 'تحليل الشبكة والعناقيد والمحاور', 'توزيع الخطورة والاتجاهات الزمنية', 'أعلى الكيانات في السنة'] },
  { n: '١٠', title: 'البحث الضبابي', route: '/search', lead: 'محرك بحث يطابق الجزئي والمخطئ.',
    features: ['مطابقة ضبابية بدرجة تشابه', 'بحث شامل عبر الكيانات والمستندات والروابط', 'ترتيب النتائج بالتشابه', 'حقل بحث في الشريط العلوي باختصار /'] },
  { n: '١١', title: 'البحث عبر اللغات', route: '/clir', lead: 'ابحث بأي لغة — ترجمة آلية للاستعلام.',
    features: ['ترجمة آلية للاستعلام للبحث في الوثائق العربية', 'نتائج ثنائية اللغة', 'فرز الكيانات المشبوهة', 'حقل بحث مع مثال توضيحي'] },
  { n: '١٢', title: 'مسار العلاقات', route: '/path-analysis', lead: 'اكتشاف مسار العلاقة بين كيانين.',
    features: ['اختيار كيانين (مصدر وهدف)', 'حساب أقصر مسار في الرسم البياني', 'عرض مرئي بالعقد والحواف', 'تفاصيل نوع العلاقة والدليل لكل خطوة'] },
  { n: '١٣', title: 'تتبع التغيّرات', route: '/changes', lead: 'مراقبة الإضافات الحديثة على النظام.',
    features: ['تاريخ أساسي قابل للتعديل', 'بطاقات ملخصة (كيانات، روابط، مستندات، تنبيهات)', 'قوائم بالعناصر الجديدة', 'تنقل مباشر للعنصر'] },
  { n: '١٤', title: 'الفجوات التحليلية', route: '/gaps', lead: 'تصور فجوات البيانات لتحليل أكمل.',
    features: ['كيانات بذكر وحيد أو معزولة', 'كيانات من مصدر وحيد', 'مستندات بلا كيانات مستخرجة', 'روابط بلا دليل موثّق', 'بطاقات تفاعلية بعدّاد وقائمة'] },
  { n: '١٥', title: 'مقارنة الفترات', route: '/compare', lead: 'مقارنة مؤشرات الأداء بين سنتين.',
    features: ['اختيار سنتين للمقارنة', 'مؤشرات مجمّعة لكل سنة', 'عرض الفروقات بمؤشرات اتجاهية', 'أعلى الكيانات لكل فترة جنباً إلى جنب'] },
  { n: '١٦', title: 'التنبيهات', route: '/alerts', lead: 'محرك قواعد (CEP) ينشئ تنبيهات تلقائية.',
    features: ['ملفات خطر قابلة للإدارة (عتبة، مراقبة، محوري، عنقود)', 'تفعيل/تعطيل كل قاعدة', 'لوحة مراقبة بالخطورة', 'قائمة تنبيهات بالسبب والذكر', 'إشعارات بريد تلقائية'] },
  { n: '١٧', title: 'الإعدادات', route: '/settings', lead: 'تكوين البريد وSMTP للبيئة المعزولة.',
    features: ['إدارة وجهة إشعارات البريد', 'إعداد خادم SMTP محلي', 'حفظ آمن في كيان Setting مركزي'] },
];

function titleSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.primaryDark };
  // شريط زخرفي
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: C.primary } });
  s.addText('Strategic Data Fusion', { x: 0.5, y: 1.5, w: 12.33, h: 0.5, align: 'center', fontFace: FONT, fontSize: 18, color: 'FFFFFF', bold: false, charSpacing: 2 });
  s.addText('محلّل الكيانات', { x: 0.5, y: 2.2, w: 12.33, h: 1.2, align: 'center', fontFace: FONT, fontSize: 54, color: 'FFFFFF', bold: true, rtlMode: true });
  s.addText('منصة التحليلات الاستراتيجية لدمج البيانات وكشف الروابط', { x: 0.5, y: 3.5, w: 12.33, h: 0.6, align: 'center', fontFace: FONT, fontSize: 20, color: 'FDECEC', rtlMode: true });
  s.addText('عرض تقديمي شامل للنظام', { x: 0.5, y: 5.6, w: 12.33, h: 0.4, align: 'center', fontFace: FONT, fontSize: 14, color: 'FFFFFF', italic: true, rtlMode: true });
  s.addShape(pres.ShapeType.rect, { x: 0, y: 7.32, w: 13.33, h: 0.18, fill: { color: C.primary } });
}

function agendaSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  s.addText('محتويات العرض', { x: 0.5, y: 0.4, w: 12.33, h: 0.7, align: 'right', fontFace: FONT, fontSize: 30, color: C.primary, bold: true, rtlMode: true });
  s.addShape(pres.ShapeType.rect, { x: 11.0, y: 1.15, w: 1.83, h: 0.05, fill: { color: C.primary } });
  const groups = [
    { head: 'الرئيسية والاستيعاب', items: ['لوحة العمليات', 'المستندات', 'استيراد البيانات'] },
    { head: 'التحليل', items: ['الكيانات', 'قاعدة البيانات', 'فهرس العلاقات', 'شبكة الشركات', 'مساحات العمل', 'الإحصاءات السنوية'] },
    { head: 'البحث', items: ['البحث الضبابي', 'البحث عبر اللغات'] },
    { head: 'أدوات تحليلية', items: ['مسار العلاقات', 'تتبع التغيّرات', 'الفجوات التحليلية', 'مقارنة الفترات'] },
    { head: 'العمليات', items: ['التنبيهات', 'الإعدادات'] },
  ];
  let y = 1.5;
  groups.forEach((g) => {
    s.addText(g.head, { x: 8.8, y, w: 4.0, h: 0.4, align: 'right', fontFace: FONT, fontSize: 15, color: C.primary, bold: true, rtlMode: true });
    s.addText(g.items.join('  •  '), { x: 0.5, y: y + 0.02, w: 8.0, h: 0.4, align: 'right', fontFace: FONT, fontSize: 13, color: C.text, rtlMode: true });
    y += 0.62;
  });
}

function introSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  s.addText('مقدمة عن النظام', { x: 0.5, y: 0.4, w: 12.33, h: 0.7, align: 'right', fontFace: FONT, fontSize: 30, color: C.primary, bold: true, rtlMode: true });
  s.addShape(pres.ShapeType.rect, { x: 11.0, y: 1.15, w: 1.83, h: 0.05, fill: { color: C.primary } });
  s.addText('«محلّل الكيانات» محرك بيانات مركزي يربط بين مصادر البيانات تلقائياً: يستوعب المستندات، يستخرج الكيانات، يكشف الروابط، وينتج تنبيهات تحليلية لحظية في بيئة معزولة.', { x: 0.5, y: 1.5, w: 12.33, h: 1.0, align: 'right', fontFace: FONT, fontSize: 16, color: C.text, rtlMode: true, valign: 'top' });
  const caps = [
    'استيعاب المستندات (PDF/نصوص/CSV) واستخراج الكيانات والروابط آلياً',
    'دمج البيانات: توحيد الكيانات المكررة عبر المصادر',
    'تحليل الشبكة: فهرس علاقات، خريطة تفاعلية، مقاييس مركزية، كشف مجتمعات',
    'تنبيهات تلقائية: محرك قواعد (CEP) يقيس الكيانات مقابل ملفات الخطر',
    'أدوات تحليلية متقدمة: ملف الكيان، تتبع التغيّرات، الفجوات، مقارنة الفترات',
    'تقرير سنوي تنفيذي بإحصاءات مجمّعة حسب السنة',
  ];
  let y = 2.7;
  caps.forEach((c) => {
    s.addShape(pres.ShapeType.chevron, { x: 12.2, y: y + 0.05, w: 0.22, h: 0.22, fill: { color: C.primary }, rotate: 180 });
    s.addText(c, { x: 0.5, y, w: 11.5, h: 0.5, align: 'right', fontFace: FONT, fontSize: 14, color: C.text, rtlMode: true, valign: 'middle' });
    y += 0.6;
  });
}

// مخطط تخطيطي موحّد لشاشة التطبيق (يمين: شريط جانبي، أعلى: ترويسة، وسط: بطاقات)
function schematic(s, accentLabel) {
  // خلفية الشاشة
  s.addShape(pres.ShapeType.rect, { x: 0.5, y: 2.5, w: 12.33, h: 4.6, fill: { color: C.card }, line: { color: C.border, width: 1 } });
  // الشريط الجانبي (يمين في RTL)
  s.addShape(pres.ShapeType.rect, { x: 10.4, y: 2.5, w: 2.43, h: 4.6, fill: { color: C.accent }, line: { color: C.border, width: 1 } });
  for (let i = 0; i < 5; i++) {
    s.addShape(pres.ShapeType.rect, { x: 10.6, y: 2.8 + i * 0.5, w: 2.0, h: 0.32, fill: { color: i === 0 ? C.primarySoft : C.white }, line: { color: C.border, width: 0.5 } });
    s.addText('•', { x: 10.6, y: 2.8 + i * 0.5, w: 2.0, h: 0.32, align: 'center', fontFace: FONT, fontSize: 10, color: C.muted, valign: 'middle' });
  }
  // الترويسة
  s.addShape(pres.ShapeType.rect, { x: 0.5, y: 2.5, w: 9.9, h: 0.6, fill: { color: C.white }, line: { color: C.border, width: 1 } });
  s.addText(accentLabel, { x: 0.7, y: 2.5, w: 9.5, h: 0.6, align: 'right', fontFace: FONT, fontSize: 11, color: C.muted, valign: 'middle', rtlMode: true });
  // بطاقات المحتوى
  for (let i = 0; i < 3; i++) {
    s.addShape(pres.ShapeType.rect, { x: 0.8 + i * 3.2, y: 3.4, w: 2.9, h: 1.5, fill: { color: C.white }, line: { color: C.border, width: 1 } });
    s.addShape(pres.ShapeType.rect, { x: 0.8 + i * 3.2, y: 3.4, w: 2.9, h: 0.3, fill: { color: C.primarySoft } });
    s.addText('بطاقة', { x: 0.8 + i * 3.2, y: 3.4, w: 2.9, h: 0.3, align: 'center', fontFace: FONT, fontSize: 9, color: C.primary, valign: 'middle', rtlMode: true });
    s.addShape(pres.ShapeType.rect, { x: 1.0 + i * 3.2, y: 3.85, w: 2.5, h: 0.18, fill: { color: C.border } });
    s.addShape(pres.ShapeType.rect, { x: 1.0 + i * 3.2, y: 4.15, w: 2.0, h: 0.14, fill: { color: C.border } });
    s.addShape(pres.ShapeType.rect, { x: 1.0 + i * 3.2, y: 4.4, w: 2.3, h: 0.14, fill: { color: C.border } });
  }
  // مخطط/جدول سفلي
  s.addShape(pres.ShapeType.rect, { x: 0.8, y: 5.2, w: 9.4, h: 1.6, fill: { color: C.white }, line: { color: C.border, width: 1 } });
  for (let i = 0; i < 4; i++) {
    s.addShape(pres.ShapeType.rect, { x: 0.8, y: 5.55 + i * 0.3, w: 9.4, h: 0.3, fill: { color: i % 2 ? C.accent : C.white }, line: { color: C.border, width: 0.3 } });
  }
  s.addText('جدول / مخطط', { x: 0.8, y: 5.2, w: 9.4, h: 0.35, align: 'center', fontFace: FONT, fontSize: 10, color: C.muted, valign: 'middle', rtlMode: true });
}

function moduleSlide(pres, m) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  // رقم الوحدة
  s.addShape(pres.ShapeType.roundRect, { x: 12.2, y: 0.4, w: 0.7, h: 0.7, fill: { color: C.primary }, rectRadius: 0.1 });
  s.addText(m.n, { x: 12.2, y: 0.4, w: 0.7, h: 0.7, align: 'center', fontFace: FONT, fontSize: 22, color: C.white, bold: true, valign: 'middle' });
  // العنوان
  s.addText(m.title, { x: 0.5, y: 0.4, w: 11.5, h: 0.55, align: 'right', fontFace: FONT, fontSize: 26, color: C.text, bold: true, rtlMode: true, valign: 'middle' });
  // وسم المسار
  s.addShape(pres.ShapeType.roundRect, { x: 9.6, y: 1.05, w: 3.3, h: 0.34, fill: { color: C.accent }, line: { color: C.border, width: 1 }, rectRadius: 0.05 });
  s.addText(m.route, { x: 9.6, y: 1.05, w: 3.3, h: 0.34, align: 'center', fontFace: 'Consolas', fontSize: 11, color: C.muted, valign: 'middle' });
  // تمهيد
  s.addText(m.lead, { x: 0.5, y: 1.5, w: 8.9, h: 0.7, align: 'right', fontFace: FONT, fontSize: 13, color: C.muted, italic: true, rtlMode: true, valign: 'top' });
  // قائمة المزايا (يمين الشاشة)
  let y = 2.5;
  m.features.forEach((f) => {
    s.addShape(pres.ShapeType.chevron, { x: 12.4, y: y + 0.06, w: 0.18, h: 0.18, fill: { color: C.primary }, rotate: 180 });
    s.addText(f, { x: 0.5, y, w: 11.7, h: 0.4, align: 'right', fontFace: FONT, fontSize: 12.5, color: C.text, rtlMode: true, valign: 'middle' });
    y += 0.45;
  });
  // مخطط تخطيطي
  // (نترك مساحة للمزايا ثم نضع المخطط في الأسفل إن وُجد متّسع)
  if (y < 6.6) {
    s.addShape(pres.ShapeType.rect, { x: 0.5, y: 6.7, w: 12.33, h: 0.04, fill: { color: C.border } });
    s.addText('تخطيط الشاشة', { x: 0.5, y: 6.78, w: 12.33, h: 0.3, align: 'right', fontFace: FONT, fontSize: 10, color: C.muted, rtlMode: true });
  }
}

function closingSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.primaryDark };
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: C.primary } });
  s.addText('شكراً لكم', { x: 0.5, y: 2.6, w: 12.33, h: 1.0, align: 'center', fontFace: FONT, fontSize: 48, color: 'FFFFFF', bold: true, rtlMode: true });
  s.addText('محلّل الكيانات — Strategic Data Fusion', { x: 0.5, y: 3.7, w: 12.33, h: 0.5, align: 'center', fontFace: FONT, fontSize: 18, color: 'FDECEC', rtlMode: true });
  s.addShape(pres.ShapeType.rect, { x: 0, y: 7.32, w: 13.33, h: 0.18, fill: { color: C.primary } });
}

export async function buildPresentation() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pres.author = 'Strategic Data Fusion';
  pres.title = 'محلّل الكيانات — العرض التقديمي';
  pres.rtlMode = true;

  titleSlide(pres);
  agendaSlide(pres);
  introSlide(pres);
  MODULES.forEach((m) => moduleSlide(pres, m));
  closingSlide(pres);

  await pres.writeFile({ fileName: 'محلل_الكيانات_العرض_التقديمي.pptx' });
}