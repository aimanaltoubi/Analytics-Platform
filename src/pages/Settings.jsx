import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mail, Plus, Trash2, Save, CheckCircle2, Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const SETTING_KEY = 'notification_emails';

export default function Settings() {
  const { toast } = useToast();
  const [emails, setEmails] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const rows = await base44.entities.Setting.filter({ key: SETTING_KEY });
      const row = (rows || [])[0];
      if (row) {
        setRecordId(row.id);
        setEmails((row.value || '').split(',').map((e) => e.trim()).filter(Boolean));
      }
    } catch (e) {} finally { setLoading(false); }
  };

  const addEmail = () => {
    const v = input.trim();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast({ title: 'صيغة بريد غير صحيحة', variant: 'destructive' });
      return;
    }
    if (emails.includes(v)) {
      toast({ title: 'البريد مُضاف مسبقاً', variant: 'destructive' });
      return;
    }
    setEmails([...emails, v]);
    setInput('');
  };

  const removeEmail = (e) => setEmails(emails.filter((x) => x !== e));

  const save = async () => {
    setSaving(true);
    try {
      const value = emails.join(',');
      if (recordId) {
        await base44.entities.Setting.update(recordId, { value });
      } else {
        const created = await base44.entities.Setting.create({ key: SETTING_KEY, value });
        setRecordId(created.id);
      }
      toast({ title: 'تم حفظ إعدادات الإشعار', description: emails.length ? `${emails.length} بريد مستلم` : 'لا يوجد بريد — سيُعاد للمسؤولين' });
    } catch (e) {
      toast({ title: 'تعذّر الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold">الإعدادات</h1>
          <p className="text-sm text-muted-foreground">تكوين وجهة إشعارات البريد الإلكتروني للنظام.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold">وجهة إشعارات البريد</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          تُرسل تنبيهات مطابقة قوائم المراقبة والبيانات المُعلَّمة تلقائياً إلى البريد المُعدّ هنا.
          إن لم تُضف أي بريد، يُعاد النظام لإرسالها إلى حسابات المسؤولين.
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={addEmail}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل...</div>
        ) : emails.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-accent/30 p-4 text-center text-sm text-muted-foreground">
            لا يوجد بريد مُعدّ — ستُرسل الإشعارات إلى المسؤولين.
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((e) => (
              <div key={e} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{e}</span>
                <button onClick={() => removeEmail(e)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            {emails.length > 0 && <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{emails.length} بريد مُعدّ للاستلام</span>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}