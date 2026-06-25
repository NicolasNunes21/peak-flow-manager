import { describe, it, expect } from "vitest";
import { gerarPautas, sinaisDeEstoque, melhorDiaSemana, metricasRetencao } from "@/lib/cmo";

const HOJE = new Date('2026-06-24T12:00:00Z');

function venda(opts: { nome?: string; qtd?: number; preco?: number; custo?: number; daysAgo?: number; cliente?: string }) {
  return {
    produto_id: null,
    produto_nome: opts.nome ?? 'Whey',
    quantidade: opts.qtd ?? 1,
    preco_venda: opts.preco ?? 100,
    custo_unit: opts.custo ?? 60,
    cliente_id: opts.cliente ?? null,
    created_at: new Date(HOJE.getTime() - (opts.daysAgo ?? 1) * 86400000).toISOString(),
  };
}

const produtos = [
  { id: 'a', nome: 'Whey FTW 900g', categoria: 'Whey', qtd_atual: 6, custo_unit: 60, preco_venda: 120 },
  { id: 'b', nome: 'Creatina Dux 300g', categoria: 'Creatina', qtd_atual: 5, custo_unit: 50, preco_venda: 100 },
  { id: 'c', nome: 'Liquidz Unidade', categoria: 'Vitamina', qtd_atual: 20, custo_unit: 3, preco_venda: 9.9 },
];

describe("sinaisDeEstoque", () => {
  it("identifica bombando e parados", () => {
    const vendas = [
      venda({ nome: 'Liquidz Unidade', qtd: 12, daysAgo: 3 }),
      venda({ nome: 'Creatina Dux 300g', qtd: 1, daysAgo: 3 }),
      // Whey FTW sem venda → parado
    ];
    const s = sinaisDeEstoque({ produtos, vendas, hoje: HOJE });
    expect(s.bombando[0].nome).toBe('Liquidz Unidade');
    expect(s.parados.some(p => p.nome === 'Whey FTW 900g')).toBe(true);
    expect(s.categorias).toContain('Whey');
  });
});

describe("gerarPautas", () => {
  it("sempre retorna ao menos uma pauta", () => {
    const pautas = gerarPautas({ produtos: [], vendas: [], hoje: HOJE });
    expect(pautas.length).toBeGreaterThan(0);
  });

  it("gera pauta de prova social quando há campeões de venda", () => {
    const vendas = [
      venda({ nome: 'Liquidz Unidade', qtd: 12, daysAgo: 2 }),
      venda({ nome: 'Creatina Dux 300g', qtd: 3, daysAgo: 2 }),
    ];
    const pautas = gerarPautas({ produtos, vendas, hoje: HOJE });
    expect(pautas.some(p => p.tipo === 'prova-social')).toBe(true);
  });

  it("a pauta principal muda conforme o dia (rotação)", () => {
    const vendas = [venda({ nome: 'Liquidz Unidade', qtd: 12, daysAgo: 2 })];
    const d1 = gerarPautas({ produtos, vendas, hoje: new Date('2026-06-24T12:00:00Z') })[0];
    const d2 = gerarPautas({ produtos, vendas, hoje: new Date('2026-06-25T12:00:00Z') })[0];
    expect(d1.tema).not.toBe(d2.tema); // rotação diária
  });

  it("toda pauta tem stories, legenda e hashtags", () => {
    const pautas = gerarPautas({ produtos, vendas: [venda({ nome: 'Liquidz Unidade', qtd: 12 })], hoje: HOJE });
    for (const p of pautas) {
      expect(p.stories.length).toBeGreaterThan(0);
      expect(p.legenda.length).toBeGreaterThan(0);
      expect(p.hashtags.length).toBeGreaterThan(0);
    }
  });
});

describe("melhorDiaSemana", () => {
  it("retorna o dia com maior faturamento", () => {
    // 2026-06-22 é segunda-feira
    const vendas = [
      { produto_nome: 'X', quantidade: 1, preco_venda: 500, custo_unit: 0, created_at: '2026-06-22T12:00:00Z' },
      { produto_nome: 'X', quantidade: 1, preco_venda: 50, custo_unit: 0, created_at: '2026-06-23T12:00:00Z' },
    ];
    const r = melhorDiaSemana(vendas);
    expect(r?.dia).toBe('Segunda');
  });
  it("retorna null sem vendas", () => {
    expect(melhorDiaSemana([])).toBeNull();
  });
});

describe("metricasRetencao", () => {
  it("calcula recompra, novos e inativos", () => {
    const clientes = [
      { id: 'c1', nome: 'Ana', data_primeira_compra: '2026-06-10', data_ultima_compra: '2026-06-20', total_acumulado: 300, canal_aquisicao: 'Instagram' },
      { id: 'c2', nome: 'Beto', data_primeira_compra: '2026-01-10', data_ultima_compra: '2026-03-01', total_acumulado: 800, canal_aquisicao: null },
    ];
    const vendas = [
      venda({ cliente: 'c1', daysAgo: 4 }), venda({ cliente: 'c1', daysAgo: 30 }), // recorrente
      venda({ cliente: 'c2', daysAgo: 120 }),
    ];
    const r = metricasRetencao({ clientes, vendas, hoje: HOJE });
    expect(r.novosMes).toBe(1);            // Ana entrou em junho
    expect(r.recorrentes).toBe(1);          // c1 com 2 compras
    expect(r.taxaRecompra).toBe(50);        // 1 de 2
    expect(r.inativos.some(c => c.id === 'c2')).toBe(true); // Beto 45+ dias
    expect(r.semOrigem).toBe(1);            // Beto sem canal
  });
});
