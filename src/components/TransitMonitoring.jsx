import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertOctagon, Clock, ShieldAlert, Activity, Eye, Radio } from 'lucide-react';
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

export default function TransitMonitoring() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState('watch');
  const { toast } = useToast();

  const load = async () => {
    try { setAlerts(await localClient.entities.Alert.list('-triggered_at', 200)); }
    catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const unsub = localClient.entities.Alert.subscribe((event) => {
      if (event.type === 'create') {
        setAlerts((prev) => [event.data, ...prev].slice(0, 200));
      }
    });
    return unsub;
  }, []);

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

  const watchAlerts = alerts.filter((a) => a.rule_type === 'watchlist');
  const riskAlerts = alerts.filter((a) => a.rule_type === 'risk_threshold');
  const shown = filter === 'watch' ? watchAlerts : filter === 'risk' ? riskAlerts : alerts;
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  alerts.forEach((a) => { if (sevCounts[a.severity] != null) sevCounts[a.severity]++; });

  const cards = [
    { label: 'مطابقات قائمة المراقبة', value: watchAlerts.length, icon: Eye, color: 'bg-red-500' },
    { label: 'مطابقات عتبة الخطورة', value: riskAlerts.length, icon: ShieldAlert, color: 'bg-orange-500' },
    { label: 'تنبيهات نشطة', value: alerts.filter((a) => a.status !== 'resolved').length, icon: Activity, color: 'bg-blue-500' },
    { label: 'تنبيهات حرجة', value: sevCounts.critical, icon: AlertOctagon, color: 'bg-red-600' }
  ];

  const btn = (id, label) => `px-3 py-1.5 rounded-full text-xs border transition-colors ${
    filter === id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-accent'
  }`;

  return (
    <div className="space-y-4">
      {/* بطاقات المراقبة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-lg ${c.color} text-white flex items-center justify-center`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-2xl font-bold font-heading">{c.value}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* لوحة التنبيهات الحيّة */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" /> لوحة المراقبة الحيّة
            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> مباشر
            </span>
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
          <button onClick={() => setFilter('watch')} className={btn('watch')}>قائمة المراقبة ({watchAlerts.length})</button>
          <button onClick={() => setFilter('risk')} className={btn('risk')}>عتبة الخطورة ({riskAlerts.length})</button>
          <button onClick={() => setFilter('all')} className={btn('all')}>الكل ({alerts.length})</button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل...</p>
        ) : shown.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">لا توجد مطابقات حالياً.</p>
            <p className="text-xs text-muted-foreground mt-1">ستظهر التنبيهات فوراً عند مطابقة بيانات مستند مع قوائم المراقبة أو ملفات الخطر.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[520px] overflow-auto pe-1">
            {shown.map((a) => {
              const sv = SEV[a.severity] || SEV.medium;
              const isWatch = a.rule_type === 'watchlist';
              return (
                <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isWatch ? 'border-red-200 bg-red-50/40' : 'border-border hover:bg-accent/40'} transition-colors`}>
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
                      {a.details && a.details.document_title && <span className="ms-1">• {a.details.document_title}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}