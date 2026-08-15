import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Power } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const RULE_TYPES = {
  risk_threshold: 'عتبة الخطورة',
  watchlist: 'قائمة المراقبة',
  hub: 'كيان محوري',
  co_occurrence: 'تشارك مكثّف',
  cluster_size: 'عنقود كبير'
};
const SEV_OPTS = ['low', 'medium', 'high', 'critical'];
const SEV_LABEL = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };
const SEV_CLS = {
  low: 'bg-lime-100 text-lime-700', medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700'
};

export default function RiskProfileManager() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', rule_type: 'risk_threshold', severity: 'medium', min_risk_score: 70, min_degree: 10, min_shared_docs: 2, require_high_risk: false, min_size: 8 });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setProfiles(await base44.entities.RiskProfile.list('-created_date', 100)); }
    catch (e) {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p) => {
    try { await base44.entities.RiskProfile.update(p.id, { enabled: !p.enabled }); await load(); }
    catch (e) { toast({ variant: 'destructive', title: 'فشل التحديث' }); }
  };
  const remove = async (p) => {
    try { await base44.entities.RiskProfile.delete(p.id); await load(); }
    catch (e) { toast({ variant: 'destructive', title: 'فشل الحذف' }); }
  };

  const submit = async () => {
    if (!form.name.trim()) { toast({ variant: 'destructive', title: 'الاسم مطلوب' }); return; }
    const conditions = {};
    if (form.rule_type === 'risk_threshold') conditions.min_risk_score = Number(form.min_risk_score) || 0;
    if (form.rule_type === 'hub') conditions.min_degree = Number(form.min_degree) || 5;
    if (form.rule_type === 'co_occurrence') {
      conditions.min_shared_docs = Number(form.min_shared_docs) || 2;
      conditions.require_high_risk = !!form.require_high_risk;
    }
    if (form.rule_type === 'cluster_size') conditions.min_size = Number(form.min_size) || 5;
    try {
      await base44.entities.RiskProfile.create({
        name: form.name.trim(),
        description: form.description.trim(),
        rule_type: form.rule_type,
        conditions,
        severity: form.severity,
        enabled: true
      });
      toast({ title: 'تم إنشاء ملف الخطر' });
      setForm({ ...form, name: '', description: '' });
      setShowForm(false);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'فشل الإنشاء' });
    }
  };

  const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const label = 'text-xs font-medium text-muted-foreground mb-1 block';

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> ملفات الخطر (Risk Profiles)
        </h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" /> ملف جديد
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={label}>الاسم</label>
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: كيان عالي الخطورة" />
            </div>
            <div>
              <label className={label}>الوصف</label>
              <input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className={label}>نوع القاعدة</label>
              <select className={input} value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })}>
                {Object.entries(RULE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>خطورة التنبيه</label>
              <select className={input} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEV_OPTS.map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
              </select>
            </div>
            {form.rule_type === 'risk_threshold' && (
              <div>
                <label className={label}>الحد الأدنى لدرجة الخطورة</label>
                <input type="number" className={input} value={form.min_risk_score} onChange={(e) => setForm({ ...form, min_risk_score: e.target.value })} />
              </div>
            )}
            {form.rule_type === 'hub' && (
              <div>
                <label className={label}>الحد الأدنى لعدد الروابط</label>
                <input type="number" className={input} value={form.min_degree} onChange={(e) => setForm({ ...form, min_degree: e.target.value })} />
              </div>
            )}
            {form.rule_type === 'co_occurrence' && (
              <>
                <div>
                  <label className={label}>الحد الأدنى للمستندات المشتركة</label>
                  <input type="number" className={input} value={form.min_shared_docs} onChange={(e) => setForm({ ...form, min_shared_docs: e.target.value })} />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.require_high_risk} onChange={(e) => setForm({ ...form, require_high_risk: e.target.checked })} />
                    يتطلب كياناً عالي الخطورة
                  </label>
                </div>
              </>
            )}
            {form.rule_type === 'cluster_size' && (
              <div>
                <label className={label}>الحد الأدنى لحجم العنقود</label>
                <input type="number" className={input} value={form.min_size} onChange={(e) => setForm({ ...form, min_size: e.target.value })} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">حفظ</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent">إلغاء</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل...</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">لا توجد ملفات خطر. سيُنشئ المحرك ملفات افتراضية عند أول تشغيل.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <button onClick={() => toggle(p)} className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${p.enabled ? 'bg-primary' : 'bg-muted'}`} title={p.enabled ? 'مفعّل' : 'معطّل'}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${p.enabled ? 'left-0.5' : 'right-0.5'}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent">{RULE_TYPES[p.rule_type] || p.rule_type}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${SEV_CLS[p.severity] || ''}`}>{SEV_LABEL[p.severity] || p.severity}</span>
                  {!p.enabled && <span className="text-[11px] text-muted-foreground">معطّل</span>}
                </div>
                {p.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</div>}
                {p.conditions && Object.keys(p.conditions).length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {Object.entries(p.conditions).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                  </div>
                )}
              </div>
              <button onClick={() => remove(p)} className="p-1.5 rounded-md hover:bg-red-50 text-red-500 shrink-0" title="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}