import { useState } from 'react';
import { Plus, Trash2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const emptyPassenger = { name: '', passport_number: '', nationality: '', dob: '', seat: '' };
const emptyCargo = { description: '', weight: '', consignee: '', hazardous: false };

export default function ManifestForm({ onSubmitted }) {
  const [type, setType] = useState('passenger');
  const [mode, setMode] = useState('air');
  const [carrier, setCarrier] = useState('');
  const [voyage, setVoyage] = useState('');
  const [dep, setDep] = useState('');
  const [dest, setDest] = useState('');
  const [datetime, setDatetime] = useState('');
  const [passengers, setPassengers] = useState([{ ...emptyPassenger }]);
  const [cargo, setCargo] = useState([{ ...emptyCargo }]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const input = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const label = 'text-xs font-medium text-muted-foreground mb-1 block';

  const setP = (i, k, v) => setPassengers(passengers.map((p, j) => j === i ? { ...p, [k]: v } : p));
  const setC = (i, k, v) => setCargo(cargo.map((c, j) => j === i ? { ...c, [k]: v } : c));

  const submit = async () => {
    if (!carrier.trim() || !voyage.trim()) { toast({ variant: 'destructive', title: 'الناقل ورقم الرحلة مطلوبان' }); return; }
    setSubmitting(true);
    try {
      const payload = {
        manifest_type: type, mode, carrier: carrier.trim(), voyage_number: voyage.trim(),
        departure_location: dep.trim(), destination_location: dest.trim(),
        departure_datetime: datetime || undefined, status: 'submitted',
        passengers: type === 'passenger' ? passengers.filter((p) => p.name.trim()) : [],
        cargo: type === 'cargo' ? cargo.filter((c) => c.description.trim() || c.consignee.trim()) : []
      };
      const created = await base44.entities.Manifest.create(payload);
      // فحص فوري (إضافةً إلى الـ workflow الذي يعمل عند الإنشاء)
      try { await base44.functions.invoke('screenManifest', { manifest_id: created.id }); } catch (e) {}
      toast({ title: 'تم تقديم البيان وفحصه' });
      setCarrier(''); setVoyage(''); setDep(''); setDest(''); setDatetime('');
      setPassengers([{ ...emptyPassenger }]); setCargo([{ ...emptyCargo }]);
      onSubmitted && onSubmitted();
    } catch (e) {
      toast({ variant: 'destructive', title: 'فشل التقديم' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-heading font-semibold">تقديم بيان ركاب/شحن</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={label}>نوع البيان</label>
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="passenger">ركاب</option>
            <option value="cargo">شحن</option>
          </select>
        </div>
        <div>
          <label className={label}>وسيلة النقل</label>
          <select className={input} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="air">جوي</option>
            <option value="sea">بحري</option>
          </select>
        </div>
        <div>
          <label className={label}>الناقل</label>
          <input className={input} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="مثال: الخطوط الجوية" />
        </div>
        <div>
          <label className={label}>رقم الرحلة</label>
          <input className={input} value={voyage} onChange={(e) => setVoyage(e.target.value)} placeholder="مثال: XY123" />
        </div>
        <div>
          <label className={label}>مكان المغادرة</label>
          <input className={input} value={dep} onChange={(e) => setDep(e.target.value)} />
        </div>
        <div>
          <label className={label}>مكان الوصول</label>
          <input className={input} value={dest} onChange={(e) => setDest(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={label}>وقت المغادرة</label>
          <input type="datetime-local" className={input} value={datetime} onChange={(e) => setDatetime(e.target.value)} />
        </div>
      </div>

      {type === 'passenger' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">الركاب</span>
            <button onClick={() => setPassengers([...passengers, { ...emptyPassenger }])} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="w-3.5 h-3.5" /> إضافة راكب
            </button>
          </div>
          {passengers.map((p, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-2 rounded-lg bg-accent/30">
              <div><label className={label}>الاسم</label><input className={input} value={p.name} onChange={(e) => setP(i, 'name', e.target.value)} /></div>
              <div><label className={label}>رقم الجواز</label><input className={input} value={p.passport_number} onChange={(e) => setP(i, 'passport_number', e.target.value)} /></div>
              <div><label className={label}>الجنسية</label><input className={input} value={p.nationality} onChange={(e) => setP(i, 'nationality', e.target.value)} /></div>
              <div><label className={label}>تاريخ الميلاد</label><input className={input} value={p.dob} onChange={(e) => setP(i, 'dob', e.target.value)} placeholder="YYYY-MM-DD" /></div>
              <div className="flex gap-2">
                <div className="flex-1"><label className={label}>المقعد</label><input className={input} value={p.seat} onChange={(e) => setP(i, 'seat', e.target.value)} /></div>
                <button onClick={() => setPassengers(passengers.filter((_, j) => j !== i))} className="p-2 rounded-md hover:bg-red-50 text-red-500 mb-0.5" title="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">الشحنات</span>
            <button onClick={() => setCargo([...cargo, { ...emptyCargo }])} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="w-3.5 h-3.5" /> إضافة شحنة
            </button>
          </div>
          {cargo.map((c, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end p-2 rounded-lg bg-accent/30">
              <div><label className={label}>الوصف</label><input className={input} value={c.description} onChange={(e) => setC(i, 'description', e.target.value)} /></div>
              <div><label className={label}>الوزن</label><input className={input} value={c.weight} onChange={(e) => setC(i, 'weight', e.target.value)} /></div>
              <div><label className={label}>المرسِل إليه</label><input className={input} value={c.consignee} onChange={(e) => setC(i, 'consignee', e.target.value)} /></div>
              <div className="flex gap-2 items-end">
                <label className="flex items-center gap-1.5 text-sm pb-2.5"><input type="checkbox" checked={c.hazardous} onChange={(e) => setC(i, 'hazardous', e.target.checked)} /> خطرة</label>
                <button onClick={() => setCargo(cargo.filter((_, j) => j !== i))} className="p-2 rounded-md hover:bg-red-50 text-red-500 mb-0.5" title="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={submit} disabled={submitting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        <Send className="w-4 h-4" /> {submitting ? 'جارٍ التقديم والفحص...' : 'تقديم البيان'}
      </button>
    </div>
  );
}