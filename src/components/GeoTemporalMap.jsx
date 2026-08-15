import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, SkipBack, Calendar, MapPin, Pencil, Plus, Route, X, Satellite, Map as MapIcon, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

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

const TRACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16'];

function ClickHandler({ onClick, active }) {
  useMapEvents({ click: (e) => { if (active) onClick(e.latlng); } });
  return null;
}

export default function GeoTemporalMap({ entities, connections, documents, onLocationsChanged }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [trackEntity, setTrackEntity] = useState('all');
  const [placing, setPlacing] = useState(false);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [linkEntityId, setLinkEntityId] = useState('');
  const [linkLocId, setLinkLocId] = useState('');
  const [linking, setLinking] = useState(false);
  const [focusEntity, setFocusEntity] = useState('');
  const [movementPerson, setMovementPerson] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const timer = useRef(null);
  const { toast } = useToast();

  const { incidents, locations } = useMemo(() => {
    const docsById = {};
    documents.forEach((d) => { docsById[d.id] = d; });
    const locByDoc = {};
    const dateByDoc = {};
    const locById = {};
    const locs = [];
    entities.forEach((e) => {
      if (e.type === 'location' && e.latitude != null && e.longitude != null) {
        locs.push(e);
        locById[e.id] = e;
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
      if (c.document_id) {
        const doc = docsById[c.document_id] || null;
        const loc = locByDoc[c.document_id] || null;
        if (!loc) return;
        const date = dateByDoc[c.document_id] || (doc ? parseDate(doc.created_date) : null);
        if (!date) return;
        list.push({
          id: c.id,
          lat: loc.latitude,
          lng: loc.longitude,
          date,
          sourceName: c.source_entity_name || '',
          targetName: c.target_entity_name || '',
          label: (c.source_entity_name || '') + ' ↔ ' + (c.target_entity_name || ''),
          rel: c.relationship_type,
          docTitle: doc ? doc.title : null,
          locName: loc.name
        });
      } else if (c.relationship_type === 'موجود في' && locById[c.target_entity_id]) {
        const loc = locById[c.target_entity_id];
        const date = parseDate(c.evidence);
        if (!date) return;
        list.push({
          id: c.id,
          lat: loc.latitude,
          lng: loc.longitude,
          date,
          sourceName: c.source_entity_name || '',
          targetName: loc.name,
          label: (c.source_entity_name || '') + ' ↔ ' + loc.name,
          rel: 'موجود في',
          docTitle: null,
          locName: loc.name
        });
      }
    });
    list.sort((a, b) => a.date - b.date);
    return { incidents: list, locations: locs };
  }, [entities, connections, documents]);

  const displayIncidents = useMemo(() => {
    if (!movementPerson && !dateFrom && !dateTo) return incidents;
    const personName = movementPerson ? entities.find((e) => e.id === movementPerson)?.name : null;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
    return incidents.filter((inc) => {
      if (personName && inc.sourceName !== personName && inc.targetName !== personName) return false;
      if (from && inc.date < from) return false;
      if (to && inc.date > to) return false;
      return true;
    });
  }, [incidents, movementPerson, dateFrom, dateTo, entities]);

  // مسارات الحركة لكل كيان (نقاط مرتبة زمنياً)
  const tracks = useMemo(() => {
    const byEnt = {};
    displayIncidents.forEach((inc) => {
      [inc.sourceName, inc.targetName].forEach((name) => {
        if (!name) return;
        if (!byEnt[name]) byEnt[name] = [];
        const last = byEnt[name][byEnt[name].length - 1];
        if (!last || last.lat !== inc.lat || last.lng !== inc.lng) {
          byEnt[name].push({ lat: inc.lat, lng: inc.lng, date: inc.date, locName: inc.locName });
        }
      });
    });
    return Object.entries(byEnt)
      .map(([name, pts], i) => ({ name, points: pts, color: TRACK_COLORS[i % TRACK_COLORS.length] }))
      .filter((t) => t.points.length >= 2)
      .sort((a, b) => b.points.length - a.points.length);
  }, [displayIncidents]);

  useEffect(() => { setIdx(0); setPlaying(false); }, [displayIncidents.length]);

  useEffect(() => {
    if (!playing || displayIncidents.length === 0) {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      return;
    }
    timer.current = setInterval(() => {
      setIdx((p) => {
        if (p >= displayIncidents.length - 1) { setPlaying(false); return p; }
        return p + 1;
      });
    }, 900);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [playing, displayIncidents.length]);

  const hasGeo = displayIncidents.length > 0 || locations.length > 0;
  const safeIdx = Math.min(idx, Math.max(displayIncidents.length - 1, 0));
  const currentTime = displayIncidents.length > 0 ? displayIncidents[safeIdx].date : null;
  const visibleIncidents = displayIncidents.filter((e) => e.date <= currentTime);
  const latestId = displayIncidents.length > 0 ? displayIncidents[safeIdx].id : null;

  const center = useMemo(() => {
    if (locations.length > 0) {
      const lat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length;
      const lng = locations.reduce((s, l) => s + l.longitude, 0) / locations.length;
      return [lat, lng];
    }
    return [33.5, 38.4];
  }, [locations]);

  const locEntities = useMemo(() => entities.filter((e) => e.type === 'location'), [entities]);
  const unlocatedCount = locEntities.filter((e) => e.latitude == null).length;
  const linkableEntities = useMemo(() => entities.filter((e) => e.type !== 'location').slice(0, 300), [entities]);
  const geoLocations = useMemo(() => locEntities.filter((e) => e.latitude != null), [locEntities]);
  const locEntityIds = useMemo(() => new Set(locEntities.map((e) => e.id)), [locEntities]);
  const linkedByLoc = useMemo(() => {
    const m = {};
    connections.forEach((c) => {
      if (c.relationship_type === 'موجود في') {
        (m[c.target_entity_id] || (m[c.target_entity_id] = [])).push(c.source_entity_name);
      }
    });
    return m;
  }, [connections]);
  const linkedLocIds = useMemo(() => {
    if (!focusEntity) return null;
    const ids = new Set();
    connections.forEach((c) => {
      if (c.source_entity_id === focusEntity && locEntityIds.has(c.target_entity_id)) ids.add(c.target_entity_id);
      if (c.target_entity_id === focusEntity && locEntityIds.has(c.source_entity_id)) ids.add(c.source_entity_id);
    });
    return ids;
  }, [focusEntity, connections, locEntityIds]);

  const createLink = async () => {
    if (!linkEntityId || !linkLocId) { toast({ variant: 'destructive', title: 'اختر كياناً وموقعاً' }); return; }
    setLinking(true);
    try {
      const ent = entities.find((e) => e.id === linkEntityId);
      const loc = entities.find((e) => e.id === linkLocId);
      // اشتقاق تاريخ الذكر تلقائياً من تقارير ذكر الكيان
      let dateStr = null;
      try {
        const mentions = await base44.entities.Mention.filter({ entity_id: linkEntityId }, '-created_date', 50);
        const docIds = [...new Set(mentions.map((m) => m.document_id).filter(Boolean))];
        for (const did of docIds) {
          const dateEnt = entities.find((e) => e.type === 'date' && (e.document_ids || []).includes(did));
          if (dateEnt) { const d = parseDate(dateEnt.name); if (d) { dateStr = d.toISOString(); break; } }
        }
        if (!dateStr && docIds.length > 0) {
          const doc = documents.find((d) => docIds.includes(d.id));
          if (doc) { const d = parseDate(doc.created_date); if (d) dateStr = d.toISOString(); }
        }
      } catch (_) {}
      await base44.entities.Connection.create({
        source_entity_id: linkEntityId,
        target_entity_id: linkLocId,
        source_entity_name: ent?.name || '',
        target_entity_name: loc?.name || '',
        relationship_type: 'موجود في',
        evidence: dateStr || '',
        strength: 1
      });
      toast({
        title: 'تم ربط الكيان بالموقع',
        description: dateStr
          ? `${ent?.name} → ${loc?.name} • تاريخ الذكر: ${fmt(new Date(dateStr))}`
          : `${ent?.name} → ${loc?.name} (لم يُعثر على تاريخ ذكر — لن يظهر على الخط الزمني)`
      });
      setLinkEntityId('');
      setLinkLocId('');
      onLocationsChanged && await onLocationsChanged();
    } catch (e) {
      toast({ variant: 'destructive', title: 'فشل الربط', description: e.message });
    } finally { setLinking(false); }
  };

  const clearMap = () => {
    setMovementPerson(''); setDateFrom(''); setDateTo('');
    setFocusEntity(''); setTrackEntity('all');
    setIdx(0); setPlaying(false);
  };

  const handleMapClick = async (latlng) => {
    if (!drawMode) return;
    const { lat, lng } = latlng;
    if (selectedLocId === 'new') {
      if (!newLocName.trim()) { toast({ variant: 'destructive', title: 'أدخل اسم الموقع أولاً' }); return; }
      setPlacing(true);
      try {
        await base44.entities.Entity.create({ name: newLocName.trim(), type: 'location', latitude: lat, longitude: lng });
        toast({ title: 'تم إنشاء الموقع وتحديد إحداثياته' });
        setNewLocName('');
        onLocationsChanged && await onLocationsChanged();
      } catch (e) { toast({ variant: 'destructive', title: 'فشل إنشاء الموقع' }); }
      finally { setPlacing(false); }
      return;
    }
    if (!selectedLocId) { toast({ variant: 'destructive', title: 'اختر موقعاً من القائمة أولاً' }); return; }
    setPlacing(true);
    try {
      await base44.entities.Entity.update(selectedLocId, { latitude: lat, longitude: lng });
      toast({ title: 'تم تحديث إحداثيات الموقع' });
      onLocationsChanged && await onLocationsChanged();
    } catch (e) { toast({ variant: 'destructive', title: 'فشل تحديث الإحداثيات' }); }
    finally { setPlacing(false); }
  };

  const revealedTracks = tracks
    .map((t) => ({ ...t, revealed: t.points.filter((p) => p.date <= currentTime) }))
    .filter((t) => (trackEntity === 'all' || t.name === trackEntity) && t.revealed.length >= 2);

  const btn = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors';
  const sel = 'rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[200px]';

  return (
    <div className="space-y-3">
      {/* شريط الأدوات: الزمن + الرسم */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button disabled={displayIncidents.length === 0} onClick={() => { setIdx(0); setPlaying(false); }} className={btn} title="من البداية">
            <SkipBack className="w-4 h-4" />
          </button>
          <button disabled={displayIncidents.length === 0} onClick={() => setPlaying((p) => !p)} className={btn + ' bg-primary text-primary-foreground hover:bg-primary/90 border-primary'} title="تشغيل/إيقاف">
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-[200px]" dir="ltr">
            <input
              type="range"
              min={0}
              max={Math.max(displayIncidents.length - 1, 0)}
              value={safeIdx}
              onChange={(e) => { setIdx(Number(e.target.value)); setPlaying(false); }}
              className="w-full accent-primary"
            />
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4 h-4" />
            {currentTime ? fmt(currentTime) : '—'}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{visibleIncidents.length}/{displayIncidents.length} حدث</span>
        </div>

        {/* صف الرسم ومسارات الحركة */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
          <button
            onClick={() => setMapStyle((s) => (s === 'satellite' ? 'street' : 'satellite'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-card hover:bg-accent transition-colors"
            title="تبديل نوع الخريطة"
          >
            {mapStyle === 'satellite' ? <Satellite className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
            {mapStyle === 'satellite' ? 'قمر صناعي' : 'خرائط'}
          </button>
          <button
            onClick={() => setDrawMode((d) => !d)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              drawMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent border-border'
            }`}
            title="رسم المواقع بالنقر على الخريطة"
          >
            <Pencil className="w-4 h-4" /> رسم المواقع
          </button>

          {drawMode && (
            <>
              <select className={sel} value={selectedLocId} onChange={(e) => setSelectedLocId(e.target.value)}>
                <option value="">— اختر موقعاً —</option>
                {locEntities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.latitude != null ? '✓' : '(بدون إحداثيات)'}
                  </option>
                ))}
                <option value="new">+ موقع جديد...</option>
              </select>
              {selectedLocId === 'new' && (
                <input
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[180px]"
                  placeholder="اسم الموقع الجديد"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                />
              )}
              <span className="text-xs text-primary flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {placing ? 'جارٍ الحفظ...' : 'انقر على الخريطة لتحديد الإحداثيات'}
              </span>
            </>
          )}

          <div className="flex items-center gap-1.5 ms-auto">
            <Route className="w-4 h-4 text-muted-foreground" />
            <select className={sel} value={trackEntity} onChange={(e) => setTrackEntity(e.target.value)}>
              <option value="all">كل مسارات الحركة</option>
              {tracks.map((t) => (
                <option key={t.name} value={t.name}>{t.name} ({t.points.length})</option>
              ))}
            </select>
          </div>
        </div>

        {/* صف ربط الكيانات بالمواقع */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">ربط كيان بموقع (التاريخ تلقائي من التقارير):</span>
          <select className={sel} value={linkEntityId} onChange={(e) => setLinkEntityId(e.target.value)}>
            <option value="">— اختر كياناً —</option>
            {linkableEntities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <span className="text-muted-foreground text-sm">→</span>
          <select className={sel} value={linkLocId} onChange={(e) => setLinkLocId(e.target.value)}>
            <option value="">— اختر موقعاً —</option>
            {geoLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button
            onClick={createLink}
            disabled={linking || !linkEntityId || !linkLocId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            title="يُشتق تاريخ الذكر تلقائياً من التقارير"
          >
            <Plus className="w-4 h-4" /> {linking ? 'جارٍ الربط...' : 'ربط'}
          </button>
        </div>

        {/* إبراز مواقع كيان */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">إبراز مواقع كيان:</span>
          <select className={sel} value={focusEntity} onChange={(e) => setFocusEntity(e.target.value)}>
            <option value="">— كل المواقع —</option>
            {linkableEntities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          {focusEntity && (
            <button onClick={() => setFocusEntity('')} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> مسح
            </button>
          )}
        </div>

        {/* تتبع حركة شخص ضمن نطاق زمني */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
          <Route className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">عرض الحركات ضمن نطاق زمني:</span>
          <select className={sel} value={movementPerson} onChange={(e) => setMovementPerson(e.target.value)}>
            <option value="">كل الكيانات</option>
            {linkableEntities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">من</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <span className="text-xs text-muted-foreground">إلى</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={clearMap} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card hover:bg-accent">
            <X className="w-3.5 h-3.5" /> مسح الخريطة
          </button>
        </div>
      </div>

      {/* الخريطة */}
      <div className={`rounded-xl border border-border overflow-hidden ${drawMode ? 'ring-2 ring-primary/40' : ''}`}>
        {hasGeo ? (
          <MapContainer
            center={center}
            zoom={5}
            style={{ height: 560, width: '100%', cursor: drawMode ? 'crosshair' : '' }}
            scrollWheelZoom
          >
            <TileLayer
              url={mapStyle === 'satellite'
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'}
              attribution={mapStyle === 'satellite' ? 'Tiles © Esri' : '© OpenStreetMap, © CARTO'}
            />
            <ClickHandler active={drawMode} onClick={handleMapClick} />

            {/* المواقع الثابتة */}
            {locations.map((l) => {
              const linked = !linkedLocIds || linkedLocIds.has(l.id);
              return (
                <CircleMarker key={'loc' + l.id} center={[l.latitude, l.longitude]} radius={linked ? 7 : 4} pathOptions={{ color: linked ? '#dc2626' : '#94a3b8', fillColor: linked ? '#dc2626' : '#94a3b8', fillOpacity: linked ? 0.7 : 0.2 }}>
                  <Popup>
                    <div className="text-xs space-y-1 min-w-[170px]">
                      <div className="font-semibold text-sm">{l.name}</div>
                      <div className="text-muted-foreground">{l.latitude?.toFixed(4)}، {l.longitude?.toFixed(4)}</div>
                      {(linkedByLoc[l.id] || []).length > 0 && (
                        <div className="pt-1.5 border-t border-border">
                          <div className="text-muted-foreground text-[11px] mb-1">الكيانات المرتبطة ({linkedByLoc[l.id].length}):</div>
                          <div className="flex flex-wrap gap-1">
                            {linkedByLoc[l.id].map((n, i) => (
                              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-accent">{n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* مسارات الحركة المتكشفة */}
            {revealedTracks.map((t) => (
              <Polyline
                key={t.name}
                positions={t.revealed.map((p) => [p.lat, p.lng])}
                pathOptions={{ color: t.color, weight: 3, opacity: 0.85, dashArray: '6 6' }}
              >
                <Tooltip sticky>{t.name} — {t.revealed.length} محطة</Tooltip>
              </Polyline>
            ))}

            {/* الحوادث حتى اللحظة الحالية */}
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
                    <div className="text-xs space-y-1 min-w-[190px]">
                      <div className="font-semibold text-sm">{ev.sourceName || ev.label}</div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3 h-3" /> {fmt(ev.date)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-primary" /> {ev.locName}
                      </div>
                      {ev.rel && <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ev.rel}</span>}
                      {ev.targetName && ev.targetName !== ev.locName && <div className="text-muted-foreground">المرتبط: {ev.targetName}</div>}
                      {ev.docTitle && <div className="text-muted-foreground text-[11px]">المستند: {ev.docTitle}</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="h-[560px] flex items-center justify-center text-sm text-muted-foreground text-center px-6">
            لا توجد مواقع مُرمّزة جغرافياً بعد. فعّل «رسم المواقع» وانقر على الخريطة لتحديد إحداثيات كيانات المواقع، أو استخدم زر «ترميز المواقع» أعلى الصفحة.
          </div>
        )}
      </div>

      {/* مفتاح مسارات الحركة */}
      {tracks.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground shrink-0">مسارات الحركة:</span>
            {tracks.map((t) => (
              <button
                key={t.name}
                onClick={() => setTrackEntity(trackEntity === t.name ? 'all' : t.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  trackEntity === t.name ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                {t.name}
                <span className="text-muted-foreground">({t.points.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {unlocatedCount > 0 && (
        <div className="text-xs text-amber-600 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          {unlocatedCount} موقع بدون إحداثيات — فعّل «رسم المواقع» لتحديدها بالنقر على الخريطة.
        </div>
      )}
    </div>
  );
}