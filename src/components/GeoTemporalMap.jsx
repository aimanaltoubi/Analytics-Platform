import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, SkipBack, Calendar } from 'lucide-react';

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  const m = String(str).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let yy = m[3];
    if (yy.length === 2) yy = '20' + yy;
    const d2 = new Date(Number(yy), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

function fmt(d) {
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function GeoTemporalMap({ entities, connections, documents }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  const { incidents, locations } = useMemo(() => {
    const docsById = {};
    documents.forEach((d) => { docsById[d.id] = d; });
    const locByDoc = {};
    const dateByDoc = {};
    const locs = [];
    entities.forEach((e) => {
      if (e.type === 'location' && e.latitude != null && e.longitude != null) {
        locs.push(e);
        (e.document_ids || []).forEach((did) => { locByDoc[did] = e; });
      }
      if (e.type === 'date') {
        const dt = parseDate(e.name);
        if (dt) {
          (e.document_ids || []).forEach((did) => { if (!dateByDoc[did]) dateByDoc[did] = dt; });
        }
      }
    });
    const list = [];
    connections.forEach((c) => {
      const doc = c.document_id ? docsById[c.document_id] : null;
      const loc = c.document_id ? locByDoc[c.document_id] : null;
      if (!loc) return;
      const date = (c.document_id && dateByDoc[c.document_id]) || (doc ? parseDate(doc.created_date) : null);
      if (!date) return;
      list.push({
        id: c.id,
        lat: loc.latitude,
        lng: loc.longitude,
        date,
        label: (c.source_entity_name || '') + ' ↔ ' + (c.target_entity_name || ''),
        rel: c.relationship_type,
        docTitle: doc ? doc.title : null,
        locName: loc.name
      });
    });
    list.sort((a, b) => a.date - b.date);
    return { incidents: list, locations: locs };
  }, [entities, connections, documents]);

  useEffect(() => { setIdx(0); setPlaying(false); }, [incidents.length]);

  useEffect(() => {
    if (!playing || incidents.length === 0) {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      return;
    }
    timer.current = setInterval(() => {
      setIdx((p) => {
        if (p >= incidents.length - 1) { setPlaying(false); return p; }
        return p + 1;
      });
    }, 900);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [playing, incidents.length]);

  const hasGeo = incidents.length > 0 || locations.length > 0;
  const safeIdx = Math.min(idx, Math.max(incidents.length - 1, 0));
  const currentTime = incidents.length > 0 ? incidents[safeIdx].date : null;
  const visibleIncidents = incidents.filter((e) => e.date <= currentTime);
  const latestId = incidents.length > 0 ? incidents[safeIdx].id : null;

  const center = useMemo(() => {
    if (locations.length > 0) {
      const lat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length;
      const lng = locations.reduce((s, l) => s + l.longitude, 0) / locations.length;
      return [lat, lng];
    }
    return [33.5, 38.4];
  }, [locations]);

  const btn = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button disabled={incidents.length === 0} onClick={() => { setIdx(0); setPlaying(false); }} className={btn} title="من البداية">
            <SkipBack className="w-4 h-4" />
          </button>
          <button disabled={incidents.length === 0} onClick={() => setPlaying((p) => !p)} className={btn + ' bg-primary text-primary-foreground hover:bg-primary/90 border-primary'} title="تشغيل/إيقاف">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-[200px]" dir="ltr">
            <input
              type="range"
              min={0}
              max={Math.max(incidents.length - 1, 0)}
              value={safeIdx}
              onChange={(e) => { setIdx(Number(e.target.value)); setPlaying(false); }}
              className="w-full accent-primary"
            />
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4 h-4" />
            {currentTime ? fmt(currentTime) : '—'}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{visibleIncidents.length}/{incidents.length} حدث</span>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {hasGeo ? (
          <MapContainer center={center} zoom={5} style={{ height: 560, width: '100%' }} scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            {locations.map((l) => (
              <CircleMarker key={'loc' + l.id} center={[l.latitude, l.longitude]} radius={5} pathOptions={{ color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 0.35 }}>
                <Popup>{l.name}</Popup>
              </CircleMarker>
            ))}
            {visibleIncidents.map((ev) => {
              const isLatest = ev.id === latestId;
              return (
                <CircleMarker
                  key={ev.id}
                  center={[ev.lat, ev.lng]}
                  radius={isLatest ? 12 : 7}
                  pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: isLatest ? 0.9 : 0.5 }}
                >
                  <Popup>
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold">{ev.label}</div>
                      <div className="text-muted-foreground">{fmt(ev.date)}</div>
                      {ev.rel && <div className="text-muted-foreground">{ev.rel}</div>}
                      {ev.locName && <div>📍 {ev.locName}</div>}
                      {ev.docTitle && <div className="text-muted-foreground">المستند: {ev.docTitle}</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="h-[560px] flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            لا توجد مواقع مُرمّزة جغرافياً بعد. استخدم زر «ترميز المواقع» أعلى الصفحة لتحديد إحداثيات كيانات المواقع، ثم ستظهر الحوادث على الخريطة.
          </div>
        )}
      </div>
    </div>
  );
}