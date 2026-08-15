import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import ManifestForm from '@/components/ManifestForm';
import ManifestList from '@/components/ManifestList';

export default function TransitSecurity() {
  const [tick, setTick] = useState(0);
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> أمن الحدود والعبور
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          درع آلي عند المعابر والمطارات: تُقدَّم بيانات الركاب والشحن إلكترونياً قبل المغادرة، فيفحصها محرك حلّ الكيانات فوراً مقابل قائمة المراقبة — كشف الجوازات المسروقة والأسماء المترجمة صوتياً لمقاتلين معروفين — ويُصدر تنبيهات منع الطيران لاعتراض فوري.
        </p>
      </div>
      <ManifestForm onSubmitted={() => setTick((t) => t + 1)} />
      <ManifestList key={tick} />
    </div>
  );
}