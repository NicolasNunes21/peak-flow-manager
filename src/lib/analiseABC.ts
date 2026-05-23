// Análise ABC (Curva de Pareto) por faturamento de produto
// Classe A: até 80% acumulado (carros-chefe)
// Classe B: 80-95% (importantes)
// Classe C: 95-100% (cauda longa)

export type Venda = {
  produto_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  preco_venda: number;
  custo_unit: number;
  desconto_rs?: number | null;
  created_at: string | null;
};

export type ItemABC = {
  produto_id: string | null;
  produto_nome: string;
  faturamento: number;
  margemBruta: number;
  quantidade: number;
  numVendas: number;
  pctFaturamento: number;
  pctAcumulado: number;
  classe: 'A' | 'B' | 'C';
};

export function calcularABC(vendas: Venda[]): ItemABC[] {
  if (vendas.length === 0) return [];

  // Agrupa por produto (chave = produto_id se existe; senão nome)
  const map = new Map<string, {
    nome: string;
    produto_id: string | null;
    fat: number;
    margem: number;
    qtd: number;
    n: number;
  }>();

  vendas.forEach(v => {
    const key = v.produto_id || v.produto_nome || 'sem-nome';
    const total = v.preco_venda * v.quantidade - Number(v.desconto_rs || 0);
    const custo = v.custo_unit * v.quantidade;
    const ex = map.get(key) ?? {
      nome: v.produto_nome || 'Sem nome',
      produto_id: v.produto_id,
      fat: 0, margem: 0, qtd: 0, n: 0,
    };
    ex.fat += total;
    ex.margem += total - custo;
    ex.qtd += v.quantidade;
    ex.n += 1;
    map.set(key, ex);
  });

  const arr = Array.from(map.values())
    .filter(x => x.fat > 0)
    .sort((a, b) => b.fat - a.fat);

  const totalFat = arr.reduce((s, x) => s + x.fat, 0);
  if (totalFat === 0) return [];

  let acumulado = 0;
  return arr.map(x => {
    const pct = (x.fat / totalFat) * 100;
    acumulado += pct;
    const classe: 'A' | 'B' | 'C' = acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C';
    return {
      produto_id: x.produto_id,
      produto_nome: x.nome,
      faturamento: x.fat,
      margemBruta: x.margem,
      quantidade: x.qtd,
      numVendas: x.n,
      pctFaturamento: pct,
      pctAcumulado: acumulado,
      classe,
    };
  });
}

export type ResumoABC = {
  total: number;
  contagem: { A: number; B: number; C: number };
  faturamento: { A: number; B: number; C: number };
  acaoSugerida: Record<'A' | 'B' | 'C', string>;
};

export function resumirABC(items: ItemABC[]): ResumoABC {
  const total = items.reduce((s, i) => s + i.faturamento, 0);
  const contagem = { A: 0, B: 0, C: 0 };
  const faturamento = { A: 0, B: 0, C: 0 };

  items.forEach(i => {
    contagem[i.classe]++;
    faturamento[i.classe] += i.faturamento;
  });

  return {
    total,
    contagem,
    faturamento,
    acaoSugerida: {
      A: 'Nunca pode faltar. Monitorar diariamente, negociar bem com fornecedor, espaço destacado.',
      B: 'Repor regularmente. Bom equilíbrio entre giro e margem — manter mix.',
      C: 'Avaliar: vale manter no mix? Considerar promoção ou descontinuar se não dá margem.',
    },
  };
}
