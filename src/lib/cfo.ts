// CFO Peak — engine de cálculos financeiros puros (sem dependência de Supabase)

export type Venda = {
  id: string;
  produto_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  preco_venda: number;
  custo_unit: number;
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
};

// ============================================================
// DRE — Demonstrativo de Resultado mensal
// ============================================================
export type DRE = {
  receitaBruta: number;
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
  const cmv = vendasMes.reduce((s, v) => s + v.custo_unit * v.quantidade, 0);
  const lucroBruto = receitaBruta - cmv;
  const margemBrutaPct = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;

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

  return {
    receitaBruta,
    cmv,
    lucroBruto,
    margemBrutaPct,
    gastosPorCategoria,
    totalDespesasOp,
    ebitda,
    proLabore,
    impostos,
    resultadoLiquido,
    resultadoLiquidoPct,
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
  desdeInicio?: Date | null; // se definido, começa nesse mês até o mês atual (limitado a 12)
  hoje?: Date;
}): SnapshotMes[] {
  const hoje = opts.hoje ?? new Date();

  // Calcula quantos meses voltar
  let mesesVoltar: number;
  if (opts.desdeInicio) {
    const inicio = opts.desdeInicio;
    const diffMeses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
    mesesVoltar = Math.max(1, Math.min(diffMeses + 1, 12));
  } else {
    mesesVoltar = opts.meses ?? 6;
  }

  const result: SnapshotMes[] = [];
  for (let i = mesesVoltar - 1; i >= 0; i--) {
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
    const receita = vendasMes.reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
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
    vendasPorCanal[canal].fat += v.preco_venda * v.quantidade;
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
    .reduce((s, v) => s + v.preco_venda * v.quantidade, 0);

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
