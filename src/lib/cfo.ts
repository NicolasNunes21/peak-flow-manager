// CFO Peak — engine de cálculos financeiros puros (sem dependência de Supabase)

// Receita líquida de uma linha de venda: preço × qtd − desconto.
// Tolerante a desconto_rs ausente/null (antes da migration) → trata como 0.
function liquido(v: { quantidade: number; preco_venda: number; desconto_rs?: number | null }): number {
  return v.preco_venda * v.quantidade - Number(v.desconto_rs || 0);
}

export type Venda = {
  id: string;
  produto_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  preco_venda: number;
  custo_unit: number;
  desconto_rs?: number | null;
  brinde?: string | null;
  canal: string | null;
  forma_pgto: string | null;
  created_at: string | null;
};

export type Gasto = {
  id: string;
  nome: string;
  valor: number;
  categoria: string;
  recorrencia: string;
  data: string | null;
  canal: string | null;
};

export type ConfigFinanceira = {
  pro_labore_socio1: number;
  pro_labore_socio2: number;
  das_mei_mensal: number;
  teto_mei_anual: number;
  reserva_caixa: number;
  meta_lucro_mensal: number;
  nome_socio1?: string;
  nome_socio2?: string;
  data_abertura_loja?: string | null;
};

// ============================================================
// DRE — Demonstrativo de Resultado mensal
// ============================================================
export type DRE = {
  receitaBruta: number;
  descontos: number;
  receitaLiquida: number;
  cmv: number;
  lucroBruto: number;
  margemBrutaPct: number;
  gastosPorCategoria: Record<string, number>; // Custo Fixo, Marketing, Anúncios, ...
  totalDespesasOp: number;
  ebitda: number;
  proLabore: number;
  impostos: number;
  resultadoLiquido: number;
  resultadoLiquidoPct: number;
};

export function calcularDRE(opts: {
  vendasMes: Venda[];
  gastosMes: Gasto[];
  config: ConfigFinanceira;
}): DRE {
  const { vendasMes, gastosMes, config } = opts;
  const receitaBruta = vendasMes.reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
  const descontos = vendasMes.reduce((s, v) => s + Number(v.desconto_rs || 0), 0);
  const receitaLiquida = receitaBruta - descontos;
  const cmv = vendasMes.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
  const lucroBruto = receitaLiquida - cmv;
  const margemBrutaPct = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;

  const gastosPorCategoria: Record<string, number> = {};
  gastosMes.forEach(g => {
    const cat = g.categoria || 'Outros';
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Number(g.valor);
  });
  const totalDespesasOp = Object.values(gastosPorCategoria).reduce((s, v) => s + v, 0);

  const ebitda = lucroBruto - totalDespesasOp;
  const proLabore = (config.pro_labore_socio1 || 0) + (config.pro_labore_socio2 || 0);
  const impostos = config.das_mei_mensal || 0;
  const resultadoLiquido = ebitda - proLabore - impostos;
  const resultadoLiquidoPct = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

  const resultadoLiquidoPctBase = receitaLiquida > 0 ? (lucroBruto - totalDespesasOp - proLabore - impostos) / receitaLiquida * 100 : 0;
  return {
    receitaBruta,
    descontos,
    receitaLiquida,
    cmv,
    lucroBruto,
    margemBrutaPct,
    gastosPorCategoria,
    totalDespesasOp,
    ebitda,
    proLabore,
    impostos,
    resultadoLiquido,
    resultadoLiquidoPct: resultadoLiquidoPctBase,
  };
}

// ============================================================
// Histórico mensal (últimos N meses)
// ============================================================
export type SnapshotMes = {
  anoMes: string; // '2026-05'
  label: string;  // 'Mai/26'
  receita: number;
  cmv: number;
  lucroBruto: number;
  margemPct: number;
  totalGastos: number;
  ebitda: number;
  numVendas: number;
};

