import { describe, it, expect } from "vitest";
import { gerarInsights } from "@/lib/insights";

// Helper para construir uma venda mock
function venda(daysAgo: number, opts: { produto_id?: string; produto_nome?: string; qtd?: number; preco?: number; custo?: number }) {
  const now = new Date('2026-05-23T12:00:00Z');
  const created = new Date(now.getTime() - daysAgo * 86400000);
  return {
    id: `v-${Math.random()}`,
    produto_id: opts.produto_id ?? null,
    produto_nome: opts.produto_nome ?? null,
    quantidade: opts.qtd ?? 1,
    preco_venda: opts.preco ?? 100,
    custo_unit: opts.custo ?? 60,
    created_at: created.toISOString(),
  };
}

function produto(id: string, nome: string, opts: { categoria?: string; qtd?: number; custo?: number; preco?: number; validade?: string | null } = {}) {
  return {
    id,
    nome,
    categoria: opts.categoria ?? 'Whey',
    qtd_atual: opts.qtd ?? 5,
    custo_unit: opts.custo ?? 100,
    preco_venda: opts.preco ?? 200,
    validade: opts.validade ?? null,
  };
}

const HOJE = new Date('2026-05-23T12:00:00Z');

describe("gerarInsights", () => {
  it("retorna mensagem 'sem alertas' quando tudo está OK e não há vendas", () => {
    const insights = gerarInsights({ vendas60d: [], produtos: [], hoje: HOJE });
    expect(insights).toHaveLength(1);
    expect(insights[0].tipo).toBe('info');
    expect(insights[0].titulo).toBe('Sem alertas');
  });

  it("detecta produto bombando (vendas 7d ≥ 2× ritmo médio 30d)", () => {
    const vendas = [
      // 1 venda há 25 dias (média baixa)
      venda(25, { produto_nome: 'Whey DUX', qtd: 1 }),
      // 6 vendas nos últimos 7 dias
      venda(1, { produto_nome: 'Whey DUX', qtd: 2 }),
      venda(2, { produto_nome: 'Whey DUX', qtd: 2 }),
      venda(3, { produto_nome: 'Whey DUX', qtd: 2 }),
    ];
    const insights = gerarInsights({ vendas60d: vendas, produtos: [produto('p1', 'Whey DUX')], hoje: HOJE });
    const bombando = insights.find(i => i.titulo.includes('bombando'));
    expect(bombando).toBeDefined();
    expect(bombando!.tipo).toBe('positivo');
  });

  it("detecta produto parado (estoque > 0 e sem venda nos últimos 30 dias)", () => {
    const produtos = [
      produto('p1', 'Bem Casado', { qtd: 5, custo: 8 }),
      produto('p2', 'Whey vendendo', { qtd: 3, custo: 100 }),
    ];
    const vendas = [
      // venda recente apenas do whey
      venda(2, { produto_id: 'p2', produto_nome: 'Whey vendendo', qtd: 1 }),
    ];
    const insights = gerarInsights({ vendas60d: vendas, produtos, hoje: HOJE });
    const parado = insights.find(i => i.titulo.includes('parado'));
    expect(parado).toBeDefined();
    expect(parado!.tipo).toBe('alerta');
    expect(parado!.descricao).toContain('40.00'); // 5 * 8 = R$ 40,00 em capital parado
  });

  it("detecta produto vencendo em ≤ 60 dias com estoque", () => {
    const dataVencimento = new Date(HOJE.getTime() + 30 * 86400000).toISOString().split('T')[0];
    const produtos = [
      produto('p1', 'Whey Velho', { qtd: 3, custo: 100, validade: dataVencimento }),
    ];
    const insights = gerarInsights({ vendas60d: [], produtos, hoje: HOJE });
    const vencendo = insights.find(i => i.titulo.includes('vencendo'));
    expect(vencendo).toBeDefined();
    expect(vencendo!.tipo).toBe('alerta');
  });

  it("ignora produto vencido (dias < 0)", () => {
    const ontem = new Date(HOJE.getTime() - 86400000).toISOString().split('T')[0];
    const produtos = [
      produto('p1', 'Whey Já Venceu', { qtd: 3, validade: ontem }),
    ];
    const insights = gerarInsights({ vendas60d: [], produtos, hoje: HOJE });
    const vencendo = insights.find(i => i.titulo.includes('vencendo'));
    expect(vencendo).toBeUndefined();
  });

  it("detecta ruptura: sem estoque mas teve venda recente (perdendo venda)", () => {
    const produtos = [
      produto('p1', 'Creatina Esgotada', { qtd: 0, custo: 80 }),
    ];
    const vendas = [
      venda(5, { produto_id: 'p1', produto_nome: 'Creatina Esgotada', qtd: 1 }),
    ];
    const insights = gerarInsights({ vendas60d: vendas, produtos, hoje: HOJE });
    const ruptura = insights.find(i => i.titulo.includes('sem estoque'));
    expect(ruptura).toBeDefined();
    expect(ruptura!.tipo).toBe('oportunidade');
  });

  it("detecta margem baixa em categoria (< 25%)", () => {
    // Margem real: (60-50)/60 = ~16% — abaixo de 25%
    const vendas = [
      venda(3, { produto_id: 'p1', produto_nome: 'Whey Barato', qtd: 5, preco: 60, custo: 50 }),
    ];
    const produtos = [produto('p1', 'Whey Barato', { categoria: 'Whey' })];
    const insights = gerarInsights({ vendas60d: vendas, produtos, hoje: HOJE });
    const margemBaixa = insights.find(i => i.titulo.includes('Margem baixa'));
    expect(margemBaixa).toBeDefined();
    expect(margemBaixa!.tipo).toBe('alerta');
  });

  it("ordena alertas antes de positivos e info", () => {
    // Cria um cenário com vários insights de tipos diferentes
    const dataVencimento = new Date(HOJE.getTime() + 30 * 86400000).toISOString().split('T')[0];
    const produtos = [
      produto('p1', 'Vencendo', { qtd: 1, validade: dataVencimento }),
      produto('p2', 'Bombando', { qtd: 10 }),
    ];
    const vendas = [
      venda(40, { produto_id: 'p2', produto_nome: 'Bombando', qtd: 1 }),
      venda(2, { produto_id: 'p2', produto_nome: 'Bombando', qtd: 3 }),
      venda(3, { produto_id: 'p2', produto_nome: 'Bombando', qtd: 3 }),
    ];
    const insights = gerarInsights({ vendas60d: vendas, produtos, hoje: HOJE });
    // O primeiro deve ser sempre 'alerta' antes de 'positivo'
    const tipos = insights.map(i => i.tipo);
    const firstAlerta = tipos.indexOf('alerta');
    const firstPositivo = tipos.indexOf('positivo');
    if (firstAlerta !== -1 && firstPositivo !== -1) {
      expect(firstAlerta).toBeLessThan(firstPositivo);
    }
  });
});
