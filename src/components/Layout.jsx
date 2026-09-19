import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, LogOut, Network as NetworkIcon, Search, Upload, FolderOpen, MapPin, Bell, ShieldCheck, GitFork, Languages, Database as DatabaseIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SystemStatus from '@/components/SystemStatus';
import NotificationsBell from '@/components/NotificationsBell';

const navGroups = [
  {
    section: 'الرئيسية',
    items: [{ to: '/', label: 'لوحة العمليات', icon: LayoutDashboard, end: true }]
  },
  {
    section: 'الاستيعاب',
    items: [
      { to: '/documents', label: 'المستندات', icon: FileText },
      { to: '/import', label: 'استيراد البيانات', icon: Upload }
    ]
  },
  {
    section: 'التحليل',
    items: [
      { to: '/entities', label: 'الكيانات', icon: Users },
      { to: '/database', label: 'قاعدة البيانات', icon: DatabaseIcon },
      { to: '/workspaces', label: 'مساحات العمل', icon: FolderOpen },
      { to: '/graph', label: 'فهرس العلاقات', icon: GitFork }
    ]
  },
  {
    section: 'العمليات',
    items: [
      { to: '/alerts', label: 'التنبيهات', icon: Bell }
    ]
  },
  {
    section: 'البحث',
    items: [
      { to: '/search', label: 'البحث', icon: Search },
      { to: '/clir', label: 'بحث عبر اللغات', icon: Languages }
    ]
  }
];

export default function Layout() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = '/login';
  };

  const initial = (user?.email || user?.full_name || 'م').charAt(0).toUpperCase();

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      {/* الشريط الجانبي */}
      <aside className="w-60 shrink-0 border-l border-sidebar-border bg-sidebar flex flex-col">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <NetworkIcon className="w-4.5 h-4.5" style={{ width: 17, height: 17 }} />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-bold text-sm leading-tight">Strategic Data Fusion</div>
            <div className="text-[10px] text-muted-foreground tracking-wide">نظام التحليلات الاستراتيجية</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.section}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.section}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `relative flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute right-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                          <Icon className="shrink-0" style={{ width: 16, height: 16 }} />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{user?.full_name || 'مستخدم'}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email || ''}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-sidebar-foreground/75 hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut style={{ width: 16, height: 16 }} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* المحتوى */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* شريط القيادة العلوي */}
        <header className="h-14 shrink-0 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between gap-4 px-4">
          <Link to="/search" className="flex items-center gap-2 w-full max-w-md px-3 py-1.5 rounded-md border border-border bg-background text-sm text-muted-foreground hover:bg-accent transition-colors">
            <Search className="w-4 h-4 shrink-0" />
            <span className="truncate">بحث شامل في الكيانات والمستندات والروابط...</span>
            <kbd className="mr-auto text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground font-mono">/</kbd>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationsBell />
            <SystemStatus />
          </div>
        </header>

        <div className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}