import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, formatDate, formatTime, diasAtras, diaSemanaAbrev, getWhatsAppScript, getSaudacao, getDataHojeCompleta, margemColorClass } from "@/lib/format";
import { TrendingUp, Target, Percent, Receipt, AlertTriangle, MessageCircle, ChevronDown, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

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
      const { data } = await supabase.from("vendas").select("*").gte("created_at", monthStart).order("created_at", { ascending: false });
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
        <Skeleton className="h-8 w-64 rounded-lg" />
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
  const allMes = vendasMes || [];
  const fatMes = allMes.reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
  const numVendasMes = allMes.length;
  const ticketMedio = numVendasMes > 0 ? fatMes / numVendasMes : 0;

  // Chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayVendas = (vendas || []).filter(v => { const vd = new Date(v.created_at!); return vd >= dayStart && vd < dayEnd; });
    return { dia: diaSemanaAbrev(d), valor: dayVendas.reduce((s, v) => s + v.preco_venda * v.quantidade, 0) };
  });

  // Top 5 produtos do mês
  const produtoMapMes: Record<string, { nome: string; total: number; qtd: number; custo: number }> = {};
  allMes.forEach(v => {
    const key = v.produto_id || v.produto_nome || '';
    if (!produtoMapMes[key]) produtoMapMes[key] = { nome: v.produto_nome || '', total: 0, qtd: 0, custo: 0 };
    produtoMapMes[key].total += v.preco_venda * v.quantidade;
    produtoMapMes[key].qtd += v.quantidade;
    produtoMapMes[key].custo += v.custo_unit * v.quantidade;
  });
  const top5 = Object.values(produtoMapMes).sort((a, b) => b.total - a.total).slice(0, 5);

  // Weekly day groups for sheet
  const weekDayGroups = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayVendas = (vendas || []).filter(v => { const vd = new Date(v.created_at!); return vd >= dayStart && vd < dayEnd; });
    const fat = dayVendas.reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
    const custo = dayVendas.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
    return { date: dayStart, dateStr: formatDate(dayStart), vendas: dayVendas, fat, margem: fat > 0 ? ((fat - custo) / fat) * 100 : 0 };
  });

  // Category breakdown for margin sheet
  const catBreakdown: Record<string, { total: number; custo: number }> = {};
  (vendas || []).forEach(v => {
    const cat = v.produto_nome?.includes('Whey') ? 'Whey' : v.produto_nome?.includes('Creatina') ? 'Creatina' : v.produto_nome?.includes('Pré-treino') || v.produto_nome?.includes('Black Skull') ? 'Pré-treino' : v.produto_nome?.includes('Pasta') || v.produto_nome?.includes('Gummy') ? 'Sobremesa' : v.produto_nome?.includes('Vitamina') ? 'Vitamina' : 'Outro';
    if (!catBreakdown[cat]) catBreakdown[cat] = { total: 0, custo: 0 };
    catBreakdown[cat].total += v.preco_venda * v.quantidade;
    catBreakdown[cat].custo += v.custo_unit * v.quantidade;
  });
  const catList = Object.entries(catBreakdown).map(([cat, d]) => ({ cat, ...d, margem: d.total > 0 ? ((d.total - d.custo) / d.total) * 100 : 0 })).sort((a, b) => b.total - a.total);

  // Ticket médio breakdown
  const faixas = [
    { label: '< R$50', min: 0, max: 50 },
    { label: 'R$50–100', min: 50, max: 100 },
    { label: 'R$100–200', min: 100, max: 200 },
    { label: '> R$200', min: 200, max: Infinity },
  ];
  const faixaData = faixas.map(f => ({
    ...f, count: allMes.filter(v => { const t = v.preco_venda * v.quantidade; return t >= f.min && t < f.max; }).length,
  }));
  const pgtoTicket: Record<string, { total: number; count: number }> = {};
  allMes.forEach(v => {
    const k = v.forma_pgto || 'Outro';
    if (!pgtoTicket[k]) pgtoTicket[k] = { total: 0, count: 0 };
    pgtoTicket[k].total += v.preco_venda * v.quantidade;
    pgtoTicket[k].count++;
  });
  const vendaMaisAlta = allMes.length ? Math.max(...allMes.map(v => v.preco_venda * v.quantidade)) : 0;
  const vendaMaisBaixa = allMes.length ? Math.min(...allMes.map(v => v.preco_venda * v.quantidade)) : 0;

  // Resumo do mês
  const custosMes = allMes.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
  const custosFixos = 2000;
  const ebitda = fatMes - custosMes - custosFixos;
  const breakEven = 6450;
  const diasPassados = today.getDate();
  const projecao = diasPassados > 0 ? (fatMes / diasPassados) * 30 : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-lg font-bold text-secondary">{getSaudacao()}</h1>
        <p className="text-sm text-muted-foreground">{getDataHojeCompleta()}</p>
      </div>

      {/* Stock alert */}
      {(produtosAlerta || []).length > 0 && (
        <button onClick={() => navigate("/estoque")} className="w-full bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-3 text-left transition-colors hover:bg-destructive/15 active:scale-[0.98]">
          <AlertTriangle size={20} className="text-destructive shrink-0" />
          <span className="text-sm font-medium text-destructive">⚠ {produtosAlerta!.length} produto{produtosAlerta!.length > 1 ? 's' : ''} precisa{produtosAlerta!.length > 1 ? 'm' : ''} de reposição — Ver estoque</span>
        </button>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => setOpenSheet('hoje')} className="rounded-xl p-4 shadow-sm space-y-2 bg-primary text-primary-foreground text-left transition-transform active:scale-[0.97]">
          <div className="flex items-center gap-2 text-primary-foreground/70"><TrendingUp size={16} /><span className="text-xs font-medium">Faturamento hoje</span></div>
          <p className="text-xl font-bold">{formatCurrency(fatHoje)}</p>
        </button>

        <button onClick={() => setOpenSheet('semana')} className="bg-card rounded-xl p-4 shadow-sm space-y-2 text-left transition-transform active:scale-[0.97]">
          <div className="flex items-center gap-2 text-muted-foreground"><Target size={16} /><span className="text-xs font-medium">Fat. semana</span></div>
          <p className="text-lg font-bold">{formatCurrency(fatSemana)}</p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min((fatSemana / metaSemana) * 100, 100)}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(fatSemana)} / {formatCurrency(metaSemana)}</p>
        </button>

        <button onClick={() => setOpenSheet('margem')} className="bg-card rounded-xl p-4 shadow-sm space-y-2 text-left transition-transform active:scale-[0.97]">
          <div className="flex items-center gap-2 text-muted-foreground"><Percent size={16} /><span className="text-xs font-medium">Margem bruta</span></div>
          <p className={`text-xl font-bold ${margemColorClass(margemPct)}`}>{formatPercent(margemPct)}</p>
        </button>

        <button onClick={() => setOpenSheet('ticket')} className="bg-card rounded-xl p-4 shadow-sm space-y-2 text-left transition-transform active:scale-[0.97]">
          <div className="flex items-center gap-2 text-muted-foreground"><Receipt size={16} /><span className="text-xs font-medium">Ticket médio</span></div>
          <p className="text-xl font-bold">{formatCurrency(ticketMedio)}</p>
        </button>
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
                  <a href={whatsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-9 h-9 rounded-full bg-success flex items-center justify-center transition-transform active:scale-95">
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
            <Tooltip formatter={(v: number) => [formatCurrency(v), 'Faturamento']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
            <Bar dataKey="valor" fill="hsl(193, 100%, 42%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 5 produtos do mês */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-secondary mb-3">Top produtos do mês</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 pr-2">#</th>
                <th className="text-left py-2 pr-2">Produto</th>
                <th className="text-right py-2 pr-2">Qtd</th>
                <th className="text-right py-2 pr-2">Fat. R$</th>
                <th className="text-right py-2">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((p, i) => {
                const m = p.total > 0 ? ((p.total - p.custo) / p.total) * 100 : 0;
                return (
                  <tr key={i} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                    <td className="py-2 pr-2 font-bold text-secondary">{i + 1}º</td>
                    <td className="py-2 pr-2 font-medium truncate max-w-[150px]">{p.nome}</td>
                    <td className="py-2 pr-2 text-right">{p.qtd}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatCurrency(p.total)}</td>
                    <td className={`py-2 text-right font-medium ${margemColorClass(m)}`}>{formatPercent(m)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium">EBITDA estimado</p>
          <p className={`text-xl font-bold ${ebitda >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(ebitda)}</p>
          <p className="text-[10px] text-muted-foreground">Custos fixos: R$2.000/mês</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Break-even</p>
          <p className="text-lg font-bold">{formatCurrency(fatMes)} <span className="text-xs font-normal text-muted-foreground">de {formatCurrency(breakEven)}</span></p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min((fatMes / breakEven) * 100, 100)}%` }} />
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Projeção do mês</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(projecao)}</p>
          <p className="text-[10px] text-muted-foreground">Projeção baseada no ritmo atual</p>
        </div>
      </div>

      {/* === SHEETS === */}

      {/* Faturamento hoje */}
      <Sheet open={openSheet === 'hoje'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Vendas de hoje</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            {vendasHoje.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma venda hoje.</p>}
            {vendasHoje.map(v => (
              <div key={v.id} className="border-b pb-3 space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{v.produto_nome}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(v.created_at!)} · {v.quantidade}× {formatCurrency(v.preco_venda)}</p>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(v.preco_venda * v.quantidade)}</p>
                </div>
                <div className="flex gap-2">
                  {v.forma_pgto && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{v.forma_pgto}</span>}
                  {v.canal && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{v.canal}</span>}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">+{formatCurrency((v.preco_venda - v.custo_unit) * v.quantidade)}</span>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t">
              <p className="text-sm font-bold">Total: {formatCurrency(fatHoje)}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Fat. semana */}
      <Sheet open={openSheet === 'semana'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Faturamento da semana</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4">
            {weekDayGroups.map((dg, i) => (
              <div key={i} className="border rounded-xl overflow-hidden">
                <button onClick={() => setExpandedDay(expandedDay === dg.dateStr ? null : dg.dateStr)} className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left">
                  <div>
                    <p className="text-sm font-medium">{dg.dateStr}</p>
                    <p className="text-xs text-muted-foreground">{dg.vendas.length} vendas · Margem {formatPercent(dg.margem)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{formatCurrency(dg.fat)}</p>
                    {expandedDay === dg.dateStr ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>
                {expandedDay === dg.dateStr && dg.vendas.length > 0 && (
                  <div className="border-t px-3 pb-3 space-y-2 bg-muted/20">
                    {dg.vendas.map(v => (
                      <div key={v.id} className="flex justify-between text-xs pt-2">
                        <span>{formatTime(v.created_at!)} · {v.produto_nome}</span>
                        <span className="font-medium">{formatCurrency(v.preco_venda * v.quantidade)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Margem breakdown */}
      <Sheet open={openSheet === 'margem'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Margem por categoria</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            {catList.map(c => (
              <div key={c.cat} className="flex items-center justify-between p-3 border rounded-xl">
                <div>
                  <p className="text-sm font-medium">{c.cat}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(c.total)} vendido</p>
                </div>
                <span className={`text-sm font-bold ${margemColorClass(c.margem)}`}>{formatPercent(c.margem)}</span>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Ticket médio breakdown */}
      <Sheet open={openSheet === 'ticket'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Distribuição de ticket</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Vendas por faixa de valor</p>
              {faixaData.map(f => (
                <div key={f.label} className="flex justify-between items-center p-3 border rounded-xl">
                  <span className="text-sm">{f.label}</span>
                  <span className="text-sm font-bold">{f.count} vendas</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Ticket médio por forma de pagamento</p>
              {Object.entries(pgtoTicket).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center p-3 border rounded-xl">
                  <span className="text-sm">{k}</span>
                  <span className="text-sm font-bold">{formatCurrency(v.count > 0 ? v.total / v.count : 0)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border rounded-xl">
                <p className="text-[10px] text-muted-foreground">Venda mais alta</p>
                <p className="text-sm font-bold text-success">{formatCurrency(vendaMaisAlta)}</p>
              </div>
              <div className="p-3 border rounded-xl">
                <p className="text-[10px] text-muted-foreground">Venda mais baixa</p>
                <p className="text-sm font-bold">{formatCurrency(vendaMaisBaixa)}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
