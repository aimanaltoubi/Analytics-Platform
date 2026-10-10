// إشعارات محلية محفوظة داخل التطبيق؛ لا يتم إرسال بريد إلكتروني.

export async function notifyWatchlistMatches(localClient, manifest, flags, cargoFlags) {
  if (!flags.length && !cargoFlags.length) return { created: 0, email_sent: 0 };

  // قراءة وجهة الإشعار المُعدّة في صفحة الإعدادات؛ إن لم تُضف فنعود للمسؤولين
  let recipients = [];
  const rows = await localClient.asServiceRole.entities.Setting.filter({ key: 'notification_emails' });
  const row = (rows || [])[0];
  const configured = (row && row.value || '').split(',').map((e) => e.trim()).filter(Boolean);
  if (configured.length) recipients = configured.map((email) => ({ email }));

  if (!recipients.length) {
    const users = await localClient.asServiceRole.entities.User.list('-created_date', 50);
    recipients = (users || []).filter((u) => u.email && u.role === 'admin');
  }
  if (!recipients.length) recipients = [{ email: (await localClient.auth.me()).email }];

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

  const notifications = await localClient.asServiceRole.entities.Notification.bulkCreate(
    recipients.map((recipient) => ({
      title: subject,
      message: body,
      type: 'watchlist_match',
      severity: 'critical',
      read: false,
      manifest_id: manifest.id,
      recipient_email: recipient.email
    }))
  );
  return { created: notifications.length, email_sent: 0 };
}