export function historicoMensal(opts: {
  vendas: Venda[];           // vendas para análise
  gastos: Gasto[];           // todos os gastos
  meses?: number;            // qtd de meses (modo legacy); ignorado se desdeInicio definido
  desdeInicio?: Date | null; // se definido, começa NESSE MÊS (inclusive). Cap de 24 meses.
  hoje?: Date;
}): SnapshotMes[] {
  const hoje = opts.hoje ?? new Date();
  const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  // Calcula data de início do histórico
  let inicioMes: Date;
  if (opts.desdeInicio) {
    const inicio = opts.desdeInicio;
    inicioMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    // Se data de início é futura ou igual ao mês atual, mostra só o mês atual
    if (inicioMes > mesAtualInicio) inicioMes = mesAtualInicio;
    // Cap: nunca mostrar mais de 24 meses (incluindo o mês atual)
    const limiteRetro = new Date(hoje.getFullYear(), hoje.getMonth() - 23, 1);
    if (inicioMes < limiteRetro) inicioMes = limiteRetro;
  } else {
    const meses = opts.meses ?? 6;
    inicioMes = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
  }

  // Calcula quantos meses entre inicioMes e mesAtualInicio (inclusive ambos)
  const mesesTotal = (mesAtualInicio.getFullYear() - inicioMes.getFullYear()) * 12
    + (mesAtualInicio.getMonth() - inicioMes.getMonth()) + 1;

  const result: SnapshotMes[] = [];
  for (let i = mesesTotal - 1; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const next = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 1);
    const ano = ref.getFullYear();
    const mes = ref.getMonth();
    const anoMes = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const label = `${meses[mes]}/${String(ano).slice(2)}`;

    const vendasMes = opts.vendas.filter(v => {
      if (!v.created_at) return false;
      const d = new Date(v.created_at);
      return d >= ref && d < next;
    });
    const receita = vendasMes.reduce((s, v) => s + liquido(v), 0);
    const cmv = vendasMes.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
    const lucroBruto = receita - cmv;
    const margemPct = receita > 0 ? (lucroBruto / receita) * 100 : 0;

    // Gastos do mês: fixos mensais (sempre) + únicos com data no mês
    const gastosMes = opts.gastos.filter(g => {
      if (g.recorrencia === 'mensal') return true;
      if (g.data) {
        const d = new Date(g.data);
        return d >= ref && d < next;
      }
      return false;
    });
    const totalGastos = gastosMes.reduce((s, g) => s + Number(g.valor), 0);
    const ebitda = lucroBruto - totalGastos;

    result.push({
      anoMes,
      label,
      receita,
      cmv,
      lucroBruto,
      margemPct,
      totalGastos,
      ebitda,
      numVendas: vendasMes.length,
    });
  }
  return result;
}

export function tendencia(serie: number[]): 'subindo' | 'estavel' | 'caindo' {
  if (serie.length < 2) return 'estavel';
  const recent = serie.slice(-3);
  if (recent.length < 2) return 'estavel';
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === 0) return last > 0 ? 'subindo' : 'estavel';
  const delta = ((last - first) / Math.abs(first)) * 100;
  if (delta > 10) return 'subindo';
  if (delta < -10) return 'caindo';
  return 'estavel';
}

// ============================================================
// ROAS por canal
// ============================================================
export type CanalROAS = {
  canal: string;
  tipo: 'loja' | 'organico' | 'pago' | 'parceria' | 'desconhecido';
  faturamento: number;
  margemBruta: number;
  numVendas: number;
  gasto: number;        // total gasto vinculado a este canal
  roas: number | null;  // null se canal é orgânico/loja (sem gasto direto)
  status: 'positivo' | 'atencao' | 'negativo' | 'organico';
};

