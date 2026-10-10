import { createClientFromRequest } from '../../client.js';
import { runNer } from '../../shared/nerPipeline.js';

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
    const localClient = createClientFromRequest(req);

    const body = await req.json();
    const { document_id } = body;
    if (!document_id) return Response.json({ error: 'document_id مطلوب' }, { status: 400 });

    const doc = await localClient.entities.Document.get(document_id);
    if (!doc) {
      return Response.json({ error: 'المستند غير موجود' }, { status: 404 });
    }

    await localClient.entities.Document.update(document_id, { status: 'processing', error_message: '' });

    // 1) الحصول على النص: إن وُجد raw_text مسبقاً (مستند نصي) استخدمه، وإلا استخرج من الملف
    let fullText = '';
    if (doc.raw_text && doc.raw_text.trim()) {
      fullText = doc.raw_text;
    } else if (doc.file_url) {
      let extraction;
      try {
        extraction = await localClient.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
          file_url: doc.file_url,
          json_schema: EXTRACTION_SCHEMA
        });
      } catch (error) {
        await localClient.entities.Document.update(document_id, { status: 'failed', error_message: error.message });
        throw error;
      }
      const output = extraction && extraction.output;
      if (output) {
        if (typeof output.text === 'string' && output.text.trim()) fullText = output.text;
        else if (Array.isArray(output.pages)) fullText = output.pages.join('\n\n');
        else if (typeof output === 'string') fullText = output;
      }
    }

    if (!fullText.trim()) {
      await localClient.entities.Document.update(document_id, {
        status: 'failed',
        error_message: 'تعذّر استخراج النص من المستند'
      });
      return Response.json({ error: 'تعذّر استخراج النص من المستند' }, { status: 422 });
    }

    // 2) تحليل NER مشترك
    const result = await runNer(localClient, doc, document_id, fullText);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}