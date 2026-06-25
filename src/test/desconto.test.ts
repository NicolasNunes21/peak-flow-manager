import { describe, it, expect } from "vitest";
import { liquidoVenda } from "@/lib/format";
import { calcularDRE, calcularROAS, statusTetoMEI, historicoMensal, type ConfigFinanceira } from "@/lib/cfo";

const cfg: ConfigFinanceira = {
  pro_labore_socio1: 0, pro_labore_socio2: 0, das_mei_mensal: 0,
  teto_mei_anual: 81000, reserva_caixa: 0, meta_lucro_mensal: 0,
};

function venda(opts: { qtd?: number; preco?: number; custo?: number; desconto?: number; canal?: string; daysAgo?: number } = {}) {
  const now = new Date('2026-05-23T12:00:00Z');
  return {
    id: `v-${Math.random()}`,
    produto_id: null,
    produto_nome: 'Whey',
    quantidade: opts.qtd ?? 1,
    preco_venda: opts.preco ?? 100,
    custo_unit: opts.custo ?? 60,
    desconto_rs: opts.desconto ?? 0,
    canal: opts.canal ?? 'Loja',
    forma_pgto: 'PIX',
    created_at: new Date(now.getTime() - (opts.daysAgo ?? 1) * 86400000).toISOString(),
  };
}

describe("liquidoVenda", () => {
  it("subtrai o desconto", () => {
    expect(liquidoVenda({ preco_venda: 100, quantidade: 2, desconto_rs: 30 })).toBe(170);
  });
  it("trata desconto ausente/null como 0 (compatível antes da migration)", () => {
    expect(liquidoVenda({ preco_venda: 100, quantidade: 2 })).toBe(200);
    expect(liquidoVenda({ preco_venda: 100, quantidade: 1, desconto_rs: null })).toBe(100);
  });
});

describe("DRE com desconto", () => {
  it("receita líquida = bruta − descontos, e margem usa a líquida", () => {
    const dre = calcularDRE({
      vendasMes: [venda({ qtd: 1, preco: 100, custo: 60, desconto: 20 })],
      gastosMes: [], config: cfg,
    });
    expect(dre.receitaBruta).toBe(100);
    expect(dre.descontos).toBe(20);
    expect(dre.receitaLiquida).toBe(80);
    expect(dre.lucroBruto).toBe(20); // 80 − 60
  });
});

describe("histórico mensal com desconto", () => {
  it("receita do mês desconta o desconto", () => {
    const hist = historicoMensal({
      vendas: [venda({ qtd: 1, preco: 100, custo: 60, desconto: 25, daysAgo: 1 })],
      gastos: [], meses: 1, hoje: new Date('2026-05-23T12:00:00Z'),
    });
    expect(hist[hist.length - 1].receita).toBe(75);
  });
});

describe("ROAS com desconto", () => {
  it("faturamento e margem do canal descontam o desconto", () => {
    const r = calcularROAS({
      vendasMes: [venda({ qtd: 1, preco: 100, custo: 60, desconto: 10, canal: 'Meta' })],
      gastosMes: [{ id: 'g', nome: 'x', valor: 30, categoria: 'Anúncios', recorrencia: 'mensal', data: null, canal: 'Meta' }],
      canais: [{ nome: 'Meta', tipo: 'pago' }],
    });
    expect(r[0].faturamento).toBe(90);    // 100 − 10
    expect(r[0].margemBruta).toBe(30);    // 90 − 60
    expect(r[0].roas).toBe(1);            // 30 / 30
  });
});

describe("teto MEI com desconto", () => {
  it("faturamento do ano desconta o desconto", () => {
    const s = statusTetoMEI({
      vendasAnoCorrente: [venda({ qtd: 10, preco: 100, custo: 60, desconto: 100, daysAgo: 30 })],
      teto: 81000, hoje: new Date('2026-05-23T12:00:00Z'),
    });
    expect(s.faturamentoAno).toBe(900); // 1000 − 100
  });
});
