import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, MapPin, Flag } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { entitiesForDocs, yearDocIdSet } from '@/lib/yearFilter';

// يستخرج القيمة الأولى غير الفارغة من مجموعة مفاتيح سمات محتملة
const firstAttr = (attrs, keys) => {
  if (!attrs) return '';
  for (const k of keys) {
    const v = attrs[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
};

const NAT_KEYS = ['الجنسية', 'الجنسية ', 'nationality', 'Nationality'];
const ORIGIN_KEYS = ['مكان الميلاد', 'محل الميلاد', 'المنشأ', 'الأصل', 'place_of_birth', 'birthplace', 'origin'];

export default function DemographicsOverview({ year }) {
  const [entities, setEntities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ents, docs] = await Promise.all([
          localClient.entities.Entity.list('-mention_count', 500),
          localClient.entities.Document.list('-created_date', 500)
        ]);
        setEntities(ents);
        setDocuments(docs);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const scoped = useMemo(() => entitiesForDocs(entities, yearDocIdSet(documents, year)), [entities, documents, year]);

  const stats = useMemo(() => {
    const persons = scoped.filter((e) => e.type === 'person');
    const locations = scoped.filter((e) => e.type === 'location' || (e.latitude && e.longitude));

    // الجنسيات
    const natMap = {};
    persons.forEach((e) => {
      const nat = firstAttr(e.attributes, NAT_KEYS);
      if (nat) natMap[nat] = (natMap[nat] || 0) + 1;
    });
    const nationalities = Object.entries(natMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // المناطق الجغرافية للأحداث: من كيانات المواقع + أماكن ذكرت في الروابط/المستندات
    const areaMap = {};
    const addArea = (name, entity, weight = 1) => {
      const key = String(name || '').trim();
      if (!key) return;
      if (!areaMap[key]) areaMap[key] = { name: key, count: 0, entityIds: new Set() };
      areaMap[key].count += weight;
      areaMap[key].entityIds.add(entity.id);
    };
    // من كيانات المواقع المسماة
    locations.forEach((e) => {
      addArea(e.name, e, e.mention_count || 1);
    });
    // من أماكن الميلاد/المنشأ للأشخاص
    persons.forEach((e) => {
      const origin = firstAttr(e.attributes, ORIGIN_KEYS);
      if (origin) addArea(origin, e);
    });
    // من سمة العنوان إن وُجدت
    scoped.forEach((e) => {
      const addr = firstAttr(e.attributes, ['العنوان', 'address', 'location']);
      if (addr) addArea(addr, e);
    });
    const areas = Object.values(areaMap).map((area) => ({ ...area, entityIds: [...area.entityIds] })).sort((a, b) => b.count - a.count).slice(0, 12);

    return { nationalities, areas, totalPersons: persons.length };
  }, [scoped]);

  if (loading) return <div className="text-sm text-muted-foreground py-6 text-center">جارٍ تحميل التركيبة السكانية...</div>;

  const kpis = [
    { label: 'الجنسيات', value: stats.nationalities.length, icon: Flag, tint: 'text-blue-600', bg: 'bg-blue-50', to: '/entities?has_nationality=1' },
    { label: 'المناطق الجغرافية', value: stats.areas.length, icon: MapPin, tint: 'text-emerald-600', bg: 'bg-emerald-50', to: '/entities?has_geography=1' }
  ];

  const maxArea = Math.max(...stats.areas.map((a) => a.count), 1);
  const maxNat = Math.max(...stats.nationalities.map((n) => n.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <Globe className="w-4 h-4 text-primary" />
        <h2 className="font-heading text-base font-semibold">التركيبة السكانية والجغرافية</h2>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* مؤشرات سريعة */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to} className="block rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-lg ${k.bg} ${k.tint} flex items-center justify-center`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-2xl font-bold font-heading tabular-nums">{k.value}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">{k.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* الجنسيات */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <Flag className="w-4 h-4 text-blue-500" /> توزيع الجنسيات
          </h3>
          {stats.nationalities.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">لا توجد بيانات جنسيات.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {stats.nationalities.slice(0, 15).map((n) => (
                <Link key={n.name} to={`/nationalities/${encodeURIComponent(n.name)}`} className="block group">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium group-hover:text-primary transition-colors truncate">{n.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{n.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-accent overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500/70 group-hover:bg-blue-500 transition-colors" style={{ width: `${(n.count / maxNat) * 100}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* المناطق الجغرافية للأحداث */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-500" /> المناطق الجغرافية للأحداث
          </h3>
          {stats.areas.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">لا توجد بيانات جغرافية بعد.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {stats.areas.map((a) => (
                <Link key={a.name} to={a.entityIds.length === 1 ? `/database?entity_id=${encodeURIComponent(a.entityIds[0])}` : `/entities?has_geography=1&query=${encodeURIComponent(a.name)}`} className="block rounded-md px-2 py-1 hover:bg-accent/50">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium truncate">{a.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{a.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-accent overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(a.count / maxArea) * 100}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}