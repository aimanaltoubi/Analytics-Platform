import { Download } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';

function escapeCell(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  }
  return lines.join('\n');
}

function downloadCsv(filename, csv) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function WorkspaceCsvExport({ workspace, entities }) {
  const { toast } = useToast();

  const exportEntities = () => {
    if (!entities || entities.length === 0) {
      toast({ title: 'لا توجد كيانات للتصدير', variant: 'destructive' });
      return;
    }
    const rows = entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      aliases: (e.aliases || []).join(' | '),
      mention_count: e.mention_count || 0,
      risk_score: e.risk_score || 0,
      watchlist: e.watchlist ? 'نعم' : 'لا'
    }));
    downloadCsv(`${workspace.name}-كيانات.csv`, toCsv(rows, ['id', 'name', 'type', 'aliases', 'mention_count', 'risk_score', 'watchlist']));
    toast({ title: 'تم تصدير الكيانات' });
  };

  const exportConnections = async () => {
    const entityIds = new Set(entities.map((e) => e.id));
    if (entityIds.size === 0) {
      toast({ title: 'لا توجد كيانات للتصدير', variant: 'destructive' });
      return;
    }
    try {
      const conns = await localClient.entities.Connection.list('-created_date', 500);
      const filtered = conns.filter((c) => entityIds.has(c.source_entity_id) || entityIds.has(c.target_entity_id));
      if (filtered.length === 0) {
        toast({ title: 'لا توجد روابط بين كيانات المساحة', variant: 'destructive' });
        return;
      }
      const rows = filtered.map((c) => ({
        id: c.id,
        source_entity: c.source_entity_name,
        target_entity: c.target_entity_name,
        relationship_type: c.relationship_type,
        evidence: c.evidence || '',
        strength: c.strength || 1,
        document_id: c.document_id || ''
      }));
      downloadCsv(`${workspace.name}-روابط.csv`, toCsv(rows, ['id', 'source_entity', 'target_entity', 'relationship_type', 'evidence', 'strength', 'document_id']));
      toast({ title: 'تم تصدير الروابط' });
    } catch (e) {
      toast({ title: 'فشل التصدير', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold">تصدير CSV</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">صدّر كيانات وروابط مساحة العمل لدمجها مع مصادر بيانات خارجية.</p>
      <div className="flex flex-wrap gap-3">
        <button onClick={exportEntities} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent transition-colors">
          <Download className="w-4 h-4" /> تصدير الكيانات ({entities.length})
        </button>
        <button onClick={exportConnections} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent transition-colors">
          <Download className="w-4 h-4" /> تصدير الروابط
        </button>
      </div>
    </div>
  );
}