import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const TYPE_OPTIONS = [
  { value: 'person', label: 'شخص' },
  { value: 'organization', label: 'منظمة' },
  { value: 'phone', label: 'هاتف' },
  { value: 'email', label: 'بريد' },
  { value: 'location', label: 'موقع' },
  { value: 'account', label: 'حساب' },
  { value: 'date', label: 'تاريخ' },
  { value: 'event', label: 'حدث' },
  { value: 'other', label: 'أخرى' }
];

const TYPE_LABELS = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

export default function EntityCorrector({ entity, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(entity.name);
  const [type, setType] = useState(entity.type);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const startEdit = () => {
    setName(entity.name);
    setType(entity.type);
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const updated = await base44.entities.Entity.update(entity.id, {
        name: name.trim(),
        type
      });
      toast({ title: 'تم تصحيح الكيان', description: `${entity.name} ← ${updated.name}` });
      setEditing(false);
      onSaved?.(updated);
    } catch (e) {
      toast({ title: 'فشل التصحيح', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="p-2.5 rounded-lg bg-accent/40 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            autoFocus
            className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="الاسم الصحيح"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={saving}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={cancel}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-border hover:bg-accent transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" /> إلغاء
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            حفظ التصحيح
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
      <Link to={`/entities/${entity.id}`} className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{entity.name}</div>
        {entity.aliases?.length > 0 && (
          <div className="text-xs text-muted-foreground truncate">{entity.aliases.join('، ')}</div>
        )}
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">{TYPE_LABELS[entity.type] || entity.type}</span>
        <button
          onClick={startEdit}
          title="تصحيح"
          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-accent opacity-0 group-hover:opacity-100 transition-all"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}