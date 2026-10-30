import { Link } from 'react-router-dom';
import { FileText, PenLine } from 'lucide-react';

export default function FieldSource({ source }) {
  if (!source) return null;
  if (source.kind === 'document' && source.document_id) {
    const pageHash = source.page ? `#page-${source.page}` : '#document-source';
    const pageText = source.page ? ` · صفحة ${source.page}` : '';
    return (
      <Link
        to={`/documents/${source.document_id}${pageHash}`}
        title={source.quote || source.document_title || 'فتح مصدر الحقل'}
        className="mt-1 inline-flex max-w-full items-center gap-1 text-[10px] text-primary hover:underline"
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span className="truncate">المصدر: {source.document_title || 'مستند'}{pageText}</span>
      </Link>
    );
  }
  if (source.kind === 'manual') {
    return (
      <span title={source.entered_at ? `أُدخل في ${new Date(source.entered_at).toLocaleString()}` : 'أُدخل يدوياً'} className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <PenLine className="h-3 w-3" /> مُدخل يدوياً
      </span>
    );
  }
  return null;
}
