import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, AlertTriangle, Flag, FileText, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const SEV_STYLE = {
  critical: { dot: 'bg-red-600', text: 'text-red-600', icon: Flag },
  high: { dot: 'bg-orange-500', text: 'text-orange-600', icon: AlertTriangle },
  medium: { dot: 'bg-amber-400', text: 'text-amber-600', icon: AlertTriangle },
  low: { dot: 'bg-blue-500', text: 'text-blue-600', icon: FileText }
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
}

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef(new Set());
  const { toast } = useToast();

  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const list = await base44.entities.Notification.list('-created_date', 30);
        setNotifications(list);
        list.forEach((n) => seenIds.current.add(n.id));
      } catch (e) {} finally { setLoading(false); }

      unsub = base44.entities.Notification.subscribe((event) => {
        if (event.type === 'create' && event.data) {
          const n = event.data;
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          setNotifications((prev) => [n, ...prev].slice(0, 50));
          const SevIcon = (SEV_STYLE[n.severity] || SEV_STYLE.low).icon;
          toast({
            title: n.title,
            description: n.message,
            variant: n.severity === 'critical' || n.severity === 'high' ? 'destructive' : 'default',
          });
        }
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  const markRead = async (id) => {
    try { await base44.entities.Notification.update(id, { read: true }); } catch (e) {}
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try { await base44.entities.Notification.bulkUpdate(unreadIds.map((id) => ({ id, read: true }))); } catch (e) {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-md border border-border bg-background hover:bg-accent transition-colors"
        title="التنبيهات الفورية"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">التنبيهات الفورية</span>
                {unread > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-600 text-white">{unread} جديد</span>}
              </div>
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <CheckCheck className="w-3.5 h-3.5" /> تعليم الكل كمقروء
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">لا توجد تنبيهات</div>
              ) : (
                notifications.map((n) => {
                  const sev = SEV_STYLE[n.severity] || SEV_STYLE.low;
                  const SevIcon = sev.icon;
                  return (
                    <div
                      key={n.id}
                      className={`px-3 py-2.5 border-b border-border/60 hover:bg-accent/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-0.5 shrink-0 w-7 h-7 rounded-full ${sev.dot}/10 flex items-center justify-center`}>
                          <SevIcon className={`w-3.5 h-3.5 ${sev.text}`} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{n.title}</span>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />}
                          </div>
                          {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_date)}</span>
                            {n.entity_id && (
                              <Link to={`/entities/${n.entity_id}`} onClick={() => { markRead(n.id); setOpen(false); }} className="text-[10px] text-primary hover:underline">
                                عرض الكيان
                              </Link>
                            )}
                            {n.document_id && (
                              <Link to={`/documents/${n.document_id}`} onClick={() => { markRead(n.id); setOpen(false); }} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline">
                                المستند
                              </Link>
                            )}
                            {!n.read && (
                              <button onClick={() => markRead(n.id)} className="text-[10px] text-muted-foreground hover:text-foreground ms-auto">
                                تعليم كمقروء
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <Link to="/alerts" onClick={() => setOpen(false)} className="block px-3 py-2.5 text-center text-xs text-primary hover:bg-accent/50 border-t border-border">
              عرض كل التنبيهات
            </Link>
          </div>
        </>
      )}
    </div>
  );
}