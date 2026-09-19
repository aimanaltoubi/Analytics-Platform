import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Database as DatabaseIcon, Users, Building2, Building, Search, ArrowLeft, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PiiEditor from '@/components/PiiEditor';
import { Image as UIImage } from '@/components/ui/image';

export default function Database() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('person');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const load = async () => {
    try {
      const all = await base44.entities.Entity.list('-mention_count', 1000);
      setEntities(all.filter((e) => e.type === 'person' || e.type === 'company' || e.type === 'organization'));
    } catch (e) {} finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return entities
      .filter((e) => e.type === tab)
      .filter((e) => !search || (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.aliases || []).some((a) => a.toLowerCase().includes(search.toLowerCase())) ||
        Object.values(e.attributes || {}).some((v) => String(v).toLowerCase().includes(search.toLowerCase())));
  }, [entities, tab, search]);

  const selected = entities.find((e) => e.id === selectedId) || null;

  const counts = {
    person: entities.filter((e) => e.type === 'person').length,
    company: entities.filter((e) => e.type === 'company').length,
    organization: entities.filter((e) => e.type === 'organization').length
  };

  const summaryPii = (e) => {
    const a = e.attributes || {};
    if (e.type === 'person') return [a['تاريخ الميلاد'], a['الجنسية'], a['رقم الجواز'], a['رقم الهاتف']].filter(Boolean);
    if (e.type === 'company') return [a['رقم التسجيل'], a['السجل التجاري'], a['الدولة'], a['رقم الهاتف']].filter(Boolean);
    return [a['رقم التسجيل'], a['الدولة'], a['رقم الهاتف']].filter(Boolean);
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="px-6 pt-5 pb-4 border-b border-border bg-card/40">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Data Registry</div>
            <h1 className="font-heading text-2xl font-bold leading-tight">قاعدة بيانات الكيانات</h1>
            <p className="text-sm text-muted-foreground mt-1">سجل منظّم لجميع الأفراد والشركات والمنظمات المستخرجة من المستندات — أضف وأكمل البيانات الشخصية والتعريفية لكل كيان.</p>
          </div>
          <button onClick={() => { setRefreshing(true); load(); }} disabled={refreshing} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-xs hover:bg-accent disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] min-h-0">
        {/* قائمة الكيانات */}
        <div className="border-l border-border bg-card flex flex-col min-h-0">
          <div className="p-3 border-b border-border space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { key: 'person', label: 'الأفراد', icon: Users, count: counts.person, activeCls: 'bg-blue-50 text-blue-700 border-blue-200' },
                { key: 'company', label: 'الشركات', icon: Building, count: counts.company, activeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { key: 'organization', label: 'المنظمات', icon: Building2, count: counts.organization, activeCls: 'bg-violet-50 text-violet-700 border-violet-200' }
              ].map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTab(t.key); setSelectedId(''); }}
                    className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg border text-xs font-medium transition-colors ${active ? t.activeCls : 'border-border bg-background text-muted-foreground hover:bg-accent/50'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{t.label}</span>
                    <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/70' : 'bg-accent'}`}>{t.count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو السمة..."
                className="w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {!loading && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/30">
                <span className="text-[11px] font-medium text-muted-foreground">{filtered.length} نتيجة</span>
                <span className="text-[10px] text-muted-foreground/70">مرتبة حسب الذكر</span>
              </div>
            )}
            {loading ? (
              <div className="text-sm text-muted-foreground py-10 text-center">جارٍ التحميل...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center px-4">
                {entities.length === 0 ? 'لا توجد كيانات مستخرجة بعد. عالج المستندات لاستخراج الأفراد والشركات والمنظمات.' : 'لا توجد نتائج مطابقة.'}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filtered.map((e) => {
                  const active = e.id === selectedId;
                  const pii = summaryPii(e);
                  const typeLabel = e.type === 'person' ? 'فرد' : e.type === 'company' ? 'شركة' : 'منظمة';
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full text-right flex items-center gap-3 px-3 py-2.5 transition-colors border-r-2 ${active ? 'bg-primary/10 border-primary' : 'border-transparent hover:bg-accent/50'}`}
                    >
                      {e.photo_url ? (
                        <UIImage src={e.photo_url} alt={e.name} className="w-10 h-10 rounded-lg shrink-0 border border-border" fittingType="fill" />
                      ) : (
                        <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${e.type === 'person' ? 'bg-blue-50 text-blue-600' : e.type === 'company' ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
                          {e.type === 'person' ? <Users className="w-5 h-5" /> : e.type === 'company' ? <Building className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{e.name}</span>
                          {e.watchlist && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="مراقَب" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {pii.length > 0 ? pii.join(' · ') : 'لا توجد بيانات مسجلة'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{typeLabel}</span>
                          <span className="text-[9px] text-muted-foreground">{e.mention_count || 0} ذكر</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* المحرر */}
        <div className="overflow-auto">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
              <DatabaseIcon className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-heading font-semibold text-lg">اختر كياناً لعرضه وتحريره</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">حدّد اسماً من القائمة لعرض وتحرير البيانات الشخصية والتعريفية الكاملة (تاريخ الميلاد، رقم الجواز، الهوية، الهاتف، البريد، العنوان...).</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <Link to={`/entities/${selected.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4" /> صفحة الكيان الكاملة
                </Link>
                <span className="text-xs text-muted-foreground">{selected.type === 'person' ? 'فرد' : selected.type === 'company' ? 'شركة' : 'منظمة'} · {selected.mention_count || 0} ذكر</span>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <PiiEditor
                  key={selected.id + (selected.updated_date || '')}
                  entity={selected}
                  onSaved={(updated) => {
                    setEntities((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}