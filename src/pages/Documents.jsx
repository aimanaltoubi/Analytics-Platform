import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DocumentUploader from '@/components/DocumentUploader';

const TYPE_LABELS = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير تحليلي',
  other: 'أخرى'
};

const STATUS_LABELS = {
  pending: 'بانتظار',
  processing: 'قيد المعالجة',
  processed: 'تمت المعالجة',
  failed: 'فشل'
};

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Document.list('-created_date', 100);
      setDocs(list);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const filtered = docs.filter((d) =>
    !query || d.title?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">المستندات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة المستندات المستوعبة وتحليلها</p>
        </div>
        <button
          onClick={() => setShowUploader((s) => !s)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
        >
          {showUploader ? 'إخفاء الرفع' : 'رفع مستند'}
        </button>
      </div>

      {showUploader && (
        <DocumentUploader onUploaded={() => { setShowUploader(false); setRefreshKey((k) => k + 1); }} />
      )}

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث في المستندات..."
          className="w-full pr-10 pl-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد مستندات. ارفع مستند PDF للبدء.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <Link
              key={d.id}
              to={`/documents/${d.id}`}
              className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[d.document_type] || 'أخرى'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                  d.status === 'processed' ? 'bg-emerald-100 text-emerald-700' :
                  d.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {STATUS_LABELS[d.status] || d.status}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {d.entity_count || 0} كيان • {d.connection_count || 0} رابط
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}