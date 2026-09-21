// نظام الإشعارات الفورية — يُرسل بريداً للمسؤولين عند مطابقة
// المسافرين أو الشحنات مع قوائم المراقبة المسجّلة في النظام.

export async function notifyWatchlistMatches(base44, manifest, flags, cargoFlags) {
  if (!flags.length && !cargoFlags.length) return { sent: 0 };

  // قراءة وجهة الإشعار المُعدّة في صفحة الإعدادات؛ إن لم تُضف فنعود للمسؤولين
  let recipients = [];
  try {
    const rows = await base44.asServiceRole.entities.Setting.filter({ key: 'notification_emails' });
    const row = (rows || [])[0];
    const configured = (row && row.value || '').split(',').map((e) => e.trim()).filter(Boolean);
    if (configured.length) recipients = configured.map((email) => ({ email }));
  } catch (e) {
    // تعذّر قراءة الإعداد — نعود للمسؤولين
  }

  if (!recipients.length) {
    try {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
      recipients = (users || []).filter((u) => u.email && (u.role === 'admin' || !u.role));
    } catch (e) {
      return { sent: 0, error: e.message };
    }
  }
  if (!recipients.length) return { sent: 0 };

  const route = (manifest.departure_location || '—') + ' → ' + (manifest.destination_location || '—');
  const subject = '🚨 تنبيه مطابقة قائمة مراقبة — ' + manifest.carrier + ' ' + (manifest.voyage_number || '');

  const lines = [];
  lines.push('تنبيه أمني فوري: تم رصد مطابقة مع قائمة المراقبة في بيان معبر حدودي.');
  lines.push('الناقل: ' + manifest.carrier + ' | الرحلة: ' + (manifest.voyage_number || '—') + ' | المسار: ' + route);
  lines.push('');

  if (flags.length) {
    lines.push('الركاب المُعلَّمون (' + flags.length + '):');
    flags.forEach((f) => {
      lines.push('- ' + f.name + (f.passport_number ? ' | جواز: ' + f.passport_number : '') + (f.nationality ? ' | ' + f.nationality : '') + (f.seat ? ' | مقعد: ' + f.seat : ''));
      (f.reasons || []).forEach((r) => lines.push('    • ' + r));
    });
  }

  if (cargoFlags.length) {
    if (flags.length) lines.push('');
    lines.push('الشحنات المُعلَّمة (' + cargoFlags.length + '):');
    cargoFlags.forEach((c) => {
      lines.push('- ' + (c.consignee || '—') + ' | ' + (c.description || ''));
      if (c.reason) lines.push('    • ' + c.reason);
    });
  }

  lines.push('');
  lines.push('الحالة: مُعلَّم — يلزم اعتراض ومراجعة فورية.');
  const body = lines.join('\n');

  let sent = 0;
  for (const a of recipients) {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: a.email, subject, body });
      sent++;
    } catch (e) {
      // متابعة لبقية المستلمين
    }
  }
  return { sent };
}