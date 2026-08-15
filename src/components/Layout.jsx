import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Share2, Users, LogOut, Network as NetworkIcon, BarChart3, Search, Upload, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/documents', label: 'المستندات', icon: FileText, end: false },
  { to: '/import', label: 'استيراد CSV', icon: Upload, end: false },
  { to: '/network', label: 'شبكة العلاقات', icon: Share2, end: false },
  { to: '/entities', label: 'الكيانات', icon: Users, end: false },
  { to: '/workspaces', label: 'مساحات العمل', icon: FolderOpen, end: false },
  { to: '/analytics', label: 'التحليلات', icon: BarChart3, end: false },
  { to: '/search', label: 'البحث', icon: Search, end: false }
];

export default function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = '/login';
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      {/* الشريط الجانبي */}
      <aside className="w-64 shrink-0 border-l border-border bg-sidebar flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <NetworkIcon className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-bold text-sm">محلّل الكيانات</div>
            <div className="text-[11px] text-muted-foreground">تحليل روابط</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60'
                  }`
                }
              >
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs text-muted-foreground truncate">{user?.email || 'مستخدم'}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* المحتوى */}
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}