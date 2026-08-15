import { AlertOctagon } from 'lucide-react';
import AlertsList from '@/components/AlertsList';
import RiskProfileManager from '@/components/RiskProfileManager';

export default function Alerts() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <AlertOctagon className="w-6 h-6 text-red-500" /> محرك التنبيهات (CEP)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          محرك قواعد يعمل في الخلفية ويقيّم البيانات الواردة مقابل ملفات الخطر المُعرّفة، ويُنشئ تنبيهات تلقائية عند تطابق الأنماط.
        </p>
      </div>
      <RiskProfileManager />
      <AlertsList />
    </div>
  );
}