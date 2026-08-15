import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Users, FileText, Share2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TYPE_LABELS = {
  person: 'شخص',
  organization: 'منظمة',
  phone: 'هاتف',
  email: 'بريد',
  location: 'موقع',
  account: 'حساب',
  date: 'تاريخ',
  event: 'حدث',
  other: 'أخرى'
};

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ entities: [], documents: [], connections: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async (q) => {
    if (!q.trim()) {
      setResults({ entities: [], documents: [], connections: [] });
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const [ents, docs, conns] = await Promise.all([
        base44.entities.Entity.list('-mention_count', 500),
        base44.entities.Document.list('-created_date', 200),
        base44.entities.Connection.list('-created_date', 500)
      ]);
      const ql = q.toLowerCase();
      setResults({
        entities: ents.filter((e) =>
          e.name?.toLowerCase().includes(ql) ||
          (e.aliases || []).some((a) => a.toLowerCase().includes(ql))
        ).slice(0, 20),
        documents: docs.filter((d) =>
          d.title?.toLowerCase().includes(ql) ||
          (d.summary || '').toLowerCase().includes(ql)
        ).slice(0, 20),
        connections: conns.filter((c) =>
          c.source_entity_name?.toLowerCase().includes(ql) ||
          c.target_entity_name?.toLowerCase().includes(ql) ||
          (c.relationship_type || '').toLowerCase().includes(ql)
        ).slice(0, 20)
      });
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const total = results.entities.length + results.documents.length + results.connections.length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">البحث العام</h1>
        <p className="text-sm text-muted-foreground mt-1">ابحث عبر الكيانات والمستندات والروابط</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="اكتب اسم كيان، مستند، أو نوع علاقة..."
          className="w-full pr-11 pl-3 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">جارٍ البحث...</div>
      ) : !searched ? null : total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد نتائج مطابقة.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {results.entities.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-600" /> الكيانات ({results.entities.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {results.entities.map((e) => (
                  <Link
                    key={e.id}
                    to={`/entities/${e.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      {e.aliases?.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">{e.aliases.join('، ')}</div>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent shrink-0">
                      {TYPE_LABELS[e.type] || 'أخرى'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.documents.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> المستندات ({results.documents.length})
              </h3>
              <div className="space-y-2">
                {results.documents.map((d) => (
                  <Link
                    key={d.id}
                    to={`/documents/${d.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.title}</div>
                      {d.summary && <div className="text-xs text-muted-foreground truncate">{d.summary}</div>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{d.entity_count || 0} كيان</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.connections.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-600" /> الروابط ({results.connections.length})
              </h3>
              <div className="space-y-2">
                {results.connections.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-accent/30 text-sm">
                    <span className="font-medium">{c.source_entity_name}</span>
                    <span className="text-muted-foreground mx-1">—{c.relationship_type}→</span>
                    <span className="font-medium">{c.target_entity_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}