// نظام الإشعارات الفورية — يُرسل بريداً للمسؤولين عند مطابقة
// المسافرين أو الشحنات مع قوائم المراقبة المسجّلة في النظام.

export async function notifyWatchlistMatches(base44, manifest, flags, cargoFlags) {
  if (!flags.length && !cargoFlags.length) return { sent: 0 };

  // جلب المستخدمين المسؤولين لإرسال الإشعار لهم
  let admins = [];
  try {
    const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
    admins = (users || []).filter((u) => u.email && (u.role === 'admin' || !u.role));
  } catch (e) {
    return { sent: 0, error: e.message };
  }
  if (!admins.length) return { sent: 0 };

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
  for (const a of admins) {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({ to: a.email, subject, body });
      sent++;
    } catch (e) {
      // متابعة لبقية المسؤولين
    }
  }
  return { sent };
}