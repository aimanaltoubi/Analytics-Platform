import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Database, Download, Upload, ShieldCheck, Cpu, UserPlus } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const refresh = async () => {
    try {
      setStatus(await localClient.status());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { refresh(); }, []);

  const perform = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast({ title: 'تعذّر إكمال العملية', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = () => perform(async () => {
    const data = await localClient.backup.export();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `strategic-data-fusion-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: 'تم تصدير النسخة الاحتياطية' });
  });

  const restore = () => perform(async () => {
    if (!backup || !confirmed) throw new Error('Select a backup and confirm replacement first.');
    await localClient.backup.import(JSON.parse(await backup.text()));
    setBackup(null);
    setConfirmed(false);
    toast({ title: 'تم استيراد النسخة الاحتياطية' });
    await refresh();
  });

  const changePassword = (event) => {
    event.preventDefault();
    perform(async () => {
      await localClient.auth.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast({ title: 'تم تغيير كلمة المرور', description: 'سجّل الدخول مجدداً بكلمة المرور الجديدة.' });
      window.location.href = '/login';
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="font-heading text-xl font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> الإعدادات المحلية</h1>
      <p className="text-sm text-muted-foreground">تعمل قاعدة البيانات والملفات والتحليلات على هذا الكمبيوتر. الإشعارات داخل التطبيق فقط؛ لا توجد خدمة بريد أو تسجيل دخول سحابي.</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Cpu className="w-4 h-4" /> الذكاء الاصطناعي المحلي</h2>
        <p className="text-sm">{status ? (status.ai?.available ? 'النموذج المحلي جاهز.' : 'النموذج غير جاهز. ثبّت حزمة الذكاء الاصطناعي المحلية مع التطبيق ثم أعد تشغيله. عمليات قاعدة البيانات اليدوية لا تحتاج إلى النموذج.') : 'جارٍ فحص الحالة...'}</p>
        <button className="rounded border px-3 py-2 text-sm" onClick={refresh}>تحديث الحالة</button>
      </section>
      {user?.role === 'admin' && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Database className="w-4 h-4" /> النسخ الاحتياطي والاستعادة</h2>
          <p className="text-sm text-muted-foreground">تشمل النسخة السجلات والملفات المحلية، ولا تشمل كلمات المرور أو نموذج الذكاء الاصطناعي. احفظها في مكان آمن؛ النسخة تحتوي بيانات حساسة وليست مشفّرة.</p>
          <button disabled={busy} onClick={exportBackup} className="inline-flex gap-2 rounded bg-primary text-primary-foreground px-3 py-2 text-sm disabled:opacity-50"><Download className="w-4 h-4" /> تصدير نسخة احتياطية</button>
          <label className="block text-sm">اختر نسخة لاستيرادها
            <input type="file" accept=".json,application/json" disabled={busy} className="block mt-2" onChange={(e) => { setBackup(e.target.files?.[0] || null); setConfirmed(false); }} />
          </label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> أفهم أن الاستيراد سيستبدل السجلات والملفات الحالية. صدّرت نسخة منها أولاً.</label>
          <button disabled={busy || !backup || !confirmed} onClick={restore} className="inline-flex gap-2 rounded border px-3 py-2 text-sm disabled:opacity-50"><Upload className="w-4 h-4" /> استيراد النسخة</button>
          <Link to="/register" className="flex gap-2 text-sm text-primary hover:underline"><UserPlus className="w-4 h-4" /> إضافة حساب محلي</Link>
        </section>
      )}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> تغيير كلمة المرور</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <label className="block text-sm">كلمة المرور الحالية<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="block mt-1 w-full border rounded bg-background p-2" /></label>
          <label className="block text-sm">كلمة المرور الجديدة (12 حرفاً على الأقل)<input type="password" required minLength={12} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="block mt-1 w-full border rounded bg-background p-2" /></label>
          <button disabled={busy} className="rounded bg-primary text-primary-foreground px-3 py-2 text-sm disabled:opacity-50">حفظ</button>
        </form>
      </section>
    </div>
  );
}
