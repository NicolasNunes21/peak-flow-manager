import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, ShoppingCart, Truck, Package, Users, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { PeakLogo } from "@/components/PeakLogo";

// Ordem solicitada: Dashboard > CFO Peak > Venda > Compra > Estoque > Clientes
const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/cfo", label: "CFO Peak", icon: Briefcase },
  { path: "/venda", label: "Venda", icon: ShoppingCart, highlight: true },
  { path: "/compras", label: "Compras", icon: Truck },
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
        <aside className="w-64 flex flex-col shrink-0 min-h-screen glass-sidebar relative">
          {/* Glow no topo */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent pointer-events-none" />

          {/* Logo */}
          <div className="px-5 pt-6 pb-7 relative">
            <PeakLogo size={36} withText />
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/8" />

          {/* Nav */}
          <nav className="flex flex-col gap-1 px-3 pt-5 flex-1 relative">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium pressable relative ${
                    active
                      ? "bg-white/10 text-white shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.08)]"
                      : "text-white/55 hover:bg-white/5 hover:text-white/90"
                  }`}
                >
                  {/* Indicador lateral animado */}
                  {active && (
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-primary shadow-[0_0_10px_rgba(16,144,176,0.7)]" />
                  )}
                  <item.icon
                    size={18}
                    strokeWidth={active ? 2.5 : 2}
                    className={`shrink-0 transition-colors ${active ? "text-primary" : "group-hover:text-white"}`}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom: Configurações */}
          <div className="px-3 pb-5 relative">
            <div className="mx-1 h-px bg-white/8 mb-3" />
            <button
              onClick={() => navigate("/configuracoes")}
              className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium pressable w-full ${
                location.pathname === "/configuracoes"
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white/90"
              }`}
            >
              <Settings size={18} strokeWidth={location.pathname === "/configuracoes" ? 2.5 : 2} />
              Configurações
            </button>
          </div>
        </aside>
      )}

      <div className="flex flex-col flex-1 min-h-screen overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 shrink-0 z-20 glass-sidebar md:bg-background/70 md:backdrop-blur-2xl md:border-b md:border-border/50 md:[background:rgba(247,247,247,0.7)]">
          <div className="md:hidden">
            <PeakLogo size={28} withText />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => navigate("/configuracoes")}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Settings size={20} className="text-white/80" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 safe-area-pb"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            borderTop: '0.5px solid rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-end justify-around py-2 px-2">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              if (item.highlight) {
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="flex flex-col items-center -mt-5 px-3"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(16,144,176,0.5)] pressable bg-gradient-to-br from-primary to-[hsl(192_85%_32%)] ${active ? 'ring-2 ring-primary/30' : ''}`}
                    >
                      <item.icon size={22} className="text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-[10px] mt-1 font-semibold text-primary">{item.label}</span>
                  </button>
                );
              }
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-center py-1 px-3 pressable"
                >
                  <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? "bg-primary/12" : ""}`}>
                    <item.icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? "text-primary" : "text-gray-400"} />
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