export function calcularROAS(opts: {
  vendasMes: Venda[];
  gastosMes: Gasto[];
  canais: Array<{ nome: string; tipo: string }>;
}): CanalROAS[] {
  const { vendasMes, gastosMes, canais } = opts;
  const canalMap = new Map(canais.map(c => [c.nome, c.tipo]));

  // Agrupa vendas por canal (string)
  const vendasPorCanal: Record<string, { fat: number; cmv: number; n: number }> = {};
  vendasMes.forEach(v => {
    const canal = v.canal || 'Sem canal';
    if (!vendasPorCanal[canal]) vendasPorCanal[canal] = { fat: 0, cmv: 0, n: 0 };
    vendasPorCanal[canal].fat += liquido(v);
    vendasPorCanal[canal].cmv += v.custo_unit * v.quantidade;
    vendasPorCanal[canal].n += 1;
  });

  // Agrupa gastos por canal
  const gastosPorCanal: Record<string, number> = {};
  gastosMes.forEach(g => {
    if (g.canal) {
      gastosPorCanal[g.canal] = (gastosPorCanal[g.canal] || 0) + Number(g.valor);
    }
  });

  // Une todos canais (presentes em vendas ou gastos)
  const todos = new Set<string>([
    ...Object.keys(vendasPorCanal),
    ...Object.keys(gastosPorCanal),
  ]);

  const out: CanalROAS[] = [];
  todos.forEach(nome => {
    const dadosVenda = vendasPorCanal[nome] || { fat: 0, cmv: 0, n: 0 };
    const gasto = gastosPorCanal[nome] || 0;
    const margemBruta = dadosVenda.fat - dadosVenda.cmv;
    const tipoStr = canalMap.get(nome) || 'desconhecido';
    const tipo = (['loja', 'organico', 'pago', 'parceria'].includes(tipoStr) ? tipoStr : 'desconhecido') as CanalROAS['tipo'];

    let roas: number | null = null;
    let status: CanalROAS['status'] = 'organico';
    if (gasto > 0) {
      // ROAS usa margem bruta (não faturamento) — só vale o que sobra
      roas = margemBruta / gasto;
      status = roas >= 3 ? 'positivo' : roas >= 1.5 ? 'atencao' : 'negativo';
    }

    out.push({
      canal: nome,
      tipo,
      faturamento: dadosVenda.fat,
      margemBruta,
      numVendas: dadosVenda.n,
      gasto,
      roas,
      status,
    });
  });

  return out.sort((a, b) => b.faturamento - a.faturamento);
}

// ============================================================
// Teto MEI
// ============================================================
export type StatusMEI = {
  faturamentoAno: number;
  teto: number;
  pctUsado: number;
  restante: number;
  mediaMesatual: number;          // média baseada nos meses passados
  projecaoFimAno: number;
  ultrapassaEmMes: number | null;  // mês (1-12) em que ultrapassa, se ultrapassar
  status: 'ok' | 'atencao' | 'risco' | 'critico';
};

export function statusTetoMEI(opts: {
  vendasAnoCorrente: Venda[];
  teto: number;
  hoje?: Date;
}): StatusMEI {
  const hoje = opts.hoje ?? new Date();
  const inicioAno = new Date(hoje.getFullYear(), 0, 1);
  const faturamentoAno = opts.vendasAnoCorrente
    .filter(v => v.created_at && new Date(v.created_at) >= inicioAno)
    .reduce((s, v) => s + liquido(v), 0);

  const mesAtual = hoje.getMonth() + 1;
  const diasAno = (hoje.getTime() - inicioAno.getTime()) / (1000 * 60 * 60 * 24);
  const ritmoDiario = diasAno > 0 ? faturamentoAno / diasAno : 0;
  const projecaoFimAno = ritmoDiario * 365;
  const pctUsado = (faturamentoAno / opts.teto) * 100;
  const restante = Math.max(opts.teto - faturamentoAno, 0);

  // Em que mês ultrapassa, se mantida a média
  let ultrapassaEmMes: number | null = null;
  if (ritmoDiario > 0 && projecaoFimAno > opts.teto) {
    const diasParaEstourar = restante / ritmoDiario;
    const dataEstourar = new Date(hoje.getTime() + diasParaEstourar * 24 * 60 * 60 * 1000);
    ultrapassaEmMes = dataEstourar.getMonth() + 1;
  }

  let status: StatusMEI['status'] = 'ok';
  if (pctUsado >= 90) status = 'critico';
  else if (pctUsado >= 70) status = 'risco';
  else if (pctUsado >= 50) status = 'atencao';

  // Também avalia projeção: se vai estourar no ano, é pelo menos risco
  if (projecaoFimAno > opts.teto && status === 'ok') status = 'atencao';
  if (projecaoFimAno > opts.teto * 1.1 && status === 'atencao') status = 'risco';

  return {
    faturamentoAno,
    teto: opts.teto,
    pctUsado,
    restante,
    mediaMesatual: mesAtual > 0 ? faturamentoAno / mesAtual : 0,
    projecaoFimAno,
    ultrapassaEmMes,
    status,
  };
}

