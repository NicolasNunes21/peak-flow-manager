import { describe, it, expect } from "vitest";
import { calcularDRE, calcularROAS, statusTetoMEI, calcularRunway, historicoMensal, tendencia, type ConfigFinanceira } from "@/lib/cfo";
import { gerarRecomendacoes, type EstadoFinanceiro } from "@/lib/cfo-recomenda";

function venda(daysAgo: number, opts: { qtd?: number; preco?: number; custo?: number; canal?: string; nome?: string } = {}) {
  const now = new Date('2026-05-23T12:00:00Z');
  return {
    id: `v-${Math.random()}`,
    produto_id: null,
    produto_nome: opts.nome ?? 'Whey',
    quantidade: opts.qtd ?? 1,
    preco_venda: opts.preco ?? 100,
    custo_unit: opts.custo ?? 60,
    canal: opts.canal ?? 'Loja física',
    forma_pgto: 'PIX',
    created_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
  };
}

function gasto(opts: { valor: number; categoria?: string; recorrencia?: string; data?: string | null; canal?: string | null }) {
  return {
    id: `g-${Math.random()}`,
    nome: opts.categoria || 'X',
    valor: opts.valor,
    categoria: opts.categoria ?? 'Custo Fixo',
    recorrencia: opts.recorrencia ?? 'mensal',
    data: opts.data ?? null,
    canal: opts.canal ?? null,
  };
}

const HOJE = new Date('2026-05-23T12:00:00Z');

const cfgPadrao: ConfigFinanceira = {
  pro_labore_socio1: 1000,
  pro_labore_socio2: 1000,
  das_mei_mensal: 80.90,
  teto_mei_anual: 81000,
  reserva_caixa: 0,
  meta_lucro_mensal: 0,
};

// ============================================================
// DRE
// ============================================================
describe("calcularDRE", () => {
  it("calcula receita, CMV e margem corretamente", () => {
    const vendas = [
      venda(1, { qtd: 2, preco: 100, custo: 60 }), // R$200 receita, R$120 cmv
      venda(2, { qtd: 1, preco: 50, custo: 30 }),  // R$50 receita, R$30 cmv
    ];
    const dre = calcularDRE({ vendasMes: vendas, gastosMes: [], config: cfgPadrao });
    expect(dre.receitaBruta).toBe(250);
    expect(dre.cmv).toBe(150);
    expect(dre.lucroBruto).toBe(100);
    expect(dre.margemBrutaPct).toBe(40);
  });

  it("subtrai gastos por categoria e calcula EBITDA", () => {
    const vendas = [venda(1, { qtd: 10, preco: 100, custo: 60 })]; // 1000 fat, 600 cmv
    const gastos = [
      gasto({ valor: 200, categoria: 'Custo Fixo' }),
      gasto({ valor: 100, categoria: 'Marketing' }),
    ];
    const dre = calcularDRE({ vendasMes: vendas, gastosMes: gastos, config: cfgPadrao });
    expect(dre.lucroBruto).toBe(400);
    expect(dre.totalDespesasOp).toBe(300);
    expect(dre.ebitda).toBe(100);
    expect(dre.gastosPorCategoria['Custo Fixo']).toBe(200);
    expect(dre.gastosPorCategoria['Marketing']).toBe(100);
  });

  it("aplica pró-labore e DAS no resultado líquido", () => {
    const vendas = [venda(1, { qtd: 10, preco: 100, custo: 60 })];
    const dre = calcularDRE({ vendasMes: vendas, gastosMes: [], config: cfgPadrao });
    // 400 lucro bruto - 0 desp op - 2000 pró-labore - 80.90 DAS = -1680.90
    expect(dre.ebitda).toBe(400);
    expect(dre.proLabore).toBe(2000);
    expect(dre.impostos).toBe(80.90);
    expect(dre.resultadoLiquido).toBeCloseTo(-1680.90, 2);
  });

  it("retorna zeros quando não há vendas", () => {
    const dre = calcularDRE({ vendasMes: [], gastosMes: [], config: cfgPadrao });
    expect(dre.receitaBruta).toBe(0);
    expect(dre.margemBrutaPct).toBe(0);
    expect(dre.lucroBruto).toBe(0);
  });
});

