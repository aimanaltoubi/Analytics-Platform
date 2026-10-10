import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Globe } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { Image } from '@/components/ui/image';

export default function NationalityDetail() {
  const { nationality } = useParams();
  const nat = decodeURIComponent(nationality || '');
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const all = await localClient.entities.Entity.list('-mention_count', 1000);
        setEntities(
          all.filter(
            (e) => e.type === 'person' && String(e.attributes?.['الجنسية'] || '').trim() === nat
          )
        );
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [nat]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="p-6 space-y-6">
      <Link to="/analytics" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> العودة للتحليلات
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" /> {nat}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{entities.length} شخص</p>
      </div>

      {entities.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا يوجد أشخاص بهذه الجنسية.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entities.map((e) => (
            <Link
              key={e.id}
              to={`/entities/${e.id}`}
              className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-start gap-3">
                {e.photo_url ? (
                  <Image
                    src={e.photo_url}
                    alt={e.name}
                    className="w-14 h-14 rounded-full border border-border shrink-0"
                    fittingType="fill"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-lg font-bold shrink-0 border border-border">
                    {e.name?.charAt(0) || '؟'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-heading font-semibold truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">الجنسية: {e.attributes?.['الجنسية']}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {e.mention_count || 0} ذكر • درجة خطورة {e.risk_score || 0}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/60">
                {Object.entries(e.attributes || {})
                  .filter(([k]) => k !== 'الجنسية')
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <div className="text-[11px] text-muted-foreground truncate">{k}</div>
                      <div className="text-xs font-medium truncate">{String(v)}</div>
                    </div>
                  ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}