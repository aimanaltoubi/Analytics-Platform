import { useState } from 'react';
import { Network as NetworkIcon, Pencil, FileText, Info } from 'lucide-react';
import NetworkGraph from '@/components/NetworkGraph';
import ManualNetworkCanvas from '@/components/ManualNetworkCanvas';

export default function NetworkTab({ entities, connections, documents, allEntities, onAddToWorkspace, onEntityUpdated }) {
  const [mode, setMode] = useState('documents'); // documents | manual

  const docDerivedCount = connections.length;
  const hasData = entities.length > 0;

  return (
    <div className="space-y-3">
      {/* مفتاح الوضع */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setMode('documents')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'documents' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <NetworkIcon className="w-3.5 h-3.5" /> شبكة المستندات
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Pencil className="w-3.5 h-3.5" /> رسم حر
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          {mode === 'documents'
            ? `${entities.length} كيان • ${docDerivedCount} رابط مستخرج من ${documents.length} مستند`
            : 'اسحب الكيانات من السجل لبناء شبكة يدوية'}
        </div>
      </div>

      {/* شبكة المستندات */}
      {mode === 'documents' && (
        <div className="rounded-xl border border-border bg-card p-5">
          {hasData ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-semibold text-sm">شبكة التحليل المشتقة من المستندات</h3>
              </div>
              <NetworkGraph entities={entities} connections={connections} height={620} onEntityUpdated={onEntityUpdated} />
            </>
          ) : (
            <div className="py-16 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد كيانات بعد. أضف مستندات إلى مساحة العمل أو أضف كيانات من السجل لتوليد شبكة التحليل.</p>
            </div>
          )}
        </div>
      )}

      {/* الرسم الحر */}
      {mode === 'manual' && (
        <ManualNetworkCanvas entities={entities} allEntities={allEntities} onAddToWorkspace={onAddToWorkspace} height={620} />
      )}
    </div>
  );
}