// ============================================================
// ROAS
// ============================================================
describe("calcularROAS", () => {
  it("calcula ROAS como margem / gasto", () => {
    const vendas = [
      venda(1, { qtd: 5, preco: 100, custo: 60, canal: 'Anúncio Meta' }), // 500 fat, 200 margem
    ];
    const gastos = [
      gasto({ valor: 100, categoria: 'Anúncios', canal: 'Anúncio Meta' }),
    ];
    const canais = [{ nome: 'Anúncio Meta', tipo: 'pago' }];
    const result = calcularROAS({ vendasMes: vendas, gastosMes: gastos, canais });
    const meta = result.find(r => r.canal === 'Anúncio Meta');
    expect(meta).toBeDefined();
    expect(meta!.roas).toBe(2); // 200/100
    expect(meta!.status).toBe('atencao'); // 1.5-3x
  });

  it("classifica ROAS ≥ 3 como positivo", () => {
    const vendas = [venda(1, { qtd: 10, preco: 100, custo: 60, canal: 'Indica' })];
    const gastos = [gasto({ valor: 100, categoria: 'Parceria', canal: 'Indica' })];
    const r = calcularROAS({ vendasMes: vendas, gastosMes: gastos, canais: [{ nome: 'Indica', tipo: 'parceria' }] });
    expect(r[0].roas).toBe(4);
    expect(r[0].status).toBe('positivo');
  });

  it("classifica ROAS < 1.5 como negativo", () => {
    const vendas = [venda(1, { qtd: 2, preco: 100, custo: 60, canal: 'Meta' })];
    const gastos = [gasto({ valor: 100, categoria: 'Anúncios', canal: 'Meta' })];
    const r = calcularROAS({ vendasMes: vendas, gastosMes: gastos, canais: [{ nome: 'Meta', tipo: 'pago' }] });
    // margem = 80, gasto = 100, ROAS 0.8
    expect(r[0].roas).toBe(0.8);
    expect(r[0].status).toBe('negativo');
  });

  it("marca canais sem gasto como orgânicos", () => {
    const vendas = [venda(1, { canal: 'Instagram' })];
    const r = calcularROAS({ vendasMes: vendas, gastosMes: [], canais: [{ nome: 'Instagram', tipo: 'organico' }] });
    expect(r[0].roas).toBeNull();
    expect(r[0].status).toBe('organico');
  });
});

// ============================================================
// Teto MEI
// ============================================================
describe("statusTetoMEI", () => {
  it("calcula percentual usado corretamente", () => {
    const vendas = [
      venda(30, { qtd: 100, preco: 100, custo: 60 }), // 10k
      venda(60, { qtd: 100, preco: 100, custo: 60 }), // 10k
    ];
    const status = statusTetoMEI({ vendasAnoCorrente: vendas, teto: 81000, hoje: HOJE });
    expect(status.faturamentoAno).toBe(20000);
    expect(status.pctUsado).toBeCloseTo((20000 / 81000) * 100, 1);
  });

  it("detecta risco de estouro projetando o ano", () => {
    // Janeiro a maio teve faturamento de R$ 50k (10k/mês ~ 120k/ano > teto)
    const vendas: any[] = [];
    for (let i = 0; i < 5; i++) {
      vendas.push(venda(30 + i * 30, { qtd: 100, preco: 100, custo: 60 })); // 10k cada mês
    }
    const status = statusTetoMEI({ vendasAnoCorrente: vendas, teto: 81000, hoje: HOJE });
    expect(status.projecaoFimAno).toBeGreaterThan(81000);
    expect(['atencao', 'risco', 'critico']).toContain(status.status);
    expect(status.ultrapassaEmMes).not.toBeNull();
  });

  it("retorna OK quando ritmo está dentro do teto", () => {
    const vendas = [venda(15, { qtd: 30, preco: 100, custo: 60 })]; // 3k até agora
    const status = statusTetoMEI({ vendasAnoCorrente: vendas, teto: 81000, hoje: HOJE });
    expect(status.status).toBe('ok');
  });
});

