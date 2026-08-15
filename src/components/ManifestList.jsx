import { useState, useEffect } from 'react';
import { Plane, Ship, AlertTriangle, CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const STATUS = {
  submitted: { label: 'قُدّم', cls: 'bg-blue-50 text-blue-700' },
  screening: { label: 'قيد الفحص', cls: 'bg-amber-50 text-amber-700' },
  cleared: { label: 'مخلو', cls: 'bg-emerald-50 text-emerald-700' },
  flagged: { label: 'مُعلّم', cls: 'bg-red-50 text-red-700' },
  intercepted: { label: 'اعتراض', cls: 'bg-red-100 text-red-800' }
};

export default function ManifestList() {
  const [manifests, setManifests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [rescreening, setRescreening] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setManifests(await base44.entities.Manifest.list('-created_date', 100)); }
    catch (e) {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rescreen = async (id) => {
    setRescreening(id);
    try { await base44.functions.invoke('screenManifest', { manifest_id: id }); await load(); toast({ title: 'تم إعادة الفحص' }); }
    catch (e) { toast({ variant: 'destructive', title: 'فشل الفحص' }); }
    finally { setRescreening(null); }
  };

  if (loading) return <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground text-center">جارٍ التحميل...</div>;
  if (manifests.length === 0) return <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground text-center">لا توجد بيانات مقدّمة بعد.</div>;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold">البيانات المقدّمة ({manifests.length})</h3>
        <button onClick={load} className="text-xs text-primary hover:underline">تحديث</button>
      </div>
      <div className="space-y-2">
        {manifests.map((m) => {
          const sum = m.screening_summary || {};
          const st = STATUS[m.status] || STATUS.submitted;
          const isExpanded = expanded === m.id;
          const flagged = (sum.flags || []).concat(sum.cargo_flags || []);
          return (
            <div key={m.id} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3 hover:bg-accent/40 transition-colors">
                <button onClick={() => setExpanded(isExpanded ? null : m.id)} className="flex items-center gap-3 flex-1 min-w-0 text-right">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${m.mode === 'air' ? 'bg-blue-50 text-blue-600' : 'bg-cyan-50 text-cyan-600'}`}>
                    {m.mode === 'air' ? <Plane className="w-4 h-4" /> : <Ship className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{m.carrier} • {m.voyage_number}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      {m.status === 'flagged' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      {m.status === 'cleared' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.departure_location || '—'} → {m.destination_location || '—'}
                      {m.departure_datetime && ` • ${new Date(m.departure_datetime).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`}
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={() => rescreen(m.id)} disabled={rescreening === m.id} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground disabled:opacity-50" title="إعادة الفحص">
                  <RefreshCw className={`w-4 h-4 ${rescreening === m.id ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border bg-accent/20">
                  <div className="grid grid-cols-3 gap-2 my-3 text-center">
                    <div className="rounded-lg bg-card p-2"><div className="text-lg font-bold">{sum.passengers_screened ?? (m.passengers || []).length}</div><div className="text-[11px] text-muted-foreground">راكب</div></div>
                    <div className="rounded-lg bg-card p-2"><div className="text-lg font-bold text-red-600">{sum.passengers_flagged || 0}</div><div className="text-[11px] text-muted-foreground">راكب مُعلّم</div></div>
                    <div className="rounded-lg bg-card p-2"><div className="text-lg font-bold text-orange-600">{sum.cargo_flagged || 0}</div><div className="text-[11px] text-muted-foreground">شحنة مُعلّمة</div></div>
                  </div>

                  {flagged.length === 0 ? (
                    <p className="text-sm text-emerald-600 py-2 text-center">لا توجد علامات تطابق. البيان مخلوع.</p>
                  ) : (
                    <div className="space-y-2">
                      {flagged.map((f, i) => (
                        <div key={i} className="rounded-lg bg-red-50/60 border border-red-200 p-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            <span className="text-sm font-medium">{f.name || f.consignee}</span>
                            {f.passport_number && <span className="text-[11px] px-2 py-0.5 rounded-full bg-card border border-border">جواز: {f.passport_number}</span>}
                            {f.seat && <span className="text-[11px] px-2 py-0.5 rounded-full bg-card border border-border">مقعد: {f.seat}</span>}
                          </div>
                          <ul className="mt-1.5 space-y-1">
                            {(f.reasons || [f.reason]).filter(Boolean).map((r, j) => (
                              <li key={j} className="text-xs text-red-700 flex items-start gap-1.5"><span className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0" />{r}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}