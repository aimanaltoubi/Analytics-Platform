import { createClientFromRequest } from '../../client.js';
import { norm, nameSimilarity } from '../../shared/entityResolution.js';
import { notifyWatchlistMatches } from '../../shared/notify.js';

const STRONG_KEYS = ['رقم الجواز', 'الرقم الوطني / رقم الهوية', 'رقم الهاتف', 'البريد الإلكتروني', 'رقم الحساب'];

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);
    const body = await req.json();
    const manifestId = body.manifest_id;
    if (!manifestId) return Response.json({ error: 'manifest_id required' }, { status: 400 });

    const manifest = await localClient.asServiceRole.entities.Manifest.get(manifestId);
    if (!manifest) return Response.json({ error: 'manifest not found' }, { status: 404 });

    await localClient.asServiceRole.entities.Manifest.update(manifest.id, { status: 'screening' });

    const entities = await localClient.asServiceRole.entities.Entity.list('-mention_count', 2000);
    const watchlist = entities.filter((e) => e.watchlist);

    // فهرسة المعرّفات القوية (جواز/هوية/هاتف...) للكيانات
    const idIndex = Object.create(null);
    entities.forEach((e) => {
      const attrs = e.attributes || {};
      STRONG_KEYS.forEach((k) => {
        const v = norm(attrs[k]);
        if (v) (idIndex[k] = idIndex[k] || {})[v] = e;
      });
    });

    const flags = [];
    const passengers = manifest.passengers || [];
    passengers.forEach((p, i) => {
      const reasons = [];
      // (1) جواز مسروق/مزيّف: الرقم مُسجّل باسم كيان آخر
      const pp = norm(p.passport_number);
      if (pp) {
        for (const k of Object.keys(idIndex)) {
          const owner = idIndex[k][pp];
          if (!owner) continue;
          if (owner.name && norm(owner.name) !== norm(p.name) &&
              !(owner.aliases || []).some((a) => norm(a) === norm(p.name))) {
            reasons.push('جواز سفر مسروق/مزيّف: الرقم مُسجّل باسم "' + owner.name + '"');
          }
          if (owner.watchlist) {
            reasons.push('الرقم مرتبط بكيان في قائمة المراقبة: ' + owner.name);
          }
        }
      }
      // (2) مطابقة اسمية/صوتية مع قائمة المراقبة (تشمل الأسماء المستعارة المترجمة صوتياً)
      watchlist.forEach((w) => {
        const score = nameSimilarity(p.name, w.name);
        const aliasScore = (w.aliases || []).reduce((m, a) => Math.max(m, nameSimilarity(p.name, a)), 0);
        const best = Math.max(score, aliasScore);
        if (best >= 0.92) {
          reasons.push('تطابق صوتي/اسمي مع كيان مراقَب: ' + w.name + (best < 1 ? ' (' + Math.round(best * 100) + '%)' : ''));
        }
      });
      if (reasons.length > 0) flags.push({ index: i, name: p.name, passport_number: p.passport_number, nationality: p.nationality, seat: p.seat, reasons });
    });

    // فحص الشحن: المرسِل إليه مقابل قائمة المراقبة
    const cargoFlags = [];
    (manifest.cargo || []).forEach((c, i) => {
      if (!c.consignee) return;
      let best = null;
      watchlist.forEach((w) => {
        const s = nameSimilarity(c.consignee, w.name);
        if (s >= 0.92 && (!best || s > best.score)) best = { name: w.name, score: s };
      });
      if (best) cargoFlags.push({ index: i, consignee: c.consignee, description: c.description, reason: 'المرسِل إليه مرتبط بكيان مراقَب: ' + best.name });
    });

    // إنشاء تنبيهات منع الطيران (مع منع التكرار)
    const existing = await localClient.asServiceRole.entities.Alert.filter({ status: { $ne: 'resolved' } }, '-created_date', 500);
    const existingKeys = new Set((existing || []).map((a) => (a.details && a.details.signature) || ''));
    const now = new Date().toISOString();
    const route = (manifest.departure_location || '') + ' → ' + (manifest.destination_location || '');
    const toCreate = [];

    flags.forEach((pf) => {
      const sig = 'nofly:' + manifest.id + ':' + pf.index + ':' + norm(pf.name);
      if (existingKeys.has(sig)) return;
      existingKeys.add(sig);
      toCreate.push({
        title: 'تنبيه منع طيران: ' + pf.name,
        description: pf.reasons.join('؛ '),
        severity: 'critical',
        rule_id: 'transit_screening',
        rule_name: 'فحص بيان الركاب',
        rule_type: 'no_fly',
        entity_ids: [],
        entity_names: [pf.name],
        status: 'new',
        triggered_at: now,
        details: { signature: sig, manifest_id: manifest.id, voyage: manifest.voyage_number, carrier: manifest.carrier, route, passport: pf.passport_number, seat: pf.seat, reasons: pf.reasons }
      });
    });
    cargoFlags.forEach((cf) => {
      const sig = 'cargo:' + manifest.id + ':' + cf.index;
      if (existingKeys.has(sig)) return;
      existingKeys.add(sig);
      toCreate.push({
        title: 'تنبيه شحنة مراقَبة: ' + cf.consignee,
        description: cf.reason,
        severity: 'high',
        rule_id: 'transit_screening',
        rule_name: 'فحص بيان الشحن',
        rule_type: 'cargo_flag',
        status: 'new',
        triggered_at: now,
        details: { signature: sig, manifest_id: manifest.id, voyage: manifest.voyage_number, carrier: manifest.carrier, route }
      });
    });

    if (toCreate.length > 0) await localClient.asServiceRole.entities.Alert.bulkCreate(toCreate);

    // إشعار فوري للمسؤولين عند مطابقة قائمة المراقبة
    let notified = { created: 0, email_sent: 0 };
    if (toCreate.length > 0) {
      notified = await notifyWatchlistMatches(localClient, manifest, flags, cargoFlags);
    }

    const status = (flags.length > 0 || cargoFlags.length > 0) ? 'flagged' : 'cleared';
    await localClient.asServiceRole.entities.Manifest.update(manifest.id, {
      status,
      screening_summary: {
        screened_at: now,
        passengers_screened: passengers.length,
        passengers_flagged: flags.length,
        cargo_flagged: cargoFlags.length,
        flags,
        cargo_flags: cargoFlags
      }
    });

    return Response.json({
      manifest_id: manifest.id,
      status,
      passengers_screened: passengers.length,
      passengers_flagged: flags.length,
      cargo_flagged: cargoFlags.length,
      alerts_created: toCreate.length,
      notifications_created: notified.created,
      notifications_sent: 0,
      email_sent: 0
    });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}