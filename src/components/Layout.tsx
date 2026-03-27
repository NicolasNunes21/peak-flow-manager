import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, Bell, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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
      {!isMobile && (
        <aside className="w-60 flex flex-col shrink-0 min-h-screen bg-secondary shadow-xl">
          <div className="h-16 flex items-center px-5 border-b border-white/10">
            <span className="text-xl font-black text-white tracking-tight">PEAK</span>
            <span className="text-sm font-semibold text-primary ml-1.5">Suplementos</span>
          </div>
          <nav className="flex flex-col gap-0.5 px-3 pt-3 flex-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path || (item.path === "/dashboard" && location.pathname === "/");
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/60 hover:bg-white/8 hover:text-white/90"
                  }`}
                >
                  <item.icon size={17} className={active ? "text-primary" : ""} />
                  {item.label}
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </nav>
          <div className="px-3 pb-4">
            <div className="h-px bg-white/10 mb-3" />
            <button
              onClick={() => navigate("/configuracoes")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full ${
                location.pathname === "/configuracoes"
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              <Settings size={17} />
              Configurações
            </button>
          </div>
        </aside>
      )}

      <div className="flex flex-col flex-1 min-h-screen overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 shrink-0 z-20 bg-secondary md:bg-background/80 md:backdrop-blur-xl md:border-b md:border-border/60">
          <div className="flex items-center gap-1.5 md:hidden">
            <span className="text-lg font-black text-white tracking-tight">PEAK</span>
            <span className="text-sm font-semibold text-primary">Suplementos</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1">
            <button onClick={() => navigate("/configuracoes")} className="p-2 rounded-xl hover:bg-white/10 md:hover:bg-muted transition-colors md:hidden">
              <Settings size={20} className="text-white/80 md:text-foreground" />
            </button>
            <button className="p-2 rounded-xl hover:bg-white/10 md:hover:bg-muted transition-colors">
              <Bell size={20} className="text-white/80 md:text-foreground" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 md:pb-6">
          <div className="max-w-5xl mx-auto p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 safe-area-pb"
          style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)', borderTop: '0.5px solid rgba(0,0,0,0.12)' }}>
          <div className="flex items-end justify-around py-2 px-2">
            {navItems.map((item) => {
              const active = location.pathname === item.path || (item.path === "/dashboard" && location.pathname === "/");
              if (item.highlight) {
                return (
                  <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center -mt-5 px-3">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 transition-all duration-200 active:scale-95 ${active ? "bg-primary" : "bg-primary/90"}`}>
                      <item.icon size={22} className="text-white" />
                    </div>
                    <span className="text-[10px] mt-1 font-semibold text-primary">{item.label}</span>
                  </button>
                );
              }
              return (
                <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center py-1 px-4 transition-all duration-200 active:scale-90">
                  <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? "bg-primary/12" : ""}`}>
                    <item.icon size={22} className={active ? "text-primary" : "text-gray-400"} />
                  </div>
                  <span className={`text-[10px] mt-0.5 font-semibold ${active ? "text-primary" : "text-gray-400"}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
