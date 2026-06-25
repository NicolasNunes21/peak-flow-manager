import { describe, it, expect } from "vitest";
import {
  calcularMargemContribuicao, calcularBreakEven, analisarEstoque, curvaABC,
  calcularRecebiveis, variacaoPct, TAXAS_PGTO_DEFAULT,
} from "@/lib/cfo";

const HOJE = new Date('2026-05-23T12:00:00Z');

function venda(opts: { qtd?: number; preco?: number; custo?: number; desconto?: number; pgto?: string; nome?: string; id?: string; daysAgo?: number } = {}) {
  return {
    id: `v-${Math.random()}`,
    produto_id: opts.id ?? null,
    produto_nome: opts.nome ?? 'Whey',
    quantidade: opts.qtd ?? 1,
    preco_venda: opts.preco ?? 100,
    custo_unit: opts.custo ?? 60,
    desconto_rs: opts.desconto ?? 0,
    canal: 'Loja',
    forma_pgto: opts.pgto ?? 'PIX',
    created_at: new Date(HOJE.getTime() - (opts.daysAgo ?? 1) * 86400000).toISOString(),
  };
}

describe("margem de contribuição", () => {
  it("desconta a taxa de cartão (crédito 3,5%)", () => {
    // PIX: 100 − 60 = 40 (taxa 0). Crédito: 100 − 60 − 3,5 = 36,5
    const mc = calcularMargemContribuicao({ vendas: [venda({ pgto: 'Crédito' })] });
    expect(mc.receitaLiquida).toBe(100);
    expect(mc.cmv).toBe(60);
    expect(mc.taxasCartao).toBeCloseTo(3.5, 2);
    expect(mc.margemContribuicao).toBeCloseTo(36.5, 2);
    expect(mc.mcPct).toBeCloseTo(36.5, 2);
  });
  it("PIX não tem taxa", () => {
    const mc = calcularMargemContribuicao({ vendas: [venda({ pgto: 'PIX' })] });
    expect(mc.taxasCartao).toBe(0);
    expect(mc.margemContribuicao).toBe(40);
  });
});

describe("break-even real", () => {
  it("usa margem de contribuição, não margem bruta", () => {
    // 10 vendas PIX de 100 (custo 60) → MC% = 40%. Custo fixo 2000 → BE = 5000
    const vendas = Array.from({ length: 10 }, () => venda({ pgto: 'PIX' }));
    const be = calcularBreakEven({ vendas, custoFixoMensal: 2000 });
    expect(be.mcPct).toBeCloseTo(40, 1);
    expect(be.breakEvenRs).toBeCloseTo(5000, 0);
    expect(be.ticketMedio).toBe(100);
    expect(be.vendasParaBE).toBe(50);
    expect(be.atingido).toBe(false);
  });
  it("break-even infinito quando MC ≤ 0", () => {
    const be = calcularBreakEven({ vendas: [venda({ preco: 50, custo: 60 })], custoFixoMensal: 1000 });
    expect(be.breakEvenRs).toBe(Infinity);
  });
});

describe("análise de estoque", () => {
  it("calcula cobertura em dias e marca status", () => {
    const produtos = [
      { id: 'a', nome: 'Whey', qtd_atual: 30, custo_unit: 60 },   // vende 1/dia → 30 dias = saudável
      { id: 'b', nome: 'Creatina', qtd_atual: 100, custo_unit: 50 }, // sem venda → parado
      { id: 'c', nome: 'Pré', qtd_atual: 2, custo_unit: 40 },      // vende muito → baixo
    ];
    // 30 un de Whey nos últimos 30d = 1/dia ; 14 un de Pré em 30d ≈ 0.47/dia → cobertura ~4 dias
    const vendas = [
      ...Array.from({ length: 30 }, () => venda({ id: 'a', nome: 'Whey', daysAgo: 5 })),
      ...Array.from({ length: 14 }, () => venda({ id: 'c', nome: 'Pré', daysAgo: 5 })),
    ];
    const r = analisarEstoque({ produtos, vendas, hoje: HOJE });
    const whey = r.itens.find(i => i.id === 'a')!;
    const crea = r.itens.find(i => i.id === 'b')!;
    const pre = r.itens.find(i => i.id === 'c')!;
    expect(whey.coberturaDias).toBeCloseTo(30, 0);
    expect(whey.status).toBe('saudavel');
    expect(crea.status).toBe('parado');
    expect(crea.coberturaDias).toBeNull();
    expect(pre.status).toBe('baixo');
    expect(r.capitalTotal).toBe(30 * 60 + 100 * 50 + 2 * 40);
    expect(r.paradosValor).toBe(100 * 50);
  });
});

describe("curva ABC", () => {
  it("classifica produtos por participação na receita", () => {
    const vendas = [
      venda({ nome: 'A', preco: 800, qtd: 1 }),
      venda({ nome: 'B', preco: 150, qtd: 1 }),
      venda({ nome: 'C', preco: 50, qtd: 1 }),
    ];
    const abc = curvaABC(vendas);
    expect(abc[0].nome).toBe('A');
    expect(abc[0].classe).toBe('A'); // 80% do total
    expect(abc.find(x => x.nome === 'C')!.classe).toBe('C');
  });
  it("retorna vazio sem vendas", () => {
    expect(curvaABC([])).toEqual([]);
  });
});

describe("recebíveis (fluxo de caixa real)", () => {
  it("crédito D+30 fica 'a receber'; PIX cai na hora", () => {
    const vendas = [
      venda({ pgto: 'PIX', preco: 100, daysAgo: 0 }),       // cai na hora
      venda({ pgto: 'Crédito', preco: 100, daysAgo: 0 }),   // cai em D+30
    ];
    const r = calcularRecebiveis({ vendas, hoje: HOJE });
    // crédito: 100 × (1 − 0,035) = 96,5 a receber
    expect(r.aReceberTotal).toBeCloseTo(96.5, 2);
    expect(r.proximos30d).toBeCloseTo(96.5, 2);
  });
});

describe("variação percentual", () => {
  it("calcula delta", () => {
    expect(variacaoPct(120, 100)).toBe(20);
    expect(variacaoPct(80, 100)).toBe(-20);
  });
  it("base zero não é comparável", () => {
    expect(variacaoPct(100, 0)).toBeNull();
    expect(variacaoPct(0, 0)).toBe(0);
  });
});