// ============================================================
// Runway (meses de sobrevivência com reserva atual)
// ============================================================
export function calcularRunway(reservaCaixa: number, queimaMensal: number): number {
  if (queimaMensal <= 0) return Infinity;
  return reservaCaixa / queimaMensal;
}

// ============================================================
// Taxas de cartão e prazos de recebimento
// Zero fricção: padrões do varejo brasileiro, editáveis 1x na config.
// taxa em fração (0.035 = 3,5%); prazoDias = quando o dinheiro cai no caixa.
// ============================================================
export type FormaPgtoTaxa = { taxa: number; prazoDias: number };
export type TaxasPgto = Record<string, FormaPgtoTaxa>;

// Padrão: recebimento NO MESMO DIA (D+0) — caso desta loja. A taxa da
// maquininha continua aplicada (afeta a margem de contribuição); só o prazo
// de recebimento é zero. Editável em Configurações por quem recebe em D+30.
export const TAXAS_PGTO_DEFAULT: TaxasPgto = {
  'Crédito': { taxa: 0.035, prazoDias: 0 },
  'Débito': { taxa: 0.02, prazoDias: 0 },
  'PIX': { taxa: 0, prazoDias: 0 },
  'Dinheiro': { taxa: 0, prazoDias: 0 },
};

function taxaDe(forma: string | null | undefined, taxas: TaxasPgto): FormaPgtoTaxa {
  return (forma && taxas[forma]) || { taxa: 0, prazoDias: 0 };
}

// ============================================================
// Margem de contribuição — o que sobra DEPOIS da taxa de cartão
// MC = receita líquida − CMV − taxa de cartão
// ============================================================
export type MargemContribuicao = {
  receitaLiquida: number;
  cmv: number;
  taxasCartao: number;
  margemContribuicao: number;
  mcPct: number;
};

export function calcularMargemContribuicao(opts: { vendas: Venda[]; taxas?: TaxasPgto }): MargemContribuicao {
  const taxas = opts.taxas ?? TAXAS_PGTO_DEFAULT;
  let receitaLiquida = 0, cmv = 0, taxasCartao = 0;
  for (const v of opts.vendas) {
    const rl = liquido(v);
    receitaLiquida += rl;
    cmv += v.custo_unit * v.quantidade;
    taxasCartao += rl * taxaDe(v.forma_pgto, taxas).taxa;
  }
  const margemContribuicao = receitaLiquida - cmv - taxasCartao;
  const mcPct = receitaLiquida > 0 ? (margemContribuicao / receitaLiquida) * 100 : 0;
  return { receitaLiquida, cmv, taxasCartao, margemContribuicao, mcPct };
}

// ============================================================
// Break-even REAL — usa margem de contribuição (não margem bruta)
// ============================================================
export type BreakEven = {
  mcPct: number;
  custoFixoMensal: number;
  breakEvenRs: number;        // faturamento líquido necessário p/ empatar
  faturamentoAtual: number;
  faltaRs: number;            // quanto falta (0 se já atingiu)
  margemSegurancaPct: number; // % acima do break-even
  ticketMedio: number;
  vendasParaBE: number;       // nº de vendas no ticket médio p/ empatar
  atingido: boolean;
};