// ============================================================
// Runway
// ============================================================
describe("calcularRunway", () => {
  it("retorna Infinity quando não há queima", () => {
    expect(calcularRunway(1000, 0)).toBe(Infinity);
    expect(calcularRunway(1000, -100)).toBe(Infinity);
  });

  it("calcula meses de sobrevivência", () => {
    expect(calcularRunway(3000, 1000)).toBe(3);
    expect(calcularRunway(1500, 1000)).toBe(1.5);
  });
});

// ============================================================
// Histórico mensal
// ============================================================
describe("historicoMensal", () => {
  it("agrupa vendas por mês corretamente", () => {
    const vendas = [
      venda(5, { qtd: 1, preco: 100, custo: 60 }),  // mês atual
      venda(35, { qtd: 1, preco: 200, custo: 80 }), // mês passado
    ];
    const hist = historicoMensal({ vendas, gastos: [], meses: 2, hoje: HOJE });
    expect(hist).toHaveLength(2);
    // Último elemento = mês atual
    expect(hist[1].receita).toBe(100);
    // Primeiro = mês anterior
    expect(hist[0].receita).toBe(200);
  });

  it("inclui gastos mensais em todos os meses", () => {
    const gastos = [gasto({ valor: 1000, categoria: 'Custo Fixo', recorrencia: 'mensal' })];
    const hist = historicoMensal({ vendas: [], gastos, meses: 3, hoje: HOJE });
    expect(hist.every(h => h.totalGastos === 1000)).toBe(true);
  });
});

describe("tendencia", () => {
  it("detecta crescimento", () => {
    expect(tendencia([100, 110, 130])).toBe('subindo');
  });
  it("detecta queda", () => {
    expect(tendencia([100, 90, 70])).toBe('caindo');
  });
  it("detecta estabilidade", () => {
    expect(tendencia([100, 102, 105])).toBe('estavel');
  });
});

// ============================================================
// Recomendações — engine CFO
// ============================================================
function estadoBase(overrides: Partial<EstadoFinanceiro> = {}): EstadoFinanceiro {
  return {
    dre: {
      receitaBruta: 2000,
      cmv: 1200,
      lucroBruto: 800,
      margemBrutaPct: 40,
      gastosPorCategoria: { 'Custo Fixo': 500 },
      totalDespesasOp: 500,
      ebitda: 300,
      proLabore: 0,
      impostos: 80,
      resultadoLiquido: 220,
      resultadoLiquidoPct: 11,
    },
    custoFixoMensal: 500,
    reservaCaixa: 0,
    faturamento3mMedia: 2000,
    faturamentoTendencia: 'estavel',
    roasCanais: [],
    tetoMEI: {
      faturamentoAno: 20000,
      teto: 81000,
      pctUsado: 24,
      restante: 61000,
      mediaMesatual: 4000,
      projecaoFimAno: 48000,
      ultrapassaEmMes: null,
      status: 'ok',
    },
    produtosBombando: [],
    produtosParados: [],
    produtosRuptura: [],
    ...overrides,
  };
}

