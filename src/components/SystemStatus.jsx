import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle } from 'lucide-react';
import { localClient } from '@/api/localClient';

export default function SystemStatus() {
  const [processing, setProcessing] = useState(0);
  const [newAlerts, setNewAlerts] = useState(0);
  const [now, setNow] = useState(new Date());
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [docs, alerts, status] = await Promise.all([
        localClient.entities.Document.list('-created_date', 50),
        localClient.entities.Alert.filter({ status: 'new' }, '-created_date', 50),
        localClient.status()
      ]);
      setProcessing(docs.filter((d) => d.status === 'processing' || d.status === 'pending').length);
      setNewAlerts(alerts.length);
      setAvailable(status.ai?.available === true);
      setError('');
    } catch (e) {
      console.error('Could not load local system status', e);
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 1000);
    const r = setInterval(load, 30000);
    return () => { clearInterval(t); clearInterval(r); };
  }, []);

  const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = now.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' });

  return (
    <div className="flex items-center gap-2.5">
      <Link to="/documents" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-card hover:bg-accent transition-colors">
        <Activity className={`w-3.5 h-3.5 ${processing > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
        <span className="text-muted-foreground">المعالجة</span>
        <span className="font-mono font-semibold tabular-nums">{processing}</span>
      </Link>
      <Link to="/alerts" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-card hover:bg-accent transition-colors">
        <AlertTriangle className={`w-3.5 h-3.5 ${newAlerts > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
        <span className="text-muted-foreground">تنبيهات</span>
        <span className="font-mono font-semibold tabular-nums">{newAlerts}</span>
      </Link>
      <div className="hidden lg:flex items-center gap-2.5 text-xs text-muted-foreground border-r border-border pr-3">
        <span className="font-mono tabular-nums">{date}</span>
        <span className="font-mono tabular-nums text-foreground font-medium">{time}</span>
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : available ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {error ? 'تعذّر الاتصال' : available ? 'تحليل محلي جاهز' : 'النموذج غير جاهز'}
        </span>
      </div>
    </div>
  );
}