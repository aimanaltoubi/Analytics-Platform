import { useState, useEffect } from 'react';
import { Brain, RefreshCw, Network, GitBranch, Link2, ShieldAlert, Users, Layers, AlertTriangle, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DOC_LABELS = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير تحليلي',
  other: 'أخرى'
};

export default function FusionInsights() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('runFusion', {});
      setInsights(res.data);
    } catch (e) {
      setInsights(null);
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  useEffect(() => { run(); }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Brain className="w-4 h-4 animate-pulse" /> جارٍ تشغيل محرك الدمج وتحليل الارتباطات...
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> تعذّر تشغيل محرك الدمج.
          </div>
          <button onClick={run} className="text-xs text-primary hover:underline">إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  const c = insights.correlation || {};
  const stats = [
    { label: 'كيان موحّد', value: c.entities, icon: Users, color: 'text-violet-600 bg-violet-50' },
    { label: 'رابط مترابط', value: c.connections, icon: Link2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'عنقود شبكي', value: c.clusters, icon: Network, color: 'text-blue-600 bg-blue-50' },
    { label: 'رابط تشارك جديد', value: c.cross_doc_links, icon: GitBranch, color: 'text-amber-600 bg-amber-50' },
    { label: 'كيانات مدمجة', value: c.duplicates_merged, icon: Layers, color: 'text-pink-600 bg-pink-50' },
    { label: 'مستند', value: c.documents, icon: Sparkles, color: 'text-cyan-600 bg-cyan-50' }
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/30 bg-gradient-to-l from-primary/5 to-transparent p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> محرك الدمج والارتباط
          </h3>
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} /> {running ? 'جارٍ التحليل...' : 'إعادة التشغيل'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          محرك مركزي يستوعب البيانات غير المنظمة وشبه المنظمة والمنظمة، ويُحدث الارتباطات بين الأفراد والأحداث والشبكات تلقائياً.
        </p>
      </div>

      {/* ملخص الارتباط */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3.5 hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-bold font-heading">{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* أكبر العناقيد */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><Network className="w-4 h-4 text-blue-500" /> أكبر العناقيد الشبكية</h4>
          <div className="space-y-3">
            {(insights.largest_clusters || []).map((cl, i) => (
              <div key={i} className="rounded-lg bg-accent/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">عنقود {i + 1}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{cl.size} كيان</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cl.members.map((m, j) => (
                    <span key={j} className="text-xs px-2 py-1 rounded-md bg-card border border-border">{m}</span>
                  ))}
                  {cl.size > cl.members.length && <span className="text-xs text-muted-foreground px-2 py-1">+{cl.size - cl.members.length}</span>}
                </div>
              </div>
            ))}
            {(insights.largest_clusters || []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد عناقيد.</p>}
          </div>
        </div>

        {/* الكيانات الجسرية */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><GitBranch className="w-4 h-4 text-amber-500" /> الكيانات الجسرية (أكثر ارتباطاً)</h4>
          <div className="space-y-2">
            {(insights.bridge_entities || []).map((b, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{b.name}</div>
                  <div className="text-[11px] text-muted-foreground">{b.type}</div>
                </div>
                <div className="text-left shrink-0">
                  <div className="text-sm font-semibold">{b.degree}</div>
                  <div className="text-[10px] text-muted-foreground">رابط</div>
                </div>
              </div>
            ))}
            {(insights.bridge_entities || []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد كيانات جسرية.</p>}
          </div>
        </div>

        {/* أعلى التشاركات */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-500" /> أقوى الارتباطات المشتركة</h4>
          <div className="space-y-2">
            {(insights.top_cooccurrence || []).map((p, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/40">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0 flex items-center gap-1.5 text-sm">
                  <span className="font-medium truncate">{p.a}</span>
                  <span className="text-muted-foreground shrink-0">↔</span>
                  <span className="font-medium truncate">{p.b}</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">{p.shared_docs} مستند</span>
              </div>
            ))}
            {(insights.top_cooccurrence || []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد تشاركات.</p>}
          </div>
        </div>

        {/* شبكة الخطورة */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-500" /> شبكة الخطورة</h4>
          <div className="space-y-2">
            {(insights.risk_network || []).map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-red-50/50 hover:bg-red-50">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground">مرتبط بـ {r.neighbors} كيان</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">{r.risk_score}</span>
              </div>
            ))}
            {(insights.risk_network || []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد كيانات عالية الخطورة.</p>}
          </div>
        </div>
      </div>

      {/* الكيانات المعزولة */}
      {insights.orphans && insights.orphans.count > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> كيانات معزولة ({insights.orphans.count})</h4>
          <div className="flex flex-wrap gap-1.5">
            {(insights.orphans.sample || []).map((o, i) => (
              <span key={i} className="text-xs px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">{o.name}</span>
            ))}
            {insights.orphans.count > (insights.orphans.sample || []).length && (
              <span className="text-xs text-muted-foreground px-2 py-1.5">+{insights.orphans.count - insights.orphans.sample.length}</span>
            )}
          </div>
        </div>
      )}

      {/* تقرير الدمج */}
      {(insights.merge_report || []).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h4 className="font-heading font-semibold mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-pink-500" /> تقرير توحيد الكيانات ({insights.merge_report.length} مجموعة)</h4>
          <div className="space-y-2">
            {insights.merge_report.map((g, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-accent/40">
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 shrink-0">{g.merged_count} مدمج</span>
                <div className="text-sm">
                  <span className="font-medium">{g.canonical}</span>
                  <span className="text-muted-foreground"> ({g.type}) دُمج مع: {g.duplicates.join('، ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}