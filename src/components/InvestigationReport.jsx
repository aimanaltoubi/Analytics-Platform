import { useState, useRef } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

const th = { border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 600 };
const td = { border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' };

export default function InvestigationReport({ title, entities = [], connections = [], documents = [], summary }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const generate = async () => {
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(img, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`تقرير-${(title || 'تحقيق').replace(/\s+/g, '-')}.pdf`);
      toast({ title: 'تم تصدير التقرير' });
    } catch (e) {
      toast({ title: 'فشل التصدير', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div>
      <button
        onClick={generate}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        {busy ? 'جارٍ التصدير...' : 'تصدير تقرير تحقيق (PDF)'}
      </button>

      <div ref={ref} dir="rtl" style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', padding: '36px', background: '#ffffff', fontFamily: 'Cairo, sans-serif', color: '#0f172a' }}>
        <div style={{ borderBottom: '3px solid #1d4ed8', paddingBottom: '14px', marginBottom: '22px' }}>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>تقرير تحقيق — {title}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')} • عدد الكيانات: {entities.length} • عدد الروابط: {connections.length}
          </div>
        </div>

        {summary && (
          <div style={{ fontSize: '13px', lineHeight: 1.8, background: '#f1f5f9', padding: '12px 14px', borderRadius: '8px', marginBottom: '22px' }}>
            {summary}
          </div>
        )}

        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>الكيانات ({entities.length})</div>
        {entities.length > 0 ? (
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <thead>
              <tr style={{ background: '#e2e8f0' }}>
                <th style={th}>الاسم</th>
                <th style={th}>النوع</th>
                <th style={th}>الخطورة</th>
                <th style={th}>المراقبة</th>
                <th style={th}>الذكر</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id}>
                  <td style={td}>{e.name}</td>
                  <td style={td}>{TYPE_LABELS[e.type] || 'أخرى'}</td>
                  <td style={td}>{e.risk_score || 0}</td>
                  <td style={td}>{e.watchlist ? 'نعم' : 'لا'}</td>
                  <td style={td}>{e.mention_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px' }}>لا توجد كيانات.</div>}

        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>الروابط ({connections.length})</div>
        {connections.length > 0 ? (
          <div style={{ fontSize: '11px', lineHeight: 1.9 }}>
            {connections.slice(0, 150).map((c) => (
              <div key={c.id} style={{ marginBottom: '3px' }}>
                • {c.source_entity_name || '—'} <span style={{ color: '#1d4ed8', fontWeight: 600 }}>[{c.relationship_type}]</span> {c.target_entity_name || '—'}
              </div>
            ))}
            {connections.length > 150 && <div style={{ color: '#64748b', marginTop: '4px' }}>... و {connections.length - 150} رابط آخر</div>}
          </div>
        ) : <div style={{ fontSize: '12px', color: '#64748b' }}>لا توجد روابط.</div>}

        {documents && documents.length > 0 && (
          <>
            <div style={{ fontSize: '16px', fontWeight: 700, margin: '20px 0 10px' }}>المستندات ({documents.length})</div>
            <div style={{ fontSize: '11px', lineHeight: 1.9 }}>
              {documents.map((d) => (
                <div key={d.id} style={{ marginBottom: '3px' }}>• {d.title} — {d.entity_count || 0} كيان • {d.connection_count || 0} رابط</div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: '28px', paddingTop: '10px', borderTop: '1px solid #cbd5e1', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
          وثيقة تحليلية — محلّل الكيانات
        </div>
      </div>
    </div>
  );
}