export function calcularBreakEven(opts: { vendas: Venda[]; custoFixoMensal: number; taxas?: TaxasPgto }): BreakEven {
  const mc = calcularMargemContribuicao({ vendas: opts.vendas, taxas: opts.taxas });
  const mcFrac = mc.mcPct / 100;
  const breakEvenRs = mcFrac > 0 ? opts.custoFixoMensal / mcFrac : Infinity;
  const faturamentoAtual = mc.receitaLiquida;
  const n = opts.vendas.length;
  const ticketMedio = n > 0 ? faturamentoAtual / n : 0;
  const vendasParaBE = ticketMedio > 0 && isFinite(breakEvenRs) ? Math.ceil(breakEvenRs / ticketMedio) : 0;
  const atingido = faturamentoAtual >= breakEvenRs;
  const faltaRs = isFinite(breakEvenRs) ? Math.max(breakEvenRs - faturamentoAtual, 0) : Infinity;
  const margemSegurancaPct = faturamentoAtual > 0 && isFinite(breakEvenRs)
    ? ((faturamentoAtual - breakEvenRs) / faturamentoAtual) * 100 : 0;
  return {
    mcPct: mc.mcPct, custoFixoMensal: opts.custoFixoMensal, breakEvenRs, faturamentoAtual,
    faltaRs, margemSegurancaPct, ticketMedio, vendasParaBE, atingido,
  };
}

// ============================================================
// Estoque — cobertura em dias, giro, capital parado
// ============================================================
export type ProdutoEstoque = {
  id: string;
  nome: string;
  categoria?: string | null;
  qtd_atual: number | null;
  custo_unit: number | null;
};

export type ItemEstoque = {
  id: string;
  nome: string;
  qtdAtual: number;
  vendaDiaria: number;            // média de unidades/dia na janela
  coberturaDias: number | null;   // dias até zerar; null = não vende (parado)
  giroMensal: number;             // unidades vendidas na janela ÷ estoque atual
  capitalParado: number;          // qtd × custo
  status: 'ruptura' | 'baixo' | 'saudavel' | 'excesso' | 'parado';
};

export function analisarEstoque(opts: {
  produtos: ProdutoEstoque[];
  vendas: Venda[];
  hoje?: Date;
  janelaDias?: number;
}): { itens: ItemEstoque[]; capitalTotal: number; paradosValor: number; excessoValor: number } {
  const hoje = opts.hoje ?? new Date();
  const janela = opts.janelaDias ?? 30;
  const desde = new Date(hoje.getTime() - janela * 86400000);

  // unidades vendidas por produto na janela (por id e por nome, p/ robustez)
  const vendidoPorId = new Map<string, number>();
  const vendidoPorNome = new Map<string, number>();
  for (const v of opts.vendas) {
    if (!v.created_at) continue;
    if (new Date(v.created_at) < desde) continue;
    if (v.produto_id) vendidoPorId.set(v.produto_id, (vendidoPorId.get(v.produto_id) || 0) + v.quantidade);
    if (v.produto_nome) vendidoPorNome.set(v.produto_nome, (vendidoPorNome.get(v.produto_nome) || 0) + v.quantidade);
  }

  let capitalTotal = 0, paradosValor = 0, excessoValor = 0;
  const itens: ItemEstoque[] = opts.produtos.map(p => {
    const qtdAtual = p.qtd_atual ?? 0;
    const custo = p.custo_unit ?? 0;
    const capitalParado = qtdAtual * custo;
    capitalTotal += capitalParado;

    const vendido = vendidoPorId.get(p.id) ?? vendidoPorNome.get(p.nome) ?? 0;
    const vendaDiaria = vendido / janela;
    const coberturaDias = vendaDiaria > 0 ? qtdAtual / vendaDiaria : null;
    const giroMensal = qtdAtual > 0 ? vendido / qtdAtual : 0;

    let status: ItemEstoque['status'];
    if (qtdAtual <= 0) {
      status = vendido > 0 ? 'ruptura' : 'parado';
    } else if (vendaDiaria === 0) {
      status = 'parado';
      paradosValor += capitalParado;
    } else if (coberturaDias! < 7) {
      status = 'baixo';
    } else if (coberturaDias! > 90) {
      status = 'excesso';
      excessoValor += capitalParado;
    } else {
      status = 'saudavel';
    }

    return { id: p.id, nome: p.nome, qtdAtual, vendaDiaria, coberturaDias, giroMensal, capitalParado, status };
  });

  return { itens, capitalTotal, paradosValor, excessoValor };
}

