import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle2, XCircle, AlertOctagon, Clock } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';

const SEV = {
  critical: { label: 'حرجة', cls: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  high: { label: 'عالية', cls: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  medium: { label: 'متوسطة', cls: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  low: { label: 'منخفضة', cls: 'bg-lime-100 text-lime-700 border-lime-200', dot: 'bg-lime-500' }
};
const STATUS = { new: 'جديد', acknowledged: 'مُعتمَد', resolved: 'محلول' };
const STATUS_CLS = { new: 'bg-blue-50 text-blue-700', acknowledged: 'bg-amber-50 text-amber-700', resolved: 'bg-emerald-50 text-emerald-700' };

function fmtTime(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AlertsList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setAlerts(await localClient.entities.Alert.list('-triggered_at', 200));
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const run = async () => {
    setRunning(true);
    try {
      const res = await localClient.functions.invoke('runCepAlerts', {});
      toast({ title: 'تم تشغيل المحرك', description: `${res.data.alerts_created} تنبيه جديد` });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'فشل تشغيل المحرك' });
    } finally { setRunning(false); }
  };

  const update = async (id, status) => {
    try { await localClient.entities.Alert.update(id, { status }); await load(); }
    catch (e) { toast({ variant: 'destructive', title: 'فشل التحديث' }); }
  };

  const filtered = alerts.filter((a) => filter === 'all' || a.status === filter);
  const counts = alerts.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-red-500" /> التنبيهات ({alerts.length})
        </h3>
        <button
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} /> {running ? 'جارٍ التشغيل...' : 'تشغيل المحرك الآن'}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs">
        {['all', 'new', 'acknowledged', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-accent'
            }`}
          >
            {f === 'all' ? `الكل (${alerts.length})` : `${STATUS[f] || f} (${counts[f] || 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">لا توجد تنبيهات. شغّل المحرك لتقييم البيانات مقابل ملفات الخطر.</p>
      ) : (
        <div className="space-y-2 max-h-[560px] overflow-auto pe-1">
          {filtered.map((a) => {
            const sv = SEV[a.severity] || SEV.medium;
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/40 transition-colors">
                <span className={`w-2.5 h-2.5 rounded-full ${sv.dot} mt-1.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${sv.cls}`}>{sv.label}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLS[a.status] || ''}`}>{STATUS[a.status] || a.status}</span>
                  </div>
                  {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
                  {a.entity_names && a.entity_names.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {a.entity_names.slice(0, 6).map((n, i) => {
                        const id = a.entity_ids && a.entity_ids[i];
                        return id ? (
                          <Link key={i} to={`/entities/${id}`} className="text-[11px] px-2 py-0.5 rounded-md bg-accent hover:bg-accent/70 truncate max-w-[140px]">{n}</Link>
                        ) : (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-accent truncate max-w-[140px]">{n}</span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5">
                    <Clock className="w-3 h-3" /> {fmtTime(a.triggered_at)}
                    {a.rule_name && <span className="ms-1">• {a.rule_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.status !== 'acknowledged' && a.status !== 'resolved' && (
                    <button onClick={() => update(a.id, 'acknowledged')} className="p-1.5 rounded-md hover:bg-amber-50 text-amber-600" title="اعتماد">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {a.status !== 'resolved' && (
                    <button onClick={() => update(a.id, 'resolved')} className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600" title="حلّ">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}