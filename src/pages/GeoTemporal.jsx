import { useState, useEffect } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import GeoTemporalMap from '@/components/GeoTemporalMap';

export default function GeoTemporal() {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [ents, conns, docs] = await Promise.all([
        base44.entities.Entity.list('-mention_count', 1000),
        base44.entities.Connection.list('-created_date', 2000),
        base44.entities.Document.list('-created_date', 500)
      ]);
      setEntities(ents);
      setConnections(conns);
      setDocuments(docs);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const geocode = async () => {
    setGeocoding(true);
    try {
      const res = await base44.functions.invoke('geocodeLocations', {});
      toast({ title: `تم ترميز ${res.data.geocoded} موقع من ${res.data.total}` });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'فشل الترميز الجغرافي' });
    } finally { setGeocoding(false); }
  };

  const locCount = entities.filter((e) => e.type === 'location').length;
  const geoCount = entities.filter((e) => e.type === 'location' && e.latitude != null && e.longitude != null).length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" /> الخريطة الزمنية الجغرافية
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            رسم حوادث الشبكة عبر الزمن مع شريط زمني متحرك لتتبّع التطور الجغرافي للحركات والتحولات.
          </p>
        </div>
        <button
          onClick={geocode}
          disabled={geocoding}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${geocoding ? 'animate-spin' : ''}`} /> {geocoding ? 'جارٍ الترميز...' : 'ترميز المواقع جغرافياً'}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2.5 py-1 rounded-full bg-accent">{geoCount} موقع مُرمّز من {locCount}</span>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground text-center">جارٍ التحميل...</div>
      ) : (
        <GeoTemporalMap entities={entities} connections={connections} documents={documents} onLocationsChanged={load} />
      )}
    </div>
  );
}