import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// مخطط استخراج بيان حدودي من نص حر (تقرير، ملف شخصي، سرد)
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    manifest_type: { type: 'string', enum: ['passenger', 'cargo'], description: 'ركاب أم شحن' },
    mode: { type: 'string', enum: ['air', 'sea'], description: 'وسيلة النقل: جوي أم بحري' },
    carrier: { type: 'string', description: 'اسم الناقل أو شركة الطيران/الملاحة كما ورد' },
    voyage_number: { type: 'string', description: 'رقم الرحلة أو الرحلة البحرية' },
    departure_location: { type: 'string', description: 'مكان المغادرة' },
    destination_location: { type: 'string', description: 'مكان الوصول/الوجهة' },
    departure_datetime: { type: 'string', description: 'وقت المغادرة بصيغة ISO إن أمكن' },
    passengers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم الراكب كما ورد' },
          passport_number: { type: 'string', description: 'رقم جواز السفر' },
          nationality: { type: 'string', description: 'الجنسية' },
          dob: { type: 'string', description: 'تاريخ الميلاد' },
          seat: { type: 'string', description: 'رقم المقعد إن ذُكر' }
        }
      }
    },
    cargo: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'وصف الشحنة' },
          weight: { type: 'string', description: 'الوزن' },
          consignee: { type: 'string', description: 'المرسَل إليه' },
          hazardous: { type: 'boolean', description: 'هل الشحنة خطرة' }
        }
      }
    },
    notes: { type: 'string', description: 'ملاحظات تحقيقية إضافية مستخلصة من النص' }
  },
  required: ['manifest_type', 'carrier', 'voyage_number']
};

const PROMPT = `أنت محلل روابط خبير في أمن الحدود والعبور. سيعرض عليك نصاً حراً (قد يكون ملف شخصي، تقرير تحقيق، سرد رحلة، أو بيان ركاب/شحن غير مهيكل). مهمتك استخراج بيان حدودي منظم يصلح للفحص والتحقيق:

1. حدد نوع البيان (ركاب أم شحن) ووسيلة النقل (جوي أم بحري).
2. استخرج الناقل ورقم الرحلة، ومكانَي المغادرة والوصول، ووقت المغادرة إن وُجد.
3. استخرج كل الأشخاص المذكورين كركاب مع: الاسم، رقم جواز السفر، الجنسية، تاريخ الميلاد، المقعد — قدر الإمكان من النص.
4. إن كان النص عن شحن، استخرج الشحنات: الوصف، الوزن، المرسَل إليه، وهل هي خطرة.
5. سجّل في "notes" أي تفاصيل تحقيقية ذات صلة (روابط مشبوهة، أسماء بديلة، تواريخ، أماكن مرتبطة) لا تندرج في الحقول أعلاه.

لا تخترع معلومات غير موجودة. اترك الحقل فارغاً إن لم يرد في النص. إن لم يُذكر رقم رحلة صريح، استنتج رمزاً معقولاً من الناقل والتاريخ إن أمكن، وإلا اتركه فارغاً.

نص المصدر:
"""${'__TEXT__'}"""`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const text = (body.text || '').toString().trim();
    if (!text) return Response.json({ error: 'النص فارغ' }, { status: 400 });

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: PROMPT.replace('__TEXT__', text.slice(0, 12000)),
      response_json_schema: EXTRACTION_SCHEMA
    });

    // قيم افتراضية آمنة
    const manifestType = llm.manifest_type === 'cargo' ? 'cargo' : 'passenger';
    const mode = llm.mode === 'sea' ? 'sea' : 'air';
    const carrier = (llm.carrier || 'غير محدد').toString().trim();
    const voyage = (llm.voyage_number || ('IMP-' + Date.now().toString().slice(-6))).toString().trim();

    const passengers = Array.isArray(llm.passengers)
      ? llm.passengers
          .filter((p) => p && (p.name || p.passport_number))
          .map((p) => ({
            name: (p.name || '').toString().trim(),
            passport_number: (p.passport_number || '').toString().trim(),
            nationality: (p.nationality || '').toString().trim(),
            dob: (p.dob || '').toString().trim(),
            seat: (p.seat || '').toString().trim()
          }))
      : [];

    const cargo = Array.isArray(llm.cargo)
      ? llm.cargo
          .filter((c) => c && (c.description || c.consignee))
          .map((c) => ({
            description: (c.description || '').toString().trim(),
            weight: (c.weight || '').toString().trim(),
            consignee: (c.consignee || '').toString().trim(),
            hazardous: !!c.hazardous
          }))
      : [];

    const manifest = await base44.entities.Manifest.create({
      manifest_type: manifestType,
      mode,
      carrier,
      voyage_number: voyage,
      departure_location: (llm.departure_location || '').toString().trim(),
      destination_location: (llm.destination_location || '').toString().trim(),
      departure_datetime: (llm.departure_datetime || '').toString().trim() || undefined,
      status: 'submitted',
      passengers: manifestType === 'passenger' ? passengers : [],
      cargo: manifestType === 'cargo' ? cargo : [],
      submitted_by: 'system',
      screening_summary: { source: 'text_import', notes: llm.notes || '', source_filename: body.filename || '' }
    });

    // فحص فوري (الـ workflow يتولى لاحقاً NER عبر processManifest)
    let screening = null;
    try {
      screening = await base44.functions.invoke('screenManifest', { manifest_id: manifest.id });
      screening = screening.data || screening;
    } catch (e) {}

    return Response.json({
      manifest_id: manifest.id,
      manifest_type: manifestType,
      carrier,
      voyage_number: voyage,
      passengers_extracted: passengers.length,
      cargo_extracted: cargo.length,
      screening
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}