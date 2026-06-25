import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, formatDate, formatTime, diasAtras, diaSemanaAbrev, getWhatsAppScript, getSaudacao, getDataHojeCompleta, margemColorClass, liquidoVenda } from "@/lib/format";
import { TrendingUp, Target, Percent, Receipt, MessageCircle, ChevronDown, ChevronRight, ChevronUp, Info, BarChart3, Lightbulb, AlertTriangle, Sparkles, TrendingDown, Home, Megaphone, Building2, Handshake, MoreHorizontal, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { gerarInsights, type Insight } from "@/lib/insights";
import { useConfigFinanceira } from "@/lib/configFinanceira";
import EditVendaModal from "@/components/EditVendaModal";
import type { VendaRow } from "@/lib/vendaActions";
import { Pencil } from "lucide-react";

export default function Dashboard() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [editVenda, setEditVenda] = useState<VendaRow | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [selectedChartDay, setSelectedChartDay] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [insightsMinimized, setInsightsMinimized] = useState(false);
  const [recontatosOpen, setRecontatosOpen] = useState(false);
  const [selectedGastoCategoria, setSelectedGastoCategoria] = useState<string | null>(null);

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

  const { data: clientesRecontato } = useQuery({
    queryKey: ["clientes-recontato"],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from("clientes").select("*").lte("data_proximo_recontato", todayStr);
      return data || [];
    },
  });

  const { data: custosFixosData } = useQuery({
    queryKey: ["custos-fixos"],
    queryFn: async () => {
      const { data } = await supabase.from("custos_fixos").select("*");
      return data || [];
    },
  });

  // Configuração financeira (pró-labore + DAS) — usa hook unificado com fallback localStorage
  const { data: configFinResult } = useConfigFinanceira();
  const configFin = configFinResult?.config;

  // Para insights: produtos + vendas últimos 60 dias (para comparar mês atual vs anterior)
  const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: produtos } = useQuery({
    queryKey: ["produtos-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*");
      return data || [];
    },
  });
  const { data: vendas60d } = useQuery({
    queryKey: ["vendas-60d"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("*").gte("created_at", sixtyDaysAgo);
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
  const fatHoje = vendasHoje.reduce((s, v) => s + liquidoVenda(v), 0);
  const fatSemana = (vendas || []).reduce((s, v) => s + liquidoVenda(v), 0);
  const metaSemana = 1750;
  const custoSemana = (vendas || []).reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
  const margemPct = fatSemana > 0 ? ((fatSemana - custoSemana) / fatSemana) * 100 : 0;
  const allMes = vendasMes || [];
  const fatBrutoMes = allMes.reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
  const fatMes = allMes.reduce((s, v) => s + liquidoVenda(v), 0); // líquido (já descontado)
  const numVendasMes = allMes.length;
  const ticketMedio = numVendasMes > 0 ? fatMes / numVendasMes : 0;

  const metaMes = 7000;
  const diasPassados = today.getDate();
  const custosMes = allMes.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);

  // Monthly chart data
  const chartDataMes = Array.from({ length: diasPassados }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayVendas = allMes.filter(v => { const vd = new Date(v.created_at!); return vd >= dayStart && vd < dayEnd; });
    const fat = dayVendas.reduce((s, v) => s + liquidoVenda(v), 0);
    const custo = dayVendas.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
    const ticket = dayVendas.length > 0 ? fat / dayVendas.length : 0;
    const prodMap: Record<string, { nome: string; total: number }> = {};
    dayVendas.forEach(v => { const k = v.produto_nome || ''; if (!prodMap[k]) prodMap[k] = { nome: k, total: 0 }; prodMap[k].total += liquidoVenda(v); });
    return { dia: String(i + 1), valor: fat, vendas: dayVendas, numVendas: dayVendas.length, ticket, margem: fat > 0 ? ((fat - custo) / fat) * 100 : 0, topProds: Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 3), dateStr: formatDate(d) };
  });

  // Monthly day groups for sheet
  const monthDayGroups = Array.from({ length: diasPassados }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), diasPassados - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayVendas = allMes.filter(v => { const vd = new Date(v.created_at!); return vd >= dayStart && vd < dayEnd; });
    const fat = dayVendas.reduce((s, v) => s + liquidoVenda(v), 0);
    const custo = dayVendas.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
    return { date: dayStart, dateStr: formatDate(dayStart), vendas: dayVendas, fat, margem: fat > 0 ? ((fat - custo) / fat) * 100 : 0 };
  });


  // Chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayVendas = (vendas || []).filter(v => { const vd = new Date(v.created_at!); return vd >= dayStart && vd < dayEnd; });
    const fat = dayVendas.reduce((s, v) => s + liquidoVenda(v), 0);
    const custo = dayVendas.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
    const ticket = dayVendas.length > 0 ? fat / dayVendas.length : 0;
    // Top products for this day
    const prodMap: Record<string, { nome: string; total: number }> = {};
    dayVendas.forEach(v => {
      const k = v.produto_nome || '';
      if (!prodMap[k]) prodMap[k] = { nome: k, total: 0 };
      prodMap[k].total += liquidoVenda(v);
    });
    const topProds = Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 3);
    return {
      dia: diaSemanaAbrev(d),
      valor: fat,
      vendas: dayVendas,
      numVendas: dayVendas.length,
      ticket,
      margem: fat > 0 ? ((fat - custo) / fat) * 100 : 0,
      topProds,
      dateStr: formatDate(d),
    };
  });

  // Top 5 produtos do mês
  const produtoMapMes: Record<string, { nome: string; total: number; qtd: number; custo: number }> = {};
  allMes.forEach(v => {
    const key = v.produto_id || v.produto_nome || '';
    if (!produtoMapMes[key]) produtoMapMes[key] = { nome: v.produto_nome || '', total: 0, qtd: 0, custo: 0 };
    produtoMapMes[key].total += liquidoVenda(v);
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
    const fat = dayVendas.reduce((s, v) => s + liquidoVenda(v), 0);
    const custo = dayVendas.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
    return { date: dayStart, dateStr: formatDate(dayStart), vendas: dayVendas, fat, margem: fat > 0 ? ((fat - custo) / fat) * 100 : 0 };
  });

  const activeDayGroups = periodo === 'semana' ? weekDayGroups : monthDayGroups;
  const fatPeriodo = periodo === 'semana' ? fatSemana : fatMes;
  const metaPeriodo = periodo === 'semana' ? metaSemana : metaMes;
  const custoPeriodo = periodo === 'semana' ? custoSemana : custosMes;
  const margemPctPeriodo = fatPeriodo > 0 ? ((fatPeriodo - custoPeriodo) / fatPeriodo) * 100 : 0;

  // Categoria real do produto (em vez de adivinhar pelo nome).
  // Usa o campo categoria do catálogo; cai pra 'Outro' se não achar.
  const categoriaPorId = new Map<string, string>();
  const categoriaPorNome = new Map<string, string>();
  (produtos || []).forEach((p: any) => {
    if (!p?.categoria) return;
    if (p.id) categoriaPorId.set(p.id, p.categoria);
    if (p.nome) categoriaPorNome.set(p.nome, p.categoria);
  });
  const catDe = (v: any) => (v.produto_id && categoriaPorId.get(v.produto_id)) || (v.produto_nome && categoriaPorNome.get(v.produto_nome)) || 'Outro';

  const catBreakdown: Record<string, { total: number; custo: number }> = {};
  (vendas || []).forEach(v => {
    const cat = catDe(v);
    if (!catBreakdown[cat]) catBreakdown[cat] = { total: 0, custo: 0 };
    catBreakdown[cat].total += liquidoVenda(v);
    catBreakdown[cat].custo += v.custo_unit * v.quantidade;
  });
  const catList = Object.entries(catBreakdown).map(([cat, d]) => ({ cat, ...d, margem: d.total > 0 ? ((d.total - d.custo) / d.total) * 100 : 0 })).sort((a, b) => b.total - a.total);

  const catBreakdownMes: Record<string, { total: number; custo: number }> = {};
  allMes.forEach(v => {
    const cat = catDe(v);
    if (!catBreakdownMes[cat]) catBreakdownMes[cat] = { total: 0, custo: 0 };
    catBreakdownMes[cat].total += liquidoVenda(v);
    catBreakdownMes[cat].custo += v.custo_unit * v.quantidade;
  });
  const catListMes = Object.entries(catBreakdownMes).map(([cat, d]) => ({ cat, ...d, margem: d.total > 0 ? ((d.total - d.custo) / d.total) * 100 : 0 })).sort((a, b) => b.total - a.total);
  const activeCatList = periodo === 'semana' ? catList : catListMes;

  // Ticket médio breakdown
  const faixas = [
    { label: '< R$50', min: 0, max: 50 },
    { label: 'R$50–100', min: 50, max: 100 },
    { label: 'R$100–200', min: 100, max: 200 },
    { label: '> R$200', min: 200, max: Infinity },
  ];
  const faixaData = faixas.map(f => ({
    ...f, count: allMes.filter(v => { const t = liquidoVenda(v); return t >= f.min && t < f.max; }).length,
  }));
  const pgtoTicket: Record<string, { total: number; count: number }> = {};
  allMes.forEach(v => {
    const k = v.forma_pgto || 'Outro';
    if (!pgtoTicket[k]) pgtoTicket[k] = { total: 0, count: 0 };
    pgtoTicket[k].total += liquidoVenda(v);
    pgtoTicket[k].count++;
  });
  const vendaMaisAlta = allMes.length ? Math.max(...allMes.map(v => liquidoVenda(v))) : 0;
  const vendaMaisBaixa = allMes.length ? Math.min(...allMes.map(v => liquidoVenda(v))) : 0;

  // Resumo do mês
  // Custos fixos: só os com recorrência "mensal" (Aluguel, luz, salário, etc.)
  const custosFixosMensaisOnly = (custosFixosData || []).filter(c => (c as any).recorrencia === 'mensal');
  const custosFixos = custosFixosMensaisOnly.reduce((s, c) => s + Number(c.valor), 0) || 2000;
  const ebitda = fatMes - custosMes - custosFixos;
  const margemMediaMes = fatMes > 0 ? ((fatMes - custosMes) / fatMes) * 100 : 0;
  const breakEven = margemMediaMes > 0 ? (custosFixos / (margemMediaMes / 100)) : 6450;
  const projecao = diasPassados > 0 ? (fatMes / diasPassados) * 30 : 0;

  // Quebra do mês: gastos do mês por categoria (fixos contam todos; pontuais só os do mês)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const gastosDoMes = (custosFixosData || []).filter(c => {
    const r = (c as any).recorrencia;
    if (r === 'mensal') return true;
    const data = (c as any).data;
    if (!data) return false;
    const d = new Date(data);
    return d >= new Date(monthStart) && d < monthEnd;
  });
  const gastosPorCategoria: Record<string, number> = {};
  gastosDoMes.forEach(c => {
    const cat = (c as any).categoria || 'Custo Fixo';
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Number(c.valor);
  });
  const totalGastosMes = Object.values(gastosPorCategoria).reduce((s, v) => s + v, 0);
  const descontosMes = allMes.reduce((s, v: any) => s + Number(v.desconto_rs || 0), 0);
  const brindesMes = allMes.filter((v: any) => v.brinde && String(v.brinde).trim()).length;
  const fatLiquidoMes = fatMes; // fatMes já é líquido (descontos abatidos)
  const sobraReal = fatLiquidoMes - custosMes - totalGastosMes;
  const proLabore = (configFin?.pro_labore_socio1 || 0) + (configFin?.pro_labore_socio2 || 0);
  const dasMei = configFin?.das_mei_mensal ?? 80.90; // default DAS comércio 2026, mesmo sem tabela
  const resultadoLiquido = sobraReal - proLabore - dasMei;

  // Insights
  const insights: Insight[] = gerarInsights({
    vendas60d: (vendas60d || []) as any,
    produtos: (produtos || []) as any,
    hoje: today,
  });

  // Empty state
  const hasData = (vendas || []).length > 0 || allMes.length > 0;

  // Selected chart day drill-down — use correct dataset based on active period
  const activeChartData = periodo === 'mes' ? chartDataMes : chartData;
  const chartDayData = selectedChartDay !== null ? activeChartData[selectedChartDay] ?? null : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Hero — saudação + toggle de período inline */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{getSaudacao()}</h1>
          <p className="text-sm text-muted-foreground capitalize">{getDataHojeCompleta()}</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 rounded-full p-0.5 backdrop-blur-sm">
          <button onClick={() => setPeriodo('semana')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${periodo === 'semana' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>7 dias</button>
          <button onClick={() => setPeriodo('mes')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${periodo === 'mes' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Mês</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => setOpenSheet('hoje')} className="relative overflow-hidden rounded-2xl p-4 space-y-2 text-left pressable bg-gradient-to-br from-primary to-[hsl(192_85%_32%)] text-primary-foreground shadow-[0_8px_24px_-8px_hsl(192_83%_38%/0.4)]">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-2 text-primary-foreground/80"><TrendingUp size={15} strokeWidth={2.5} /><span className="text-xs font-semibold">Hoje</span></div>
          <p className="relative text-2xl font-bold tabular-nums">{formatCurrency(fatHoje)}</p>
          <p className="relative text-[11px] text-primary-foreground/70">{vendasHoje.length} venda{vendasHoje.length !== 1 ? 's' : ''}</p>
        </button>

        <button onClick={() => setOpenSheet('semana')} className="bg-card rounded-2xl p-4 card-elev space-y-2 text-left pressable">
          <div className="flex items-center gap-2 text-muted-foreground"><Target size={15} strokeWidth={2.2} /><span className="text-xs font-semibold">{periodo === 'semana' ? 'Semana' : 'Mês'}</span></div>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(fatPeriodo)}</p>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((fatPeriodo / metaPeriodo) * 100, 100)}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">Meta {formatCurrency(metaPeriodo)}</p>
        </button>

        <button onClick={() => setOpenSheet('margem')} className="bg-card rounded-2xl p-4 card-elev space-y-2 text-left pressable">
          <div className="flex items-center gap-2 text-muted-foreground"><Percent size={15} strokeWidth={2.2} /><span className="text-xs font-semibold">Margem</span></div>
          <p className={`text-2xl font-bold tabular-nums ${margemColorClass(margemPctPeriodo)}`}>{hasData ? formatPercent(margemPctPeriodo) : '—'}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{hasData ? `${formatCurrency(fatPeriodo - custoPeriodo)} bruto` : 'Sem dados'}</p>
        </button>

        <button onClick={() => setOpenSheet('ticket')} className="bg-card rounded-2xl p-4 card-elev space-y-2 text-left pressable">
          <div className="flex items-center gap-2 text-muted-foreground"><Receipt size={15} strokeWidth={2.2} /><span className="text-xs font-semibold">Ticket</span></div>
          <p className="text-2xl font-bold tabular-nums">{hasData ? formatCurrency(ticketMedio) : '—'}</p>
          <p className="text-[11px] text-muted-foreground">{numVendasMes} venda{numVendasMes !== 1 ? 's' : ''} no mês</p>
        </button>
      </div>

      {/* Recontatos — colapsável (começa minimizado) */}
      {(clientesRecontato || []).length > 0 && (
        <div className="bg-card rounded-2xl card-elev overflow-hidden">
          <button
            onClick={() => setRecontatosOpen(o => !o)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center">
                <MessageCircle size={14} className="text-success" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight">Recontatos pendentes</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">{clientesRecontato!.length}</span>
            </div>
            {recontatosOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>
          {recontatosOpen && (
          <div className="space-y-2 p-4 pt-0">
            {clientesRecontato!.map(c => {
              const dias = diasAtras(c.data_ultima_compra || c.created_at || '');
              const script = getWhatsAppScript(c.nome, c.ultimo_produto_categoria || 'Whey', dias);
              const whatsNum = (c.whatsapp || '').replace(/\D/g, '');
              const whatsNumFull = whatsNum.startsWith('55') ? whatsNum : `55${whatsNum}`;
              const whatsUrl = `https://wa.me/${whatsNumFull}?text=${encodeURIComponent(script)}`;
              return (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">há {dias} dias sem compra</p>
                  </div>
                  <a href={whatsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-9 h-9 rounded-full bg-success flex items-center justify-center pressable shadow-[0_4px_12px_-2px_hsl(158_64%_42%/0.4)]">
                    <MessageCircle size={15} className="text-success-foreground" />
                  </a>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Chart — clickable bars */}
      <div className="bg-card rounded-2xl p-4 card-elev">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-tight">Faturamento <span className="text-muted-foreground font-normal">— {periodo === 'semana' ? 'últimos 7 dias' : 'mês atual'}</span></h3>
          <BarChart3 size={15} className="text-muted-foreground" />
        </div>
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activeChartData} onClick={(e) => {
              if (e && e.activeTooltipIndex !== undefined) {
                setSelectedChartDay(e.activeTooltipIndex);
                setOpenSheet('chartDay');
              }
            }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(185 73% 47%)" />
                  <stop offset="100%" stopColor="hsl(192 83% 38%)" />
                </linearGradient>
              </defs>
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(220 9% 46%)' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} width={50} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Faturamento']}
                contentStyle={{
                  borderRadius: 12,
                  border: '0.5px solid hsl(var(--border))',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  fontSize: 12,
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--card-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                itemStyle={{ color: 'hsl(var(--card-foreground))' }}
                cursor={{ fill: 'hsl(var(--muted))', radius: 6 }}
              />
              <Bar dataKey="valor" radius={[8, 8, 0, 0]} className="cursor-pointer" fill="url(#barGrad)">
                {chartData.map((_, i) => (
                  <Cell key={i} fill="url(#barGrad)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Registre vendas para ver o gráfico</p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Toque numa barra para ver o detalhe</p>
      </div>

      {/* Top 5 produtos do mês */}
      <div className="bg-card rounded-2xl p-4 card-elev">
        <h3 className="text-sm font-semibold tracking-tight mb-3">Top produtos do mês</h3>
        {top5.length > 0 ? (
          <div className="space-y-1.5">
            {top5.map((p, i) => {
              const m = p.total > 0 ? ((p.total - p.custo) / p.total) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold tabular-nums">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{p.qtd} un · {formatPercent(m)} margem</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0">{formatCurrency(p.total)}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda este mês</p>
        )}
      </div>


      {/* Insights inteligentes — colapsável + expansível */}
      {hasData && (() => {
        const alertasCount = insights.filter(i => i.tipo === 'alerta' || i.tipo === 'oportunidade').length;
        const visibleCount = insightsExpanded ? insights.length : 3;
        const visible = insights.slice(0, visibleCount);
        const hidden = insights.length - visible.length;
        return (
          <div className="bg-card rounded-2xl card-elev overflow-hidden">
            <button
              onClick={() => setInsightsMinimized(m => !m)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center">
                  <Lightbulb size={14} className="text-warning" />
                </div>
                <h3 className="text-sm font-semibold tracking-tight">Insights</h3>
                {alertasCount > 0 && !insightsMinimized && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground font-bold">{alertasCount}</span>
                )}
                {insightsMinimized && (
                  <span className="text-xs text-muted-foreground">
                    {alertasCount > 0 ? `${alertasCount} alerta${alertasCount > 1 ? 's' : ''}` : 'tudo ok'}
                  </span>
                )}
              </div>
              {insightsMinimized ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronUp size={16} className="text-muted-foreground" />}
            </button>
            {!insightsMinimized && (
              <div className="p-3 pt-0 space-y-2">
                {visible.map((ins, i) => {
                  const Icon = ins.tipo === 'alerta' ? AlertTriangle
                    : ins.tipo === 'oportunidade' ? TrendingDown
                    : ins.tipo === 'positivo' ? Sparkles
                    : Info;
                  const bg = ins.tipo === 'alerta' ? 'bg-destructive/5 border-destructive/20'
                    : ins.tipo === 'oportunidade' ? 'bg-warning/5 border-warning/20'
                    : ins.tipo === 'positivo' ? 'bg-success/5 border-success/20'
                    : 'bg-muted/30 border-muted';
                  const iconColor = ins.tipo === 'alerta' ? 'text-destructive'
                    : ins.tipo === 'oportunidade' ? 'text-warning'
                    : ins.tipo === 'positivo' ? 'text-success'
                    : 'text-muted-foreground';
                  return (
                    <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${bg}`}>
                      <Icon size={14} className={`shrink-0 mt-0.5 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{ins.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{ins.descricao}</p>
                        {ins.acao && <p className="text-[11px] mt-1 font-medium text-secondary">→ {ins.acao}</p>}
                      </div>
                    </div>
                  );
                })}
                {hidden > 0 && (
                  <button onClick={() => setInsightsExpanded(true)} className="w-full py-2 text-xs font-medium text-primary hover:underline">
                    Ver todos os {insights.length} insights ({hidden} oculto{hidden > 1 ? 's' : ''})
                  </button>
                )}
                {insightsExpanded && insights.length > 3 && (
                  <button onClick={() => setInsightsExpanded(false)} className="w-full py-2 text-xs font-medium text-muted-foreground hover:underline">
                    Recolher
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Gastos do mês — cards por categoria */}
      {hasData && (
        <div className="bg-card rounded-2xl p-4 card-elev space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Gastos do mês</h3>
            <Link to="/configuracoes" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              <Plus size={12} /> Adicionar
            </Link>
          </div>
          {(() => {
            const CATS = [
              { key: 'Custo Fixo', icon: Home, color: 'text-secondary', bg: 'bg-secondary/10' },
              { key: 'Marketing', icon: Megaphone, color: 'text-primary', bg: 'bg-primary/10' },
              { key: 'Anúncios', icon: BarChart3, color: 'text-warning', bg: 'bg-warning/10' },
              { key: 'Investimento', icon: Building2, color: 'text-success', bg: 'bg-success/10' },
              { key: 'Parceria', icon: Handshake, color: 'text-accent-foreground', bg: 'bg-accent/40' },
              { key: 'Outros', icon: MoreHorizontal, color: 'text-muted-foreground', bg: 'bg-muted' },
            ];
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CATS.map(({ key, icon: Icon, color, bg }) => {
                  const valor = gastosPorCategoria[key] || 0;
                  const count = gastosDoMes.filter(g => ((g as any).categoria || 'Custo Fixo') === key).length;
                  const pct = fatMes > 0 ? (valor / fatMes) * 100 : 0;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (valor > 0) {
                          setSelectedGastoCategoria(key);
                          setOpenSheet('gastoCategoria');
                        }
                      }}
                      disabled={valor === 0}
                      className={`text-left p-3 rounded-lg border ${valor > 0 ? 'hover:bg-muted/30 cursor-pointer' : 'opacity-50 cursor-default'} transition-colors`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                          <Icon size={14} className={color} />
                        </div>
                        {valor > 0 && fatMes > 0 && (
                          <span className="text-[10px] text-muted-foreground font-medium">{pct.toFixed(0)}%</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{key}</p>
                      <p className="text-sm font-bold text-destructive">{formatCurrency(valor)}</p>
                      <p className="text-[10px] text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</p>
                    </button>
                  );
                })}
              </div>
            );
          })()}
          <div className="flex items-center justify-between pt-2 border-t text-xs">
            <span className="font-medium">Total gasto no mês</span>
            <span className="font-bold text-destructive">{formatCurrency(totalGastosMes)}</span>
          </div>
        </div>
      )}

      {/* Resultado do mês — estilo extrato (linha por linha) */}
      {hasData && (
        <div className="bg-card rounded-2xl p-4 card-elev space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Resultado do mês</h3>
            <button onClick={() => setOpenSheet('quebra')} className="text-xs text-primary hover:underline">Detalhes</button>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Faturamento</span>
              <span className="font-medium">{formatCurrency(fatBrutoMes)}</span>
            </div>
            {descontosMes > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">− Descontos concedidos</span>
                <span className="font-medium text-destructive">−{formatCurrency(descontosMes)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">− Custo dos produtos (CMV)</span>
              <span className="font-medium text-destructive">−{formatCurrency(custosMes)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t">
              <span className="font-medium">= Lucro bruto</span>
              <span className={`font-bold ${margemMediaMes >= 30 ? 'text-success' : margemMediaMes >= 20 ? 'text-warning' : 'text-destructive'}`}>
                {formatCurrency(fatLiquidoMes - custosMes)} <span className="text-xs font-normal">({formatPercent(fatLiquidoMes > 0 ? ((fatLiquidoMes - custosMes) / fatLiquidoMes) * 100 : 0)})</span>
              </span>
            </div>
            {Object.entries(gastosPorCategoria).map(([cat, v]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-muted-foreground">− {cat}</span>
                <span className="font-medium text-destructive">−{formatCurrency(v)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1.5 border-t">
              <span className="font-medium">= EBITDA <span className="text-[10px] text-muted-foreground">(resultado operacional)</span></span>
              <span className={`font-bold ${sobraReal >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(sobraReal)}
              </span>
            </div>
            {proLabore > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">− Pró-labore (sócios)</span>
                <span className="font-medium text-destructive">−{formatCurrency(proLabore)}</span>
              </div>
            )}
            {dasMei > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">− DAS MEI</span>
                <span className="font-medium text-destructive">−{formatCurrency(dasMei)}</span>
              </div>
            )}
            <div className={`flex items-center justify-between pt-2 border-t-2 mt-1 -mx-4 px-4 py-2 ${resultadoLiquido >= 0 ? 'bg-success/5' : 'bg-destructive/5'}`}>
              <span className="font-bold text-base">= Lucro líquido</span>
              <span className={`font-bold text-base ${resultadoLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(resultadoLiquido)}
              </span>
            </div>
          </div>
          {(descontosMes > 0 || brindesMes > 0) && (
            <p className="text-[10px] text-muted-foreground pt-1">
              💸 Este mês: {descontosMes > 0 && `${formatCurrency(descontosMes)} em descontos`}
              {descontosMes > 0 && brindesMes > 0 && ' · '}
              {brindesMes > 0 && `${brindesMes} brinde${brindesMes !== 1 ? 's' : ''} dado${brindesMes !== 1 ? 's' : ''}`}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground pt-1">
            {proLabore === 0 ? (
              <>Pró-labore não cadastrado — o lucro líquido fica fictício. <Link to="/configuracoes" className="text-primary underline">Configurar</Link> para ver o número real.</>
            ) : (
              <>Lucro líquido é o que sobra depois de tudo: pró-labore, impostos. Análise completa em <Link to="/cfo" className="text-primary underline">CFO Peak</Link>.</>
            )}
          </p>
        </div>
      )}

      {/* Resumo do mês — clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button onClick={() => setOpenSheet('ebitda')} className="bg-card rounded-2xl p-4 card-elev space-y-1 text-left pressable">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-semibold">EBITDA estimado</p>
            <Info size={12} className="text-muted-foreground" />
          </div>
          <p className={`text-xl font-bold tabular-nums ${ebitda >= 0 ? 'text-success' : 'text-destructive'}`}>{hasData ? formatCurrency(ebitda) : '—'}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">Custos fixos: {formatCurrency(custosFixos)}/mês</p>
        </button>
        <button onClick={() => setOpenSheet('breakeven')} className="bg-card rounded-2xl p-4 card-elev space-y-2 text-left pressable">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-semibold">Break-even</p>
            <Info size={12} className="text-muted-foreground" />
          </div>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(fatMes)} <span className="text-xs font-normal text-muted-foreground">/ {formatCurrency(breakEven)}</span></p>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${fatMes >= breakEven ? 'bg-success' : 'bg-primary'}`} style={{ width: `${Math.min((fatMes / breakEven) * 100, 100)}%` }} />
          </div>
        </button>
        <button onClick={() => setOpenSheet('projecao')} className="bg-card rounded-2xl p-4 card-elev space-y-1 text-left pressable">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-semibold">Projeção do mês</p>
            <Info size={12} className="text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-primary tabular-nums">{hasData ? formatCurrency(projecao) : '—'}</p>
          <p className="text-[10px] text-muted-foreground">Baseado no ritmo atual</p>
        </button>
      </div>

      {/* === SHEETS === */}

      {/* Faturamento hoje */}
      <Sheet open={openSheet === 'hoje'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Vendas de hoje</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            {vendasHoje.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma venda registrada hoje.</p>}
            {vendasHoje.map(v => (
              <div key={v.id} className="border-b pb-3 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{v.produto_nome}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(v.created_at!)} · {v.quantidade}× {formatCurrency(v.preco_venda)}</p>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(liquidoVenda(v))}</p>
                  <button onClick={() => setEditVenda(v as any)} className="p-1 rounded hover:bg-muted" title="Editar venda">
                    <Pencil size={12} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="flex gap-2">
                  {v.forma_pgto && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{v.forma_pgto}</span>}
                  {v.canal && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{v.canal}</span>}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">+{formatCurrency((v.preco_venda - v.custo_unit) * v.quantidade)}</span>
                </div>
              </div>
            ))}
            {vendasHoje.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm font-bold">Total: {formatCurrency(fatHoje)}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Fat. semana/mês */}
      <Sheet open={openSheet === 'semana'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{periodo === 'semana' ? 'Faturamento da semana' : 'Faturamento do mês'}</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4">
            {activeDayGroups.map((dg, i) => (
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
                      <div key={v.id} className="flex items-center gap-2 text-xs pt-2">
                        <span className="flex-1 min-w-0 truncate">{formatTime(v.created_at!)} · {v.produto_nome}</span>
                        <span className="font-medium">{formatCurrency(liquidoVenda(v))}</span>
                        <button onClick={() => setEditVenda(v as any)} className="p-1 rounded hover:bg-card" title="Editar">
                          <Pencil size={11} className="text-muted-foreground" />
                        </button>
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
          <div className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Como é calculada</p>
              <p className="text-xs">Margem bruta = (Preço de venda − Custo unitário) ÷ Preço de venda × 100</p>
              <p className="text-xs text-muted-foreground">Considera todas as vendas {periodo === 'semana' ? 'dos últimos 7 dias' : 'do mês atual'}.</p>
            </div>
            {activeCatList.length === 0 && <p className="text-sm text-muted-foreground">Sem dados de vendas.</p>}
            {activeCatList.map(c => (
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
            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Como é calculado</p>
              <p className="text-xs">Ticket médio = Faturamento do mês ÷ Número de vendas</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(fatMes)} ÷ {numVendasMes} = {formatCurrency(ticketMedio)}</p>
            </div>
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

      {/* Chart day drill-down */}
      <Sheet open={openSheet === 'chartDay'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{chartDayData ? `${chartDayData.dateStr} (${chartDayData.dia})` : 'Detalhes do dia'}</SheetTitle></SheetHeader>
          {chartDayData && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-muted/50 rounded-xl text-center">
                  <p className="text-[10px] text-muted-foreground">Faturamento</p>
                  <p className="text-sm font-bold">{formatCurrency(chartDayData.valor)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl text-center">
                  <p className="text-[10px] text-muted-foreground">Ticket médio</p>
                  <p className="text-sm font-bold">{formatCurrency(chartDayData.ticket)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl text-center">
                  <p className="text-[10px] text-muted-foreground">Vendas</p>
                  <p className="text-sm font-bold">{chartDayData.numVendas}</p>
                </div>
              </div>
              {chartDayData.topProds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Top produtos do dia</p>
                  {chartDayData.topProds.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2 border rounded-lg">
                      <span className="text-xs font-medium">{i + 1}º {p.nome}</span>
                      <span className="text-xs font-bold">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Vendas do dia</p>
                {chartDayData.vendas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma venda neste dia.</p>}
                {chartDayData.vendas.map(v => (
                  <div key={v.id} className="flex items-center gap-2 p-2 border-b text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{v.produto_nome}</p>
                      <p className="text-muted-foreground">{formatTime(v.created_at!)} · {v.quantidade}× {formatCurrency(v.preco_venda)}</p>
                    </div>
                    <p className="font-bold">{formatCurrency(liquidoVenda(v))}</p>
                    <button onClick={() => setEditVenda(v as any)} className="p-1 rounded hover:bg-muted" title="Editar">
                      <Pencil size={11} className="text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* EBITDA detail */}
      <Sheet open={openSheet === 'ebitda'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>EBITDA estimado</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-secondary">Fórmula</p>
              <p className="text-sm">EBITDA = Faturamento − Custo dos Produtos − Custos Fixos</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Faturamento do mês</span>
                <span className="text-sm font-bold">{formatCurrency(fatMes)}</span>
              </div>
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Custo dos produtos vendidos</span>
                <span className="text-sm font-bold text-destructive">−{formatCurrency(custosMes)}</span>
              </div>
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Custos fixos (total)</span>
                <span className="text-sm font-bold text-destructive">−{formatCurrency(custosFixos)}</span>
              </div>
              {(custosFixosData || []).length > 0 && (
                <div className="ml-3 space-y-1">
                  {custosFixosData!.map(c => (
                    <div key={c.id} className="flex justify-between px-3 py-1.5 text-xs text-muted-foreground">
                      <span>{c.nome}</span>
                      <span>−{formatCurrency(Number(c.valor))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between p-3 bg-muted/50 rounded-xl">
                <span className="text-sm font-semibold">EBITDA</span>
                <span className={`text-sm font-bold ${ebitda >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(ebitda)}</span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground"><strong>Premissas:</strong> Custos fixos de {formatCurrency(custosFixos)}/mês conforme cadastrado em Configurações. Edite os custos fixos para refletir a realidade.</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Break-even detail */}
      <Sheet open={openSheet === 'breakeven'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Break-even</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-secondary">Fórmula</p>
              <p className="text-sm">Break-even = Custos Fixos ÷ Margem Bruta %</p>
              <p className="text-xs text-muted-foreground">Faturamento mínimo necessário para cobrir todos os custos.</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Custos fixos</span>
                <span className="text-sm font-bold">{formatCurrency(custosFixos)}</span>
              </div>
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Margem bruta média</span>
                <span className={`text-sm font-bold ${margemColorClass(margemMediaMes)}`}>{formatPercent(margemMediaMes)}</span>
              </div>
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Break-even estimado</span>
                <span className="text-sm font-bold">{formatCurrency(breakEven)}</span>
              </div>
              <div className="flex justify-between p-3 bg-muted/50 rounded-xl">
                <span className="text-sm font-semibold">Progresso</span>
                <span className={`text-sm font-bold ${fatMes >= breakEven ? 'text-success' : 'text-warning'}`}>{formatPercent((fatMes / breakEven) * 100)}</span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div className={`h-3 rounded-full transition-all ${fatMes >= breakEven ? 'bg-success' : 'bg-primary'}`} style={{ width: `${Math.min((fatMes / breakEven) * 100, 100)}%` }} />
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground"><strong>O que fazer:</strong> {fatMes >= breakEven ? 'Você já atingiu o break-even! Todo faturamento adicional é lucro líquido.' : `Faltam ${formatCurrency(breakEven - fatMes)} para atingir o ponto de equilíbrio.`}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Gasto por categoria — drill-down */}
      <Sheet open={openSheet === 'gastoCategoria'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{selectedGastoCategoria}</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            {selectedGastoCategoria && (() => {
              const items = gastosDoMes.filter(g => ((g as any).categoria || 'Custo Fixo') === selectedGastoCategoria);
              const total = items.reduce((s, g) => s + Number(g.valor), 0);
              return (
                <>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Total no mês</p>
                    <p className="text-2xl font-bold text-destructive">{formatCurrency(total)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {items.length} item{items.length !== 1 ? 's' : ''}
                      {fatMes > 0 && ` · ${((total / fatMes) * 100).toFixed(1)}% do faturamento`}
                    </p>
                  </div>
                  <div className="divide-y border rounded-xl overflow-hidden">
                    {items.map(g => (
                      <div key={g.id} className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{g.nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(g as any).recorrencia === 'mensal'
                                ? 'Recorrente mensal'
                                : (g as any).data ? formatDate(new Date((g as any).data)) : 'Único'}
                              {(g as any).descricao && ` · ${(g as any).descricao}`}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-destructive whitespace-nowrap">−{formatCurrency(Number(g.valor))}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link to="/configuracoes" className="block text-center py-2 text-xs font-medium text-primary hover:underline">
                    Gerenciar gastos em Configurações →
                  </Link>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Quebra do mês detail */}
      <Sheet open={openSheet === 'quebra'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Quebra do mês — pra onde foi o dinheiro</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-secondary">Como ler</p>
              <p className="text-xs">Faturamento − Custo dos produtos vendidos (CMV) − Todos os gastos do mês = Sobra real (o que sobrou no caixa).</p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between p-3 border rounded-xl bg-primary/5">
                <span className="text-sm font-semibold">Faturamento do mês</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(fatMes)}</span>
              </div>
              <div className="flex justify-between p-3 border rounded-xl">
                <div>
                  <span className="text-sm">Custo dos produtos vendidos (CMV)</span>
                  <p className="text-[10px] text-muted-foreground">O que você pagou pelos produtos que saíram</p>
                </div>
                <span className="text-sm font-bold text-destructive">−{formatCurrency(custosMes)}</span>
              </div>

              <div className="pt-2 pb-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gastos do mês por categoria</p>
              </div>

              {Object.keys(gastosPorCategoria).length === 0 && (
                <div className="p-3 text-xs text-muted-foreground text-center border rounded-xl">
                  Nenhum gasto cadastrado para este mês. Vá em Configurações → registrar gastos (marketing, anúncios, etc.).
                </div>
              )}

              {Object.entries(gastosPorCategoria).map(([cat, v]) => {
                const detalhes = gastosDoMes.filter(g => ((g as any).categoria || 'Custo Fixo') === cat);
                return (
                  <div key={cat} className="border rounded-xl overflow-hidden">
                    <div className="flex justify-between p-3 bg-muted/20">
                      <span className="text-sm font-medium">{cat}</span>
                      <span className="text-sm font-bold text-destructive">−{formatCurrency(v)}</span>
                    </div>
                    <div className="divide-y bg-card">
                      {detalhes.map(d => (
                        <div key={d.id} className="flex justify-between px-3 py-1.5 text-xs">
                          <span className="text-muted-foreground">
                            {d.nome}
                            {(d as any).recorrencia === 'unica' && (d as any).data && (
                              <span className="text-[10px] ml-1.5">· {formatDate(new Date((d as any).data))}</span>
                            )}
                          </span>
                          <span className="text-muted-foreground">−{formatCurrency(Number(d.valor))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-between p-3 border rounded-xl mt-2 bg-muted/30">
                <span className="text-sm font-semibold">= EBITDA (resultado operacional)</span>
                <span className={`text-sm font-bold ${sobraReal >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(sobraReal)}</span>
              </div>

              {(proLabore > 0 || dasMei > 0) && (
                <>
                  <div className="pt-2 pb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saídas societárias e tributárias</p>
                  </div>
                  {proLabore > 0 && (
                    <div className="flex justify-between p-3 border rounded-xl">
                      <span className="text-sm">Pró-labore (sócios)</span>
                      <span className="text-sm font-bold text-destructive">−{formatCurrency(proLabore)}</span>
                    </div>
                  )}
                  {dasMei > 0 && (
                    <div className="flex justify-between p-3 border rounded-xl">
                      <span className="text-sm">DAS MEI</span>
                      <span className="text-sm font-bold text-destructive">−{formatCurrency(dasMei)}</span>
                    </div>
                  )}
                </>
              )}

              <div className={`flex justify-between p-3 rounded-xl mt-2 ${resultadoLiquido >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <span className="text-sm font-bold">= Lucro líquido</span>
                <span className={`text-base font-bold ${resultadoLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(resultadoLiquido)}</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-xl p-3 space-y-1">
              <p className="text-xs"><strong>EBITDA</strong> é o resultado operacional — antes de pró-labore e impostos.</p>
              <p className="text-xs"><strong>Lucro líquido</strong> é o que você efetivamente ganhou no mês, depois de pagar todo mundo (sócios + Receita).</p>
              <p className="text-[11px] text-muted-foreground pt-1">{proLabore === 0 ? <>Cadastre o pró-labore em <Link to="/configuracoes" className="text-primary underline">Configurações → Financeiro</Link> para o lucro líquido refletir a realidade.</> : <>Análise completa, ROAS e histórico em <Link to="/cfo" className="text-primary underline">CFO Peak</Link>.</>}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Projeção detail */}
      <Sheet open={openSheet === 'projecao'} onOpenChange={o => !o && setOpenSheet(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Projeção do mês</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-secondary">Fórmula</p>
              <p className="text-sm">Projeção = (Faturamento até hoje ÷ Dias passados) × 30</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Faturamento até hoje</span>
                <span className="text-sm font-bold">{formatCurrency(fatMes)}</span>
              </div>
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Dias passados no mês</span>
                <span className="text-sm font-bold">{diasPassados}</span>
              </div>
              <div className="flex justify-between p-3 border rounded-xl">
                <span className="text-sm">Média diária</span>
                <span className="text-sm font-bold">{formatCurrency(diasPassados > 0 ? fatMes / diasPassados : 0)}</span>
              </div>
              <div className="flex justify-between p-3 bg-primary/10 rounded-xl">
                <span className="text-sm font-semibold">Projeção (30 dias)</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(projecao)}</span>
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground"><strong>Premissa:</strong> Assume ritmo constante de vendas. Finais de semana e sazonalidade podem alterar o resultado real.</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {editVenda && <EditVendaModal venda={editVenda} onClose={() => setEditVenda(null)} />}
    </div>
  );
}