describe("gerarRecomendacoes", () => {
  it("cenário crítico: caixa negativo → recomenda parar de investir", () => {
    const recs = gerarRecomendacoes(estadoBase({
      dre: {
        receitaBruta: 2300,
        cmv: 1500,
        lucroBruto: 800,
        margemBrutaPct: 33,
        gastosPorCategoria: { 'Custo Fixo': 1950 },
        totalDespesasOp: 1950,
        ebitda: -1150,
        proLabore: 0,
        impostos: 80,
        resultadoLiquido: -1230,
        resultadoLiquidoPct: -53,
      },
      custoFixoMensal: 1950,
    }));
    const critica = recs.find(r => r.tipo === 'critico');
    expect(critica).toBeDefined();
    expect(critica!.titulo).toContain('sangria');
    expect(critica!.naoFaca).toContain('Aumentar estoque (capital fica preso)');
  });

  it("reserva insuficiente: recomenda construir reserva antes de investir", () => {
    const recs = gerarRecomendacoes(estadoBase({
      reservaCaixa: 100, // <1 mês de custo
      custoFixoMensal: 500,
    }));
    const reserva = recs.find(r => r.titulo.toLowerCase().includes('reserva'));
    expect(reserva).toBeDefined();
    expect(reserva!.prioridade).toBe(1);
  });

  it("reserva ok + ROAS alto: recomenda escalar canal ganhador", () => {
    const recs = gerarRecomendacoes(estadoBase({
      reservaCaixa: 3000, // 6 meses de custo fixo
      custoFixoMensal: 500,
      roasCanais: [
        {
          canal: 'Meta Ads',
          tipo: 'pago',
          faturamento: 1500,
          margemBruta: 600,
          numVendas: 10,
          gasto: 150,
          roas: 4,
          status: 'positivo',
        },
      ],
    }));
    const oport = recs.find(r => r.titulo.includes('Meta Ads'));
    expect(oport).toBeDefined();
    expect(oport!.tipo).toBe('oportunidade');
  });

  it("ROAS ruim: recomenda pausar canal", () => {
    const recs = gerarRecomendacoes(estadoBase({
      reservaCaixa: 3000,
      custoFixoMensal: 500,
      roasCanais: [
        {
          canal: 'Google Ads',
          tipo: 'pago',
          faturamento: 100,
          margemBruta: 40,
          numVendas: 1,
          gasto: 200,
          roas: 0.2,
          status: 'negativo',
        },
      ],
    }));
    const pausar = recs.find(r => r.titulo.includes('Google Ads'));
    expect(pausar).toBeDefined();
    expect(pausar!.titulo).toContain('queimando');
  });

  it("teto MEI em risco: gera recomendação de consultar contador", () => {
    const recs = gerarRecomendacoes(estadoBase({
      tetoMEI: {
        faturamentoAno: 70000,
        teto: 81000,
        pctUsado: 86,
        restante: 11000,
        mediaMesatual: 14000,
        projecaoFimAno: 100000,
        ultrapassaEmMes: 9,
        status: 'risco',
      },
    }));
    const teto = recs.find(r => r.titulo.toLowerCase().includes('mei'));
    expect(teto).toBeDefined();
  });

  it("ruptura: prioriza repor produtos sem estoque com demanda", () => {
    const recs = gerarRecomendacoes(estadoBase({
      reservaCaixa: 3000,
      custoFixoMensal: 500,
      produtosRuptura: [{ nome: 'Creatina Universal' }, { nome: 'Whey 900g' }],
    }));
    const ruptura = recs.find(r => r.titulo.toLowerCase().includes('reponha'));
    expect(ruptura).toBeDefined();
  });

  it("recomendações são ordenadas por prioridade", () => {
    const recs = gerarRecomendacoes(estadoBase({
      reservaCaixa: 100,
      tetoMEI: {
        faturamentoAno: 75000,
        teto: 81000,
        pctUsado: 92,
        restante: 6000,
        mediaMesatual: 15000,
        projecaoFimAno: 100000,
        ultrapassaEmMes: 8,
        status: 'critico',
      },
    }));
    for (let i = 0; i < recs.length - 1; i++) {
      expect(recs[i].prioridade).toBeLessThanOrEqual(recs[i + 1].prioridade);
    }
  });
});
