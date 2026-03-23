import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, diasAtras, diaSemanaAbrev, getWhatsAppScript } from "@/lib/format";
import { TrendingUp, Target, Percent, Receipt, AlertTriangle, MessageCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ["vendas-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("*").gte("created_at", weekAgo).order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: vendasMes } = useQuery({
    queryKey: ["vendas-mes"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("preco_venda, quantidade").gte("created_at", monthStart);
      return data || [];
    },
  });

  const { data: produtosAlerta } = useQuery({
    queryKey: ["produtos-alerta"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*");
      return (data || []).filter(p => (p.qtd_atual ?? 0) < (p.estoque_min ?? 0));
    },
  });

  const { data: clientesRecontato } = useQuery({
    queryKey: ["clientes-recontato"],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from("clientes").select("*").lte("data_proximo_recontato", todayStr);
      return data || [];
    },
  });

  if (loadingVendas) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const vendasHoje = (vendas || []).filter(v => v.created_at && v.created_at >= startOfDay);
  const fatHoje = vendasHoje.reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
  const fatSemana = (vendas || []).reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
  const metaSemana = 1750;
  const custoSemana = (vendas || []).reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
  const margemPct = fatSemana > 0 ? ((fatSemana - custoSemana) / fatSemana) * 100 : 0;
  const fatMes = (vendasMes || []).reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
  const numVendasMes = (vendasMes || []).length;
  const ticketMedio = numVendasMes > 0 ? fatMes / numVendasMes : 0;

  const margemColor = margemPct >= 31 ? "text-success" : margemPct >= 25 ? "text-warning" : "text-destructive";

  // Chart data - last 7 days
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayVendas = (vendas || []).filter(v => {
      const vd = new Date(v.created_at!);
      return vd >= dayStart && vd < dayEnd;
    });
    return {
      dia: diaSemanaAbrev(d),
      valor: dayVendas.reduce((s, v) => s + v.preco_venda * v.quantidade, 0),
    };
  });

  // Top 3 produtos
  const produtoMap: Record<string, { nome: string; total: number }> = {};
  (vendas || []).forEach(v => {
    const key = v.produto_id || v.produto_nome || '';
    if (!produtoMap[key]) produtoMap[key] = { nome: v.produto_nome || '', total: 0 };
    produtoMap[key].total += v.preco_venda * v.quantidade;
  });
  const top3 = Object.values(produtoMap).sort((a, b) => b.total - a.total).slice(0, 3);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Alerta de estoque */}
      {(produtosAlerta || []).length > 0 && (
        <button
          onClick={() => navigate("/estoque")}
          className="w-full bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-3 text-left transition-colors hover:bg-destructive/15 active:scale-[0.98]"
        >
          <AlertTriangle size={20} className="text-destructive shrink-0" />
          <span className="text-sm font-medium text-destructive">
            ⚠ {produtosAlerta!.length} produto{produtosAlerta!.length > 1 ? 's' : ''} precisa{produtosAlerta!.length > 1 ? 'm' : ''} de reposição — Ver estoque
          </span>
        </button>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Faturamento hoje" value={formatCurrency(fatHoje)} accent />
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target size={16} />
            <span className="text-xs font-medium">Fat. semana</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(fatSemana)}</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min((fatSemana / metaSemana) * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(fatSemana)} / {formatCurrency(metaSemana)}</p>
        </div>
        <KpiCard icon={Percent} label="Margem bruta" value={formatPercent(margemPct)} valueClass={margemColor} />
        <KpiCard icon={Receipt} label="Ticket médio" value={formatCurrency(ticketMedio)} />
      </div>

      {/* Recontatos */}
      {(clientesRecontato || []).length > 0 && (
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-secondary">Recontatos pendentes</h3>
          <div className="space-y-2">
            {clientesRecontato!.map(c => {
              const dias = diasAtras(c.data_ultima_compra || c.created_at || '');
              const script = getWhatsAppScript(c.nome, c.ultimo_produto_categoria || 'Whey', dias);
              const whatsUrl = `https://wa.me/55${c.whatsapp}?text=${encodeURIComponent(script)}`;
              return (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">há {dias} dias sem compra</p>
                  </div>
                  <a
                    href={whatsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 w-9 h-9 rounded-full bg-success flex items-center justify-center transition-transform active:scale-95"
                  >
                    <MessageCircle size={16} className="text-success-foreground" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-secondary mb-3">Faturamento — últimos 7 dias</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="dia" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} width={55} />
            <Tooltip
              formatter={(v: number) => [formatCurrency(v), 'Faturamento']}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
            <Bar dataKey="valor" fill="hsl(193, 100%, 42%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 3 */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-secondary mb-3">Top 3 produtos da semana</h3>
        <div className="space-y-2">
          {top3.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold">
                {i + 1}º
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.nome}</p>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(p.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent, valueClass }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean; valueClass?: string;
}) {
  return (
    <div className={`rounded-xl p-4 shadow-sm space-y-2 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`flex items-center gap-2 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${valueClass || ''}`}>{value}</p>
    </div>
  );
}
