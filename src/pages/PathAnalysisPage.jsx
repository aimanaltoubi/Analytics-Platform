import { useState, useEffect } from 'react';
import { GitFork } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PathAnalysis from '@/components/PathAnalysis';

export default function PathAnalysisPage() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ents = await base44.entities.Entity.list('-mention_count', 1000);
        setEntities(ents);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <GitFork className="w-6 h-6 text-primary" /> تحليل المسار بين الكيانات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          إيجاد أقصر مسار في شبكة العلاقات بين كيانين، والكيانات المشتركة التي تربطهما مع الأدلة.
        </p>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">جارٍ تحميل الكيانات...</div>
      ) : entities.length < 2 ? (
        <div className="text-sm text-muted-foreground">لا توجد كيانات كافية لإجراء التحليل.</div>
      ) : (
        <PathAnalysis entities={entities} />
      )}
    </div>
  );
}