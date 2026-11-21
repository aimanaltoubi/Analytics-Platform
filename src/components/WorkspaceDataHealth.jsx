import { AlertTriangle, CheckCircle2, Clock3, FileText, Link2, MapPin, Users } from 'lucide-react';

/** @param {unknown} value @param {number} maxHours */
function isFresh(value, maxHours) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= maxHours * 60 * 60 * 1000;
}

/**
 * @param {{
 * icon: import('lucide-react').LucideIcon,
 * label: string,
 * value: number | string,
 * status: 'good' | 'warn' | 'bad',
 * note?: string
 * }} props
 */
function StatusRow({ icon: Icon, label, value, status, note }) {
  const styles = {
    good: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    warn: 'text-amber-700 bg-amber-50 border-amber-200',
    bad: 'text-red-700 bg-red-50 border-red-200'
  };

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${styles[status]}`}>
      <span className="mt-0.5"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm font-bold">{value}</span>
        </div>
        {note && <p className="mt-1 text-xs opacity-80">{note}</p>}
      </div>
    </div>
  );
}

/**
 * @param {{
 * entities?: Array<{ type?: string, latitude?: number | null, longitude?: number | null, document_ids?: string[] }>,
 * documents?: Array<{ id?: string, status?: string, summary_generated_at?: string, updated_date?: string, created_date?: string }>,
 * connections?: Array<{ document_id?: string, evidence?: string }>
 * }} props
 */
export default function WorkspaceDataHealth({ entities = [], documents = [], connections = [] }) {
  const processed = documents.filter((document) => document.status === 'processed').length;
  const failed = documents.filter((document) => document.status === 'failed').length;
  const pending = documents.filter((document) => document.status === 'pending' || document.status === 'processing').length;
  const linkedDocuments = new Set(documents.map((document) => document.id));
  const documentsWithEvidence = new Set(connections.filter((connection) => connection.document_id).map((connection) => connection.document_id));
  const unverifiedLinks = connections.filter((connection) => !connection.evidence?.trim()).length;
  const missingLocations = entities.filter((entity) => entity.type === 'location' && (entity.latitude == null || entity.longitude == null)).length;
  const recentlyProcessed = documents.filter((document) => isFresh(document.summary_generated_at || document.updated_date || document.created_date, 168)).length;

  const documentStatus = documents.length === 0 ? 'warn' : failed > 0 ? 'bad' : pending > 0 ? 'warn' : processed === documents.length ? 'good' : 'warn';
  const evidenceStatus = unverifiedLinks === 0 && connections.length > 0 ? 'good' : unverifiedLinks === 0 ? 'warn' : unverifiedLinks > connections.length / 2 ? 'bad' : 'warn';
  const locationStatus = missingLocations > 0 ? 'warn' : entities.some((entity) => entity.type === 'location') ? 'good' : 'warn';
  const entityCountWithoutDocuments = entities.filter((entity) => !(entity.document_ids || []).length).length;
  const entityDocumentStatus = entityCountWithoutDocuments === 0 && entities.length > 0 ? 'good' : 'warn';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> صحة بيانات مساحة العمل
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          تقييم محلي لتغطية المعالجة والدليل، دون الاعتماد على أي خدمة خارجية.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatusRow
          icon={FileText}
          label="المستندات المعالجة"
          value={`${processed}/${documents.length}`}
          status={documentStatus}
          note={documents.length === 0 ? 'لا توجد مستندات في مساحة العمل بعد.' : failed ? `${failed} مستند فشل و${pending} ما زالت قيد المعالجة.` : pending ? `${pending} مستند ما زال قيد المعالجة.` : 'لا توجد مستندات متأخرة في صف المعالجة.'}
        />
        <StatusRow
          icon={Link2}
          label="روابط بلا دليل نصي"
          value={unverifiedLinks}
          status={evidenceStatus}
          note={connections.length ? `${documentsWithEvidence.size}/${linkedDocuments.size || 0} مستندات مرتبطة بروابط موثقة.` : 'لا توجد روابط للتحقق منها.'}
        />
        <StatusRow
          icon={MapPin}
          label="مواقع بلا إحداثيات"
          value={missingLocations}
          status={locationStatus}
          note={missingLocations ? 'أضف خط العرض والطول أو عالج المستندات مرة أخرى لتثبيت الموقع.' : 'المواقع جغرافية أو لا توجد مواقع مسجلة.'}
        />
        <StatusRow
          icon={Clock3}
          label="نتائج حديثة خلال أسبوع"
          value={recentlyProcessed}
          status={recentlyProcessed > 0 ? 'good' : 'warn'}
          note={recentlyProcessed ? 'يوجد ملخصات أو معالجة حديثة مرتبطة بالمستندات.' : 'لا توجد معالجة حديثة قابلة للتوقيت.'}
        />
        <StatusRow
          icon={Users}
          label="الكيانات بلا مستندات مرتبطة"
          value={entityCountWithoutDocuments}
          status={entityDocumentStatus}
          note={entityCountWithoutDocuments === 0 && entities.length > 0 ? 'جميع الكيانات مرتبطة بمستندات مصدر.' : 'يساعد الربط بالمستندات على تتبع أصل كل ملف شخصي.'}
        />
        <StatusRow
          icon={AlertTriangle}
          label="مسائل تحتاج مراجعة"
          value={failed + pending + unverifiedLinks + missingLocations}
          status={failed + unverifiedLinks + missingLocations > 0 ? 'bad' : pending > 0 ? 'warn' : documents.length === 0 && entities.length === 0 && connections.length === 0 ? 'warn' : 'good'}
          note="العناصر الحالية: الفشل، المعالجة، غياب الدليل، والمواقع غير المكتملة."
        />
      </div>
    </div>
  );
}
