import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runNer } from '../../shared/nerPipeline.ts';

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    pages: { type: 'array', items: { type: 'string' } }
  },
  required: ['text']
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { document_id } = body;
    if (!document_id) return Response.json({ error: 'document_id مطلوب' }, { status: 400 });

    const doc = await base44.entities.Document.get(document_id);
    if (!doc || doc.created_by_id !== user.id) {
      return Response.json({ error: 'المستند غير موجود' }, { status: 404 });
    }

    await base44.entities.Document.update(document_id, { status: 'processing', error_message: '' });

    // 1) الحصول على النص: إن وُجد raw_text مسبقاً (مستند نصي) استخدمه، وإلا استخرج من الملف
    let fullText = '';
    if (doc.raw_text && doc.raw_text.trim()) {
      fullText = doc.raw_text;
    } else if (doc.file_url) {
      const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: doc.file_url,
        json_schema: EXTRACTION_SCHEMA
      });
      const output = extraction && extraction.output;
      if (output) {
        if (typeof output.text === 'string' && output.text.trim()) fullText = output.text;
        else if (Array.isArray(output.pages)) fullText = output.pages.join('\n\n');
        else if (typeof output === 'string') fullText = output;
      }
    }

    if (!fullText.trim()) {
      await base44.entities.Document.update(document_id, {
        status: 'failed',
        error_message: 'تعذّر استخراج النص من المستند'
      });
      return Response.json({ error: 'تعذّر استخراج النص من المستند' }, { status: 422 });
    }

    // 2) تحليل NER مشترك
    const result = await runNer(base44, doc, document_id, fullText);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}