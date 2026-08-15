import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Share2, AlertTriangle, Clock } from 'lucide-react';
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

export default function Home() {
  const [stats, setStats] = useState({ documents: 0, entities: 0, connections: 0, processing: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [docs, ents, conns] = await Promise.all([
        base44.entities.Document.list('-created_date', 50),
        base44.entities.Entity.list('-mention_count', 8),
        base44.entities.Connection.list('-created_date', 1)
      ]);
      setStats({
        documents: docs.length,
        entities: ents.length,
        connections: conns.length,
        processing: docs.filter((d) => d.status === 'processing' || d.status === 'pending').length
      });
      setRecent(docs.slice(0, 5));
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  const cards = [
    { label: 'المستندات', value: stats.documents, icon: FileText, color: 'bg-blue-500' },
    { label: 'الكيانات', value: stats.entities, icon: Users, color: 'bg-violet-500' },
    { label: 'الروابط', value: stats.connections, icon: Share2, color: 'bg-emerald-500' },
    { label: 'قيد المعالجة', value: stats.processing, icon: AlertTriangle, color: 'bg-amber-500' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">استيعاب المستندات، استخراج الكيانات، وكشف الروابط الخفية</p>
      </div>

      {/* بطاقات الإحصاءات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg ${c.color} text-white flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold font-heading">{c.value}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DocumentUploader onUploaded={() => setRefreshKey((k) => k + 1)} />

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" /> أحدث المستندات
            </h3>
            <Link to="/documents" className="text-xs text-primary hover:underline">عرض الكل</Link>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">جارٍ التحميل...</div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">لا توجد مستندات بعد. ارفع أول مستند للبدء.</div>
          ) : (
            <div className="space-y-2">
              {recent.map((d) => (
                <Link
                  key={d.id}
                  to={`/documents/${d.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground">{TYPE_LABELS[d.document_type] || 'أخرى'}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                    d.status === 'processed' ? 'bg-emerald-100 text-emerald-700' :
                    d.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {STATUS_LABELS[d.status] || d.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}