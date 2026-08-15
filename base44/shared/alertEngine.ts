// محرك التنبيهات الفوري — يطابق الكيانات المستخرجة من المستندات
// مقابل قوائم المراقبة وملفات الخطر المحددة، ويُنشئ تنبيهات فوراً.
// يستخدمه processDocument (فور الاستخراج) و runCepAlerts (الجرد المجدول).

const DEFAULT_PROFILES = [
  { name: 'كيان عالي الخطورة', description: 'درجة خطورة الكيان تتجاوز العتبة', rule_type: 'risk_threshold', conditions: { min_risk_score: 70 }, severity: 'high', enabled: true },
  { name: 'كيان في قائمة المراقبة', description: 'كيان مُدرج في قائمة المراقبة', rule_type: 'watchlist', conditions: {}, severity: 'critical', enabled: true },
  { name: 'كيان محوري', description: 'كيان مرتبط بعدد كبير من الكيانات', rule_type: 'hub', conditions: { min_degree: 10 }, severity: 'medium', enabled: true },
  { name: 'تشارك مكثّف', description: 'كيانان يظهران معاً في عدة مستندات', rule_type: 'co_occurrence', conditions: { min_shared_docs: 2, require_high_risk: false }, severity: 'medium', enabled: true },
  { name: 'عنقود شبكي كبير', description: 'شبكة مترابطة بحجم كبير', rule_type: 'cluster_size', conditions: { min_size: 8 }, severity: 'high', enabled: true }
];

// يضمن وجود ملفات خطر افتراضية ويعيد الملفات المفعّلة
export async function ensureDefaultProfiles(base44) {
  let profiles = await base44.asServiceRole.entities.RiskProfile.filter({ enabled: true }, '-created_date', 100);
  if (!profiles || profiles.length === 0) {
    await base44.asServiceRole.entities.RiskProfile.bulkCreate(DEFAULT_PROFILES);
    profiles = await base44.asServiceRole.entities.RiskProfile.filter({ enabled: true }, '-created_date', 100);
  }
  return profiles;
}

// يُقيّم الكيانات المعطاة مقابل قواعد قائمة المراقبة وعتبة الخطورة (المطابقة الفورية
// للبيانات المستخرجة من المستندات) ويُنشئ تنبيهات فورية مع منع التكرار عبر توقيع فريد.
// context: { document_id, document_title } لربط التنبيه بالمستند المُعالَج.
export async function evaluateImmediateAlerts(base44, entities, context = {}) {
  const profiles = await ensureDefaultProfiles(base44);
  const entById = {};
  entities.forEach((e) => { entById[e.id] = e; });

  const existing = await base44.asServiceRole.entities.Alert.filter({ status: { $ne: 'resolved' } }, '-created_date', 500);
  const existingKeys = new Set((existing || []).map((a) =>
    (a.rule_id || a.rule_name || '') + '|' + (a.details && a.details.signature ? a.details.signature : '')
  ));

  const now = new Date().toISOString();
  const toCreate = [];
  const addAlert = (profile, signature, title, description, entityIds, extra) => {
    const key = (profile.id || profile.name) + '|' + signature;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    const ents = (entityIds || []).map((id) => entById[id]).filter(Boolean);
    toCreate.push({
      title,
      description,
      severity: profile.severity || 'medium',
      rule_id: profile.id || '',
      rule_name: profile.name,
      rule_type: profile.rule_type,
      entity_ids: entityIds || [],
      entity_names: ents.map((e) => e.name),
      status: 'new',
      triggered_at: now,
      details: Object.assign(
        { signature, source: 'document', document_id: context.document_id || '', document_title: context.document_title || '' },
        extra || {}
      )
    });
  };

  const docSuffix = context.document_title ? ' — المستند: ' + context.document_title : '';
  profiles.forEach((p) => {
    const cond = p.conditions || {};
    if (p.rule_type === 'risk_threshold') {
      const min = cond.min_risk_score || 0;
      entities.forEach((e) => {
        if ((e.risk_score || 0) >= min) {
          addAlert(p, 'risk:' + e.id, 'خطورة عالية: ' + e.name, 'درجة الخطورة ' + (e.risk_score || 0) + ' تتجاوز العتبة ' + min + docSuffix, [e.id], { risk_score: e.risk_score || 0 });
        }
      });
    } else if (p.rule_type === 'watchlist') {
      entities.forEach((e) => {
        if (e.watchlist) addAlert(p, 'watch:' + e.id, 'مطابقة قائمة مراقبة: ' + e.name, 'الكيان مُدرج في قائمة المراقبة' + docSuffix, [e.id]);
      });
    }
  });

  let created = 0;
  if (toCreate.length > 0) {
    const res = await base44.asServiceRole.entities.Alert.bulkCreate(toCreate);
    created = Array.isArray(res) ? res.length : toCreate.length;
  }
  return { alerts_created: created, alerts: toCreate };
}