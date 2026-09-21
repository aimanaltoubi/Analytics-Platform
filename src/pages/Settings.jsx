import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mail, Plus, Trash2, Save, CheckCircle2, Bell, Server, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const EMAILS_KEY = 'notification_emails';
const SMTP_KEY = 'smtp_config';

const defaultSmtp = { host: '', port: '587', encryption: 'starttls', username: '', password: '', from_address: '', from_name: 'محلّل الكيانات' };

export default function Settings() {
  const { toast } = useToast();
  const [emails, setEmails] = useState([]);
  const [input, setInput] = useState('');
  const [emailsId, setEmailsId] = useState(null);
  const [smtp, setSmtp] = useState(defaultSmtp);
  const [smtpId, setSmtpId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingEmails, setSavingEmails] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const rows = await base44.entities.Setting.filter({});
      for (const r of rows || []) {
        if (r.key === EMAILS_KEY) {
          setEmailsId(r.id);
          setEmails((r.value || '').split(',').map((e) => e.trim()).filter(Boolean));
        } else if (r.key === SMTP_KEY) {
          setSmtpId(r.id);
          try { setSmtp({ ...defaultSmtp, ...JSON.parse(r.value || '{}') }); } catch (e) {}
        }
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
    if (emails.includes(v)) { toast({ title: 'البريد مُضاف مسبقاً', variant: 'destructive' }); return; }
    setEmails([...emails, v]);
    setInput('');
  };

  const removeEmail = (e) => setEmails(emails.filter((x) => x !== e));

  const saveEmails = async () => {
    setSavingEmails(true);
    try {
      const value = emails.join(',');
      if (emailsId) await base44.entities.Setting.update(emailsId, { value });
      else { const c = await base44.entities.Setting.create({ key: EMAILS_KEY, value }); setEmailsId(c.id); }
      toast({ title: 'تم حفظ وجهة الإشعار', description: emails.length ? `${emails.length} بريد مستلم` : 'لا يوجد بريد — يُعاد للمسؤولين' });
    } catch (e) { toast({ title: 'تعذّر الحفظ', description: e.message, variant: 'destructive' }); } finally { setSavingEmails(false); }
  };

  const saveSmtp = async () => {
    setSavingSmtp(true);
    try {
      const value = JSON.stringify(smtp);
      if (smtpId) await base44.entities.Setting.update(smtpId, { value });
      else { const c = await base44.entities.Setting.create({ key: SMTP_KEY, value }); setSmtpId(c.id); }
      toast({ title: 'تم حفظ إعدادات خادم البريد' });
    } catch (e) { toast({ title: 'تعذّر الحفظ', description: e.message, variant: 'destructive' }); } finally { setSavingSmtp(false); }
  };

  const setField = (k, v) => setSmtp((s) => ({ ...s, [k]: v }));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold">الإعدادات</h1>
          <p className="text-sm text-muted-foreground">تكوين وجهة الإشعارات وخادم البريد للبيئة المعزولة.</p>
        </div>
      </div>

      {/* وجهة الإشعار */}
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
          <button onClick={addEmail} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
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
          <button onClick={saveEmails} disabled={savingEmails} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Save className="w-4 h-4" /> {savingEmails ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>

      {/* خادم البريد (SMTP) — للبيئة المعزولة */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold">خادم البريد (SMTP)</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          في البيئة المعزولة عن الشبكة لا يتوفر خدمة البريد السحابية، لذا يُرسل النظام الإشعارات عبر خادم SMTP محلي (مرحّلة بريد داخلية).
          اضبط بيانات الخادم هنا لتستخدمها مرحلة الإرسال دون اتصال بالإنترنت.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="عنوان الخادم (Host)">
            <input value={smtp.host} onChange={(e) => setField('host', e.target.value)} placeholder="smtp.local" className={inputCls} />
          </Field>
          <Field label="المنفذ (Port)">
            <input value={smtp.port} onChange={(e) => setField('port', e.target.value)} placeholder="587 / 465 / 25" className={inputCls} />
          </Field>
          <Field label="نوع التشفير">
            <select value={smtp.encryption} onChange={(e) => setField('encryption', e.target.value)} className={inputCls}>
              <option value="none">بدون</option>
              <option value="starttls">STARTTLS</option>
              <option value="ssl">SSL/TLS</option>
            </select>
          </Field>
          <Field label="اسم المُرسِل (From Name)">
            <input value={smtp.from_name} onChange={(e) => setField('from_name', e.target.value)} placeholder="محلّل الكيانات" className={inputCls} />
          </Field>
          <Field label="بريد المُرسِل (From Address)">
            <input value={smtp.from_address} onChange={(e) => setField('from_address', e.target.value)} placeholder="alerts@local" className={inputCls} />
          </Field>
          <Field label="اسم المستخدم">
            <input value={smtp.username} onChange={(e) => setField('username', e.target.value)} placeholder="username" className={inputCls} />
          </Field>
          <Field label="كلمة المرور" full>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" value={smtp.password} onChange={(e) => setField('password', e.target.value)} placeholder="••••••••" className={inputCls + ' pr-9'} />
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {smtp.host ? `جاهز للإرسال عبر ${smtp.host}:${smtp.port}` : 'لم يُضبط خادم البريد بعد'}
          </div>
          <button onClick={saveSmtp} disabled={savingSmtp} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Save className="w-4 h-4" /> {savingSmtp ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}