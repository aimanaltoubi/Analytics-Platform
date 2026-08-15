import { useState } from 'react';
import { ShieldCheck, ListChecks, BarChart3 } from 'lucide-react';
import ManifestForm from '@/components/ManifestForm';
import ManifestTextUploader from '@/components/ManifestTextUploader';
import ManifestList from '@/components/ManifestList';
import TransitAnalytics from '@/components/TransitAnalytics';

export default function TransitSecurity() {
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState('manifests');

  const tabs = [
    { id: 'manifests', label: 'البيانات', icon: ListChecks },
    { id: 'analytics', label: 'التحليلات', icon: BarChart3 }
  ];

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

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'manifests' ? (
        <>
          <ManifestTextUploader onExtracted={() => setTick((t) => t + 1)} />
          <ManifestForm onSubmitted={() => setTick((t) => t + 1)} />
          <ManifestList key={tick} />
        </>
      ) : (
        <TransitAnalytics />
      )}
    </div>
  );
}