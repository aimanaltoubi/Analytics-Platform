import { useState } from 'react';
import { Save, Plus, X, User, Building2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Image as UIImage } from '@/components/ui/image';

const PERSON_FIELDS = [
  { key: 'تاريخ الميلاد', label: 'تاريخ الميلاد', type: 'date' },
  { key: 'مكان الميلاد', label: 'مكان الميلاد', type: 'text' },
  { key: 'الجنسية', label: 'الجنسية', type: 'text' },
  { key: 'رقم الجواز', label: 'رقم الجواز', type: 'text' },
  { key: 'الرقم الوطني / رقم الهوية', label: 'رقم الهوية / الرقم الوطني', type: 'text' },
  { key: 'رقم الهاتف', label: 'رقم الهاتف', type: 'text' },
  { key: 'البريد الإلكتروني', label: 'البريد الإلكتروني', type: 'email' },
  { key: 'العنوان', label: 'العنوان', type: 'text' }
];

const ORG_FIELDS = [
  { key: 'الاسم القانوني', label: 'الاسم القانوني الكامل', type: 'text' },
  { key: 'رقم التسجيل', label: 'رقم التسجيل', type: 'text' },
  { key: 'الدولة', label: 'الدولة', type: 'text' },
  { key: 'العنوان', label: 'العنوان', type: 'text' },
  { key: 'رقم الهاتف', label: 'رقم الهاتف', type: 'text' },
  { key: 'البريد الإلكتروني', label: 'البريد الإلكتروني', type: 'email' },
  { key: 'الممثل القانوني', label: 'الممثل القانوني', type: 'text' }
];

const COMPANY_FIELDS = [
  { key: 'الاسم القانوني', label: 'الاسم القانوني للشركة', type: 'text' },
  { key: 'رقم التسجيل', label: 'رقم التسجيل التجاري', type: 'text' },
  { key: 'السجل التجاري', label: 'السجل التجاري', type: 'text' },
  { key: 'الشكل القانوني', label: 'الشكل القانوني (ذ.م.م، مساهمة...)', type: 'text' },
  { key: 'رأس المال', label: 'رأس المال', type: 'text' },
  { key: 'النشاط', label: 'النشاط التجاري', type: 'text' },
  { key: 'الدولة', label: 'الدولة', type: 'text' },
  { key: 'العنوان', label: 'العنوان', type: 'text' },
  { key: 'رقم الهاتف', label: 'رقم الهاتف', type: 'text' },
  { key: 'البريد الإلكتروني', label: 'البريد الإلكتروني', type: 'email' },
  { key: 'المدير المسؤول', label: 'المدير المسؤول', type: 'text' }
];

export default function PiiEditor({ entity, onSaved }) {
  const isPerson = entity.type === 'person';
  const isCompany = entity.type === 'company';
  const fields = isPerson ? PERSON_FIELDS : isCompany ? COMPANY_FIELDS : ORG_FIELDS;
  const [name, setName] = useState(entity.name || '');
  const [aliases, setAliases] = useState((entity.aliases || []).join('، '));
  const [attrs, setAttrs] = useState({ ...(entity.attributes || {}) });
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [photoUrl, setPhotoUrl] = useState(entity.photo_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setPhotoUrl(file_url);
    } catch (err) {
      toast({ title: 'فشل رفع الصورة', description: err.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const addCustom = () => {
    const k = newKey.trim();
    if (!k || attrs[k] !== undefined) return;
    setAttrs({ ...attrs, [k]: newValue });
    setNewKey(''); setNewValue('');
  };

  const removeAttr = (k) => {
    const next = { ...attrs }; delete next[k]; setAttrs(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const aliasArr = aliases.split('،').map((a) => a.trim()).filter(Boolean);
      const updated = await base44.entities.Entity.update(entity.id, {
        name: name.trim() || entity.name,
        aliases: aliasArr,
        attributes: attrs,
        photo_url: photoUrl
      });
      toast({ title: 'تم حفظ بيانات الكيان' });
      onSaved && onSaved(updated);
    } catch (e) {
      toast({ title: 'فشل الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const labelCls = 'text-[11px] font-medium text-muted-foreground mb-1';

  return (
    <div className="space-y-5">
      {/* الهوية */}
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {photoUrl ? (
            <div className="relative">
              <UIImage src={photoUrl} alt={name} className="w-20 h-20 rounded-xl border border-border object-cover" fittingType="fill" />
              <button onClick={() => setPhotoUrl('')} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors">
              {uploading ? (
                <span className="text-[10px] text-muted-foreground">جارٍ الرفع...</span>
              ) : (
                <>
                  {isPerson ? <User className="w-6 h-6 text-muted-foreground" /> : <Building2 className="w-6 h-6 text-muted-foreground" />}
                  <span className="text-[10px] text-muted-foreground mt-1">صورة</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className={labelCls}>{isPerson ? 'الاسم الكامل' : isCompany ? 'اسم الشركة' : 'اسم المنظمة'}</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <div className={labelCls}>الأسماء البديلة (افصل بفاصلة ،)</div>
            <input value={aliases} onChange={(e) => setAliases(e.target.value)} className={inputCls} placeholder="الكنية، الاسم المستعار..." />
          </div>
        </div>
      </div>

      {/* الحقول المنظمة */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">البيانات الشخصية والتعريفية</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key}>
              <div className={labelCls}>{f.label}</div>
              <input
                type={f.type}
                value={attrs[f.key] || ''}
                onChange={(e) => setAttrs({ ...attrs, [f.key]: e.target.value })}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      {/* سمات إضافية */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">حقول إضافية</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        {Object.keys(attrs).filter((k) => !fields.some((f) => f.key === k)).length > 0 && (
          <div className="space-y-1.5 mb-3">
            {Object.entries(attrs).filter(([k]) => !fields.some((f) => f.key === k)).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 rounded-lg bg-accent/40 px-3 py-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-muted-foreground">{k}</div>
                  <div className="text-sm font-medium truncate">{String(v)}</div>
                </div>
                <button onClick={() => removeAttr(k)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="اسم الحقل" className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="القيمة" className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={addCustom} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-border bg-card hover:bg-accent">
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
        </button>
      </div>
    </div>
  );
}