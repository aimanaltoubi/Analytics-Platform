// أدوات تصنيف الكيانات حسب النوع والسمات المكتشفة — تُستخدم للفرز والفلترة في صفحة الكيانات

function attrValue(e, keys) {
  const a = e.attributes || {};
  for (const k of keys) {
    if (a[k] && String(a[k]).trim()) return String(a[k]).trim();
  }
  return '';
}

export function getNationality(e) {
  return attrValue(e, ['الجنسية', 'جنسية', 'nationality', 'Nationality']);
}

export function hasPassport(e) {
  const a = e.attributes || {};
  return Object.keys(a).some((k) => /جواز|passport/i.test(k) && String(a[k]).trim());
}

export function hasPhone(e) {
  if (e.type === 'phone') return true;
  const a = e.attributes || {};
  return Object.keys(a).some((k) => /هاتف|phone|mobile|رقم/i.test(k) && String(a[k]).trim());
}

export function hasEmail(e) {
  if (e.type === 'email') return true;
  const a = e.attributes || {};
  return Object.keys(a).some((k) => /بريد|email|mail/i.test(k) && String(a[k]).trim());
}

export function hasCoordinates(e) {
  return e.latitude != null && e.longitude != null;
}

export function riskTier(e) {
  const r = e.risk_score || 0;
  if (r >= 70) return 'high';
  if (r >= 40) return 'medium';
  if (r > 0) return 'low';
  return 'none';
}