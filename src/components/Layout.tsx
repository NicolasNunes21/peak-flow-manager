import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, Bell } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/venda", label: "Venda", icon: ShoppingCart, highlight: true },
  { path: "/estoque", label: "Estoque", icon: Package },
  { path: "/clientes", label: "Clientes", icon: Users },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop: sidebar takes full height */}
      {!isMobile && (
        <aside className="w-56 bg-secondary flex flex-col shrink-0 min-h-screen">
          {/* Logo in sidebar */}
          <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
            <span className="text-lg font-extrabold text-secondary-foreground tracking-tight">PEAK</span>
            <span className="text-sm font-medium text-primary ml-1">Suplementos</span>
          </div>
          <nav className="flex flex-col gap-1 px-3 pt-2">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <div className="flex flex-col flex-1 min-h-screen">
        {/* Top navbar - mobile only shows logo, desktop shows notification only */}
        <header className="bg-secondary h-14 flex items-center justify-between px-4 shrink-0 z-20 md:bg-background md:border-b md:border-border">
          <div className="flex items-center gap-1 md:hidden">
            <span className="text-lg font-extrabold text-secondary-foreground tracking-tight">PEAK</span>
            <span className="text-sm font-medium text-primary">Suplementos</span>
          </div>
          <div className="hidden md:block" />
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell size={20} className="text-secondary-foreground md:text-foreground" />
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
          <div className="max-w-5xl mx-auto p-4">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t flex items-end justify-around py-1 z-20 safe-area-pb">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            if (item.highlight) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-center -mt-4"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    active ? "bg-primary" : "bg-primary/90"
                  }`}>
                    <item.icon size={24} className="text-primary-foreground" />
                  </div>
                  <span className="text-[10px] mt-0.5 font-medium text-primary">{item.label}</span>
                </button>
              );
            }
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center py-1.5 px-3"
              >
                <item.icon size={20} className={active ? "text-primary" : "text-muted-foreground"} />
                <span className={`text-[10px] mt-0.5 font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
