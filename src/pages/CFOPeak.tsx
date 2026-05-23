import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/format";
import { calcularDRE, historicoMensal, tendencia, calcularROAS, statusTetoMEI, calcularRunway, type ConfigFinanceira } from "@/lib/cfo";
import { gerarRecomendacoes, type Recomendacao } from "@/lib/cfo-recomenda";
import { useConfigFinanceira } from "@/lib/configFinanceira";
import { useCanais } from "@/lib/canaisStore";
import { Briefcase, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronRight, Settings, FileText, Sparkles, Info, Shield, Target, Wallet, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function CFOPeak() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  // ====== Queries ======
  // Vendas do ano inteiro — usadas tanto para histórico mensal quanto para teto MEI
  // (loja iniciou em 2026, então 12 meses cobre todo o histórico relevante)
  void sixMonthsAgo;
  const { data: vendasAno, isLoading: loadingVendas } = useQuery({
    queryKey: ["cfo-vendas-ano"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("*").gte("created_at", yearStart.toISOString());
      return data || [];
    },
  });
  // Primeira venda registrada — define quando a loja começou
  const { data: primeiraVenda } = useQuery({
    queryKey: ["cfo-primeira-venda"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("created_at").order("created_at", { ascending: true }).limit(1);
      return data?.[0]?.created_at ? new Date(data[0].created_at) : null;
    },
  });
  // Alias para compatibilidade com código abaixo
  const vendas6m = vendasAno;
  const { data: gastos } = useQuery({
    queryKey: ["cfo-gastos"],
    queryFn: async () => {
      const { data } = await supabase.from("custos_fixos").select("*");
      return data || [];
    },
  });
  const { data: produtos } = useQuery({
    queryKey: ["cfo-produtos"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*");
      return data || [];
    },
  });
  // Canais via hook unificado com fallback localStorage
  const { data: canaisResult } = useCanais(true);
  const canais = canaisResult?.canais || [];
  // Config financeira via hook unificado com fallback localStorage automático
  const { data: configResult } = useConfigFinanceira();
  const usandoLocalStorage = configResult?.origem === 'local' || canaisResult?.origem === 'local';

  // ====== Derivados ======
  const cfg: ConfigFinanceira = useMemo(() => configResult?.config ?? {
    pro_labore_socio1: 0,
    pro_labore_socio2: 0,
    das_mei_mensal: 80.90,
    teto_mei_anual: 81000,
    reserva_caixa: 0,
    meta_lucro_mensal: 0,
    nome_socio1: 'Você',
    nome_socio2: 'Sócio',
  }, [configResult]);

  const vendasMes = useMemo(
    () => (vendas6m || []).filter(v => v.created_at && new Date(v.created_at) >= monthStart),
    [vendas6m, monthStart]
  );
  const gastosMes = useMemo(() => {
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return (gastos || []).filter(g => {
      if (g.recorrencia === 'mensal') return true;
      if (g.data) {
        const d = new Date(g.data);
        return d >= monthStart && d < monthEnd;
      }
      return false;
    });
  }, [gastos, monthStart, today]);

  const dre = useMemo(() => calcularDRE({
    vendasMes: vendasMes as any,
    gastosMes: gastosMes as any,
    config: cfg,
  }), [vendasMes, gastosMes, cfg]);

  const dataAbertura = useMemo(() => {
    if (cfg.data_abertura_loja) return new Date(cfg.data_abertura_loja + 'T12:00:00');
    return primeiraVenda;
  }, [cfg.data_abertura_loja, primeiraVenda]);

  const historico = useMemo(() => historicoMensal({
    vendas: (vendas6m || []) as any,
    gastos: (gastos || []) as any,
    desdeInicio: dataAbertura,
    hoje: today,
  }), [vendas6m, gastos, today, dataAbertura]);

  const tendenciaReceita = useMemo(() => tendencia(historico.map(h => h.receita)), [historico]);
  const tendenciaEbitda = useMemo(() => tendencia(historico.map(h => h.ebitda)), [historico]);

  const roas = useMemo(() => calcularROAS({
    vendasMes: vendasMes as any,
    gastosMes: gastosMes as any,
    canais: (canais || []) as any,
  }), [vendasMes, gastosMes, canais]);

  const tetoMEI = useMemo(() => statusTetoMEI({
    vendasAnoCorrente: (vendasAno || []) as any,
    teto: cfg.teto_mei_anual,
    hoje: today,
  }), [vendasAno, cfg.teto_mei_anual, today]);

  const custoFixoMensal = useMemo(
    () => (gastos || []).filter(g => g.recorrencia === 'mensal').reduce((s, g) => s + Number(g.valor), 0),
    [gastos]
  );

  // Produtos para sinais
  const produtosSinais = useMemo(() => {
    if (!produtos || !vendas6m) return { bombando: [], parados: [], ruptura: [] };
    const last7 = new Date(today.getTime() - 7 * 86400000);
    const last14 = new Date(today.getTime() - 14 * 86400000);
    const last30 = new Date(today.getTime() - 30 * 86400000);
    const vendas7 = (vendas6m || []).filter(v => v.created_at && new Date(v.created_at) >= last7);
    const vendas14 = (vendas6m || []).filter(v => v.created_at && new Date(v.created_at) >= last14);
    const vendas30 = (vendas6m || []).filter(v => v.created_at && new Date(v.created_at) >= last30);

    const qtd7Map: Record<string, number> = {};
    vendas7.forEach(v => { const n = v.produto_nome || ''; qtd7Map[n] = (qtd7Map[n] || 0) + v.quantidade; });
    const bombando = Object.entries(qtd7Map)
      .filter(([, q]) => q >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, qtd]) => ({ nome, qtd }));

    const vendidos30 = new Set([
      ...vendas30.map(v => v.produto_id).filter(Boolean),
      ...vendas30.map(v => v.produto_nome).filter(Boolean),
    ]);
    const parados = (produtos || [])
      .filter(p => (p.qtd_atual ?? 0) > 0 && !vendidos30.has(p.id) && !vendidos30.has(p.nome))
      .map(p => ({ nome: p.nome, valor: (p.qtd_atual ?? 0) * (p.custo_unit ?? 0) }));

    const ruptura = (produtos || [])
      .filter(p => (p.qtd_atual ?? 0) === 0 && vendas14.some(v => v.produto_id === p.id || v.produto_nome === p.nome))
      .map(p => ({ nome: p.nome }));

    return { bombando, parados, ruptura };
  }, [produtos, vendas6m, today]);

  const recomendacoes: Recomendacao[] = useMemo(() => {
    if (!dre) return [];
    return gerarRecomendacoes({
      dre,
      custoFixoMensal,
      reservaCaixa: cfg.reserva_caixa,
      faturamento3mMedia: historico.slice(-3).reduce((s, h) => s + h.receita, 0) / 3,
      faturamentoTendencia: tendenciaReceita,
      roasCanais: roas,
      tetoMEI,
      produtosBombando: produtosSinais.bombando,
      produtosParados: produtosSinais.parados,
      produtosRuptura: produtosSinais.ruptura,
    });
  }, [dre, custoFixoMensal, cfg.reserva_caixa, historico, tendenciaReceita, roas, tetoMEI, produtosSinais]);

  if (loadingVendas) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  // ====== Diagnóstico — 4 cards de status ======
  // Runway: se zerar venda hoje, quantos meses a reserva cobre o custo fixo?
  const runway = calcularRunway(cfg.reserva_caixa, custoFixoMensal);
  const diagnostico = [
    {
      label: 'Resultado',
      valor: dre.resultadoLiquido >= 0 ? formatCurrency(dre.resultadoLiquido) : formatCurrency(dre.resultadoLiquido),
      sub: dre.resultadoLiquido >= 0 ? 'Lucro líquido do mês' : 'Prejuízo no mês',
      status: dre.resultadoLiquido >= 0 ? 'ok' : 'critico',
      icon: Wallet,
    },
    {
      label: 'Margem bruta',
      valor: formatPercent(dre.margemBrutaPct),
      sub: dre.margemBrutaPct >= 35 ? 'Acima do benchmark' : dre.margemBrutaPct >= 25 ? 'Abaixo do benchmark' : 'Crítica',
      status: dre.margemBrutaPct >= 35 ? 'ok' : dre.margemBrutaPct >= 25 ? 'atencao' : 'critico',
      icon: Target,
    },
    {
      label: 'Reserva',
      valor: runway === Infinity ? '∞' : `${runway.toFixed(1)} meses`,
      sub: cfg.reserva_caixa > 0 ? formatCurrency(cfg.reserva_caixa) : 'Não cadastrada',
      status: runway >= 3 ? 'ok' : runway >= 1 ? 'atencao' : 'critico',
      icon: Shield,
    },
    {
      label: 'Teto MEI',
      valor: formatPercent(tetoMEI.pctUsado),
      sub: `${formatCurrency(tetoMEI.faturamentoAno)} de ${formatCurrency(tetoMEI.teto)}`,
      status: tetoMEI.status === 'ok' ? 'ok' : tetoMEI.status === 'atencao' ? 'atencao' : tetoMEI.status === 'risco' ? 'atencao' : 'critico',
      icon: Building2,
    },
  ];

  const statusColor = (s: string) => s === 'ok' ? 'text-success' : s === 'atencao' ? 'text-warning' : 'text-destructive';
  const statusBg = (s: string) => s === 'ok' ? 'bg-success/10' : s === 'atencao' ? 'bg-warning/10' : 'bg-destructive/10';

  const tendIcon = (t: string) => t === 'subindo' ? <TrendingUp size={14} className="text-success" /> : t === 'caindo' ? <TrendingDown size={14} className="text-destructive" /> : <Minus size={14} className="text-muted-foreground" />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_4px_12px_-2px_hsl(192_83%_38%/0.4)]">
              <Briefcase size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">CFO Peak</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Visão executiva — {meses[today.getMonth()]}/{String(today.getFullYear()).slice(2)}</p>
        </div>
        <Link to="/configuracoes" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <Settings size={14} /> Configurar pró-labore, reserva, canais
        </Link>
      </div>

      {/* Modo offline (localStorage) */}
      {usandoLocalStorage && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
          <Info size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-warning">Modo offline — config salva neste navegador</p>
            <p className="text-muted-foreground">A tabela <code className="bg-muted px-1 rounded">config_financeira</code> ainda não existe no Supabase. Tudo funciona normalmente, mas os dados ficam só neste navegador até a tabela ser criada. Sincronização automática quando ela existir.</p>
          </div>
        </div>
      )}

      {/* Avisos de configuração faltando */}
      {!usandoLocalStorage && (cfg.pro_labore_socio1 === 0 && cfg.pro_labore_socio2 === 0) && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
          <Info size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-warning">Pró-labore não cadastrado</p>
            <p className="text-muted-foreground">Sem isso, o resultado líquido fica fictício. <Link to="/configuracoes" className="text-primary underline">Configurar agora</Link></p>
          </div>
        </div>
      )}

      {/* Diagnóstico — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {diagnostico.map(d => (
          <div key={d.label} className={`rounded-2xl p-3.5 ${statusBg(d.status)} card-elev`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${d.status === 'ok' ? 'bg-success/15' : d.status === 'atencao' ? 'bg-warning/15' : 'bg-destructive/15'}`}>
                <d.icon size={14} className={statusColor(d.status)} strokeWidth={2.5} />
              </div>
              <span className={`w-2 h-2 rounded-full ${d.status === 'ok' ? 'bg-success shadow-[0_0_6px_hsl(158_64%_42%/0.6)]' : d.status === 'atencao' ? 'bg-warning' : 'bg-destructive animate-pulse'}`} />
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold">{d.label}</p>
            <p className={`text-lg font-bold tabular-nums ${statusColor(d.status)}`}>{d.valor}</p>
            <p className="text-[10px] text-muted-foreground truncate">{d.sub}</p>
          </div>
        ))}
      </div>

      {/* Recomendações (a estrela) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-secondary">Recomendação do CFO</h2>
        </div>
        {recomendacoes.length === 0 ? (
          <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground">Sem dados suficientes ainda. Registre vendas e gastos.</div>
        ) : (
          recomendacoes.map((rec, i) => (
            <RecomendacaoCard key={i} rec={rec} index={i + 1} />
          ))
        )}
      </div>

      {/* DRE Mensal */}
      <div className="bg-card rounded-2xl card-elev overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-secondary" />
            <h2 className="text-sm font-semibold text-secondary">DRE Mensal</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">{meses[today.getMonth()]}/{String(today.getFullYear()).slice(2)}</span>
        </div>
        <div className="p-4 space-y-1 text-sm">
          <DRELinha label="(+) Receita Bruta" valor={dre.receitaBruta} bold />
          {dre.descontos > 0 && (
            <DRELinha label="(−) Descontos concedidos" valor={-dre.descontos} neg small />
          )}
          {dre.descontos > 0 && (
            <DRELinha label="(=) Receita Líquida" valor={dre.receitaLiquida} subtotal />
          )}
          <DRELinha label="(−) CMV (custo dos produtos)" valor={-dre.cmv} neg />
          <DRELinha label="(=) Lucro Bruto" valor={dre.lucroBruto} sub={`Margem ${formatPercent(dre.margemBrutaPct)}`} subtotal positiveColor />
          <div className="h-2" />
          {Object.entries(dre.gastosPorCategoria).map(([cat, v]) => (
            <DRELinha key={cat} label={`(−) ${cat}`} valor={-v} neg small />
          ))}
          <DRELinha label="(=) EBITDA" valor={dre.ebitda} subtotal positiveColor sub="Resultado da operação, antes de pró-labore e impostos" />
          <div className="h-2" />
          <DRELinha label="(−) Pró-labore" valor={-dre.proLabore} neg small />
          <DRELinha label="(−) DAS MEI" valor={-dre.impostos} neg small />
          <DRELinha
            label="(=) Resultado Líquido"
            valor={dre.resultadoLiquido}
            bold
            big
            sub={dre.receitaBruta > 0 ? `${formatPercent(dre.resultadoLiquidoPct)} da receita` : undefined}
            positiveColor
          />
        </div>
      </div>

      {/* Histórico 6 meses */}
      <div className="bg-card rounded-2xl p-4 card-elev space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary">Histórico — últimos 6 meses</h2>
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">Receita {tendIcon(tendenciaReceita)}</div>
            <div className="flex items-center gap-1">EBITDA {tendIcon(tendenciaEbitda)}</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={historico} barGap={2}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={45} />
            <Tooltip
              formatter={(v: number, name: string) => [formatCurrency(v), name === 'receita' ? 'Receita' : name === 'ebitda' ? 'EBITDA' : name]}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="receita" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
            <Bar dataKey="ebitda" radius={[4, 4, 0, 0]}>
              {historico.map((h, i) => (
                <Cell key={i} fill={h.ebitda >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="text-[11px] text-muted-foreground flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary inline-block" /> Receita</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-success inline-block" /> EBITDA (positivo)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-destructive inline-block" /> EBITDA (negativo)</span>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          EBITDA é o resultado da operação (Faturamento − Custo dos produtos − Custos operacionais). Não inclui pró-labore nem impostos.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1.5">Mês</th>
                <th className="text-right py-1.5">Receita</th>
                <th className="text-right py-1.5">Margem</th>
                <th className="text-right py-1.5">EBITDA</th>
                <th className="text-right py-1.5">Vendas</th>
              </tr>
            </thead>
            <tbody>
              {historico.map(h => (
                <tr key={h.anoMes} className="border-b last:border-0">
                  <td className="py-1.5">{h.label}</td>
                  <td className="text-right">{formatCurrency(h.receita)}</td>
                  <td className="text-right">{formatPercent(h.margemPct)}</td>
                  <td className={`text-right font-medium ${h.ebitda >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(h.ebitda)}</td>
                  <td className="text-right text-muted-foreground">{h.numVendas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROAS por canal */}
      <div className="bg-card rounded-2xl p-4 card-elev space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary">ROAS por canal — {meses[today.getMonth()]}</h2>
          <Link to="/configuracoes" className="text-[11px] text-primary hover:underline">Gerenciar canais</Link>
        </div>
        {roas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Sem vendas registradas com canal este mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1.5">Canal</th>
                  <th className="text-right py-1.5">Vendas</th>
                  <th className="text-right py-1.5">Margem</th>
                  <th className="text-right py-1.5">Gasto</th>
                  <th className="text-right py-1.5">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {roas.map(r => (
                  <tr key={r.canal} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'positivo' ? 'bg-success' : r.status === 'atencao' ? 'bg-warning' : r.status === 'negativo' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
                        <span className="font-medium">{r.canal}</span>
                        <span className="text-[9px] uppercase text-muted-foreground">{r.tipo}</span>
                      </div>
                    </td>
                    <td className="text-right">{formatCurrency(r.faturamento)} <span className="text-muted-foreground">({r.numVendas})</span></td>
                    <td className="text-right">{formatCurrency(r.margemBruta)}</td>
                    <td className="text-right text-destructive">{r.gasto > 0 ? `−${formatCurrency(r.gasto)}` : '—'}</td>
                    <td className={`text-right font-bold ${r.status === 'positivo' ? 'text-success' : r.status === 'atencao' ? 'text-warning' : r.status === 'negativo' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {r.roas !== null ? `${r.roas.toFixed(1)}x` : 'orgânico'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          ROAS = margem bruta gerada ÷ gasto no canal. Saudável: ≥ 3x · Atenção: 1,5-3x · Ruim: &lt; 1,5x
        </p>
      </div>

      {/* Teto MEI */}
      <div className="bg-card rounded-2xl p-4 card-elev space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary">Teto MEI {today.getFullYear()}</h2>
          <span className={`text-xs font-medium ${statusColor(tetoMEI.status === 'ok' ? 'ok' : tetoMEI.status === 'atencao' ? 'atencao' : 'critico')}`}>
            {tetoMEI.status === 'ok' ? 'Tranquilo' : tetoMEI.status === 'atencao' ? 'Atenção' : tetoMEI.status === 'risco' ? 'Risco' : 'Crítico'}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Faturamento ano corrente</span>
            <span className="font-bold">{formatCurrency(tetoMEI.faturamentoAno)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${tetoMEI.status === 'critico' ? 'bg-destructive' : tetoMEI.status === 'risco' ? 'bg-warning' : tetoMEI.status === 'atencao' ? 'bg-warning' : 'bg-success'}`}
              style={{ width: `${Math.min(tetoMEI.pctUsado, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{formatPercent(tetoMEI.pctUsado)} usado</span>
            <span>Restam {formatCurrency(tetoMEI.restante)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <p className="text-[10px] text-muted-foreground">Projeção fim do ano</p>
            <p className={`text-sm font-bold ${tetoMEI.projecaoFimAno > tetoMEI.teto ? 'text-destructive' : 'text-foreground'}`}>
              {formatCurrency(tetoMEI.projecaoFimAno)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Média mensal</p>
            <p className="text-sm font-bold">{formatCurrency(tetoMEI.mediaMesatual)}</p>
          </div>
        </div>
        {tetoMEI.ultrapassaEmMes && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 flex items-start gap-2">
            <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
            <p className="text-[11px] text-destructive">
              No ritmo atual, você estoura o teto em <strong>{meses[tetoMEI.ultrapassaEmMes - 1]}/{String(today.getFullYear()).slice(2)}</strong>. Consulte contador antecipadamente.
            </p>
          </div>
        )}
      </div>

      {/* Benchmark de suplementos */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-muted-foreground" />
          <h3 className="text-xs font-semibold text-secondary">Benchmark — loja de suplementos iniciante</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
          <BenchRow label="Margem bruta" saudavel="≥ 35%" voce={formatPercent(dre.margemBrutaPct)} ok={dre.margemBrutaPct >= 35} />
          <BenchRow label="Custo fixo / faturamento" saudavel="≤ 25%" voce={dre.receitaBruta > 0 ? `${((custoFixoMensal / dre.receitaBruta) * 100).toFixed(0)}%` : '—'} ok={dre.receitaBruta > 0 && (custoFixoMensal / dre.receitaBruta) <= 0.25} />
          <BenchRow label="Reserva (meses fixo)" saudavel="3+ meses" voce={runway === Infinity ? '∞' : `${runway.toFixed(1)}`} ok={runway >= 3} />
          <BenchRow label="Marketing / faturamento" saudavel="5-10%" voce={dre.receitaBruta > 0 ? `${(((dre.gastosPorCategoria['Marketing'] || 0) + (dre.gastosPorCategoria['Anúncios'] || 0)) / dre.receitaBruta * 100).toFixed(0)}%` : '—'} ok={true} />
          <BenchRow label="ROAS canais pagos" saudavel="≥ 3x" voce={roas.filter(r => r.roas !== null).length ? `${(roas.filter(r => r.roas !== null).reduce((s, r) => s + (r.roas || 0), 0) / roas.filter(r => r.roas !== null).length).toFixed(1)}x` : '—'} ok={true} />
          <BenchRow label="Teto MEI usado" saudavel="< 70%" voce={formatPercent(tetoMEI.pctUsado)} ok={tetoMEI.pctUsado < 70} />
        </div>
      </div>
    </div>
  );
}

function DRELinha({ label, valor, neg, bold, big, small, subtotal, positiveColor, sub }: {
  label: string;
  valor: number;
  neg?: boolean;
  bold?: boolean;
  big?: boolean;
  small?: boolean;
  subtotal?: boolean;
  positiveColor?: boolean;
  sub?: string;
}) {
  const cls = small ? 'text-xs text-muted-foreground' : '';
  const valorCls = positiveColor
    ? (valor >= 0 ? 'text-success' : 'text-destructive')
    : neg ? 'text-destructive' : '';
  return (
    <div className={`flex items-baseline justify-between gap-2 py-0.5 ${subtotal ? 'border-t pt-1.5 mt-1' : ''} ${big ? 'text-base border-t-2 pt-2 mt-1' : ''}`}>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${cls}`}>
        {label}
        {sub && <span className="text-[10px] text-muted-foreground ml-1.5">· {sub}</span>}
      </span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${valorCls} ${cls}`}>
        {formatCurrency(valor)}
      </span>
    </div>
  );
}

function RecomendacaoCard({ rec, index }: { rec: Recomendacao; index: number }) {
  const tipoClass = rec.tipo === 'critico' ? 'border-destructive/40 bg-destructive/5'
    : rec.tipo === 'atencao' ? 'border-warning/40 bg-warning/5'
    : rec.tipo === 'oportunidade' ? 'border-success/40 bg-success/5'
    : 'border-muted bg-muted/30';
  const numClass = rec.tipo === 'critico' ? 'bg-destructive text-destructive-foreground'
    : rec.tipo === 'atencao' ? 'bg-warning text-warning-foreground'
    : rec.tipo === 'oportunidade' ? 'bg-success text-success-foreground'
    : 'bg-muted text-muted-foreground';
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${tipoClass}`}>
      <div className="flex items-start gap-2">
        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${numClass}`}>{index}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">{rec.titulo}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{rec.descricao}</p>
        </div>
      </div>
      <div className="pl-8 space-y-1">
        {rec.acoes.map((a, i) => (
          <p key={i} className="text-xs flex items-start gap-1.5">
            <ChevronRight size={12} className="shrink-0 mt-0.5 text-primary" />
            <span>{a}</span>
          </p>
        ))}
      </div>
      {rec.naoFaca && rec.naoFaca.length > 0 && (
        <div className="pl-8 pt-2 border-t border-current/10">
          <p className="text-[10px] uppercase tracking-wider font-bold text-destructive">Não faça agora</p>
          {rec.naoFaca.map((a, i) => (
            <p key={i} className="text-xs text-muted-foreground">× {a}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function BenchRow({ label, saudavel, voce, ok }: { label: string; saudavel: string; voce: string; ok: boolean }) {
  return (
    <div className="bg-card rounded-lg p-2 border">
      <p className="text-muted-foreground">{label}</p>
      <div className="flex items-baseline justify-between gap-1 mt-0.5">
        <span className={`font-bold ${ok ? 'text-success' : 'text-warning'}`}>{voce}</span>
        <span className="text-[10px] text-muted-foreground">de {saudavel}</span>
      </div>
    </div>
  );
}