// ============================================================
// Curva ABC — Pareto por receita líquida (A=80%, B=95%, C=resto)
// ============================================================
export type ItemABC = {
  nome: string;
  receita: number;
  pct: number;       // % do total
  pctAcum: number;   // % acumulado
  classe: 'A' | 'B' | 'C';
};

export function curvaABC(vendas: Venda[]): ItemABC[] {
  const porProduto = new Map<string, number>();
  for (const v of vendas) {
    const k = v.produto_nome || v.produto_id || '—';
    porProduto.set(k, (porProduto.get(k) || 0) + liquido(v));
  }
  const total = [...porProduto.values()].reduce((s, x) => s + x, 0);
  if (total <= 0) return [];
  const ordenado = [...porProduto.entries()].sort((a, b) => b[1] - a[1]);
  let acum = 0;
  return ordenado.map(([nome, receita]) => {
    const pct = (receita / total) * 100;
    acum += pct;
    const classe: ItemABC['classe'] = acum <= 80 ? 'A' : acum <= 95 ? 'B' : 'C';
    return { nome, receita, pct, pctAcum: acum, classe };
  });
}

// ============================================================
// Recebíveis — fluxo de caixa REAL considerando prazo de cartão
// ============================================================
export type Recebiveis = {
  aReceberTotal: number;     // líquido de taxa, ainda não caiu no caixa
  proximos7d: number;        // cai nos próximos 7 dias
  proximos30d: number;       // cai nos próximos 30 dias
  caixaRealizadoMes: number; // já caiu no caixa dentro do mês corrente
  faturadoMes: number;       // competência (líquido de desconto) no mês
};

export function calcularRecebiveis(opts: { vendas: Venda[]; taxas?: TaxasPgto; hoje?: Date }): Recebiveis {
  const taxas = opts.taxas ?? TAXAS_PGTO_DEFAULT;
  const hoje = opts.hoje ?? new Date();
  const em7 = new Date(hoje.getTime() + 7 * 86400000);
  const em30 = new Date(hoje.getTime() + 30 * 86400000);
  const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const mesFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  let aReceberTotal = 0, proximos7d = 0, proximos30d = 0, caixaRealizadoMes = 0, faturadoMes = 0;
  for (const v of opts.vendas) {
    if (!v.created_at) continue;
    const dataVenda = new Date(v.created_at);
    const { taxa, prazoDias } = taxaDe(v.forma_pgto, taxas);
    const liquidoCaixa = liquido(v) * (1 - taxa); // o que efetivamente entra
    const dataRecebimento = new Date(dataVenda.getTime() + prazoDias * 86400000);

    if (dataVenda >= mesInicio && dataVenda < mesFim) faturadoMes += liquido(v);

    if (dataRecebimento > hoje) {
      aReceberTotal += liquidoCaixa;
      if (dataRecebimento <= em7) proximos7d += liquidoCaixa;
      if (dataRecebimento <= em30) proximos30d += liquidoCaixa;
    }
    if (dataRecebimento >= mesInicio && dataRecebimento < mesFim && dataRecebimento <= hoje) {
      caixaRealizadoMes += liquidoCaixa;
    }
  }
  return { aReceberTotal, proximos7d, proximos30d, caixaRealizadoMes, faturadoMes };
}

// ============================================================
// Variação período-a-período (pro CFO ficar dinâmico)
// retorna null quando a base é zero (não comparável)
// ============================================================
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}
