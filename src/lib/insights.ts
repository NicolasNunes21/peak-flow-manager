export type InsightTipo = 'alerta' | 'oportunidade' | 'positivo' | 'info';

export type Insight = {
  tipo: InsightTipo;
  titulo: string;
  descricao: string;
  acao?: string;
};

type Venda = {
  id: string;
  produto_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  preco_venda: number;
  custo_unit: number;
  desconto_rs?: number | null;
  created_at: string | null;
};

type Produto = {
  id: string;
  nome: string;
  categoria: string | null;
  qtd_atual: number | null;
  custo_unit: number | null;
  preco_venda: number | null;
  validade: string | null;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfPrevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

/**
 * Gera lista de insights acionáveis para a tela. Heurísticas:
 *  - Margem por categoria caiu vs mês passado (≥ 3pp)
 *  - Categoria com margem média no mês < 25%
 *  - Produto bombando (vendas últimos 7d ≥ 2× média diária últimos 30d)
 *  - Produto parado (estoque > 0 e sem venda nos últimos 30d)
 *  - Vencendo em ≤ 60 dias com estoque
 *  - Sem estoque mas teve venda nos últimos 14d (perdendo venda)
 */
export function gerarInsights(opts: {
  vendas60d: Venda[];      // vendas dos últimos 60 dias
  produtos: Produto[];      // catálogo completo
  hoje?: Date;
}): Insight[] {
  const hoje = opts.hoje ?? new Date();
  const monthStart = startOfMonth(hoje);
  const prevMonthStart = startOfPrevMonth(hoje);
  const last7 = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last14 = new Date(hoje.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last30 = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

  const out: Insight[] = [];

  const vendasMesAtual = opts.vendas60d.filter(v => v.created_at && new Date(v.created_at) >= monthStart);
  const vendasMesAnterior = opts.vendas60d.filter(v => {
    if (!v.created_at) return false;
    const d = new Date(v.created_at);
    return d >= prevMonthStart && d < monthStart;
  });
  const vendas7d = opts.vendas60d.filter(v => v.created_at && new Date(v.created_at) >= last7);
  const vendas14d = opts.vendas60d.filter(v => v.created_at && new Date(v.created_at) >= last14);
  const vendas30d = opts.vendas60d.filter(v => v.created_at && new Date(v.created_at) >= last30);

  // === Margem por categoria — comparação mês atual vs anterior ===
  const catNomeParaCategoria = new Map<string, string>();
  opts.produtos.forEach(p => {
    if (p.nome && p.categoria) catNomeParaCategoria.set(p.nome, p.categoria);
  });
  const margemCat = (vendas: Venda[]) => {
    const map: Record<string, { fat: number; custo: number }> = {};
    vendas.forEach(v => {
      const cat = (v.produto_id && opts.produtos.find(p => p.id === v.produto_id)?.categoria)
        || (v.produto_nome && catNomeParaCategoria.get(v.produto_nome))
        || 'Outro';
      if (!map[cat]) map[cat] = { fat: 0, custo: 0 };
      map[cat].fat += v.preco_venda * v.quantidade - Number(v.desconto_rs || 0);
      map[cat].custo += v.custo_unit * v.quantidade;
    });
    const result: Record<string, number> = {};
    Object.entries(map).forEach(([cat, d]) => {
      result[cat] = d.fat > 0 ? ((d.fat - d.custo) / d.fat) * 100 : 0;
    });
    return result;
  };
  const margensAtual = margemCat(vendasMesAtual);
  const margensAnt = margemCat(vendasMesAnterior);
  Object.entries(margensAtual).forEach(([cat, mAtual]) => {
    const mAnt = margensAnt[cat];
    if (mAnt !== undefined && mAnt > 0 && mAtual < mAnt - 3) {
      out.push({
        tipo: 'alerta',
        titulo: `Margem em ${cat} caiu`,
        descricao: `De ${mAnt.toFixed(1)}% no mês passado para ${mAtual.toFixed(1)}% este mês (${(mAtual - mAnt).toFixed(1)}pp).`,
        acao: 'Reveja preço de venda ou custo dessa categoria.',
      });
    }
    if (mAtual > 0 && mAtual < 25) {
      out.push({
        tipo: 'alerta',
        titulo: `Margem baixa em ${cat}`,
        descricao: `${mAtual.toFixed(1)}% este mês — abaixo de 25% considerado saudável.`,
        acao: 'Considere reajuste de preço ou trocar de fornecedor.',
      });
    }
  });

  // === Top giro: produto bombando últimos 7d vs média 30d ===
  type ProdMov = { nome: string; qtd7: number; qtd30: number };
  const movMap: Record<string, ProdMov> = {};
  vendas30d.forEach(v => {
    const k = v.produto_nome || '';
    if (!k) return;
    if (!movMap[k]) movMap[k] = { nome: k, qtd7: 0, qtd30: 0 };
    movMap[k].qtd30 += v.quantidade;
  });
  vendas7d.forEach(v => {
    const k = v.produto_nome || '';
    if (!k) return;
    if (!movMap[k]) movMap[k] = { nome: k, qtd7: 0, qtd30: 0 };
    movMap[k].qtd7 += v.quantidade;
  });
  const bombando = Object.values(movMap)
    .filter(p => p.qtd7 >= 3 && p.qtd7 >= (p.qtd30 / 30) * 7 * 2)
    .sort((a, b) => b.qtd7 - a.qtd7)
    .slice(0, 3);
  bombando.forEach(p => {
    out.push({
      tipo: 'positivo',
      titulo: `${p.nome} bombando`,
      descricao: `Vendeu ${p.qtd7} un nos últimos 7 dias — bem acima da média.`,
      acao: 'Considere reforçar o estoque antes que falte.',
    });
  });

  // === Produtos parados (estoque > 0, sem venda últimos 30d) ===
  const vendidosUltimos30 = new Set(vendas30d.map(v => v.produto_id).filter(Boolean));
  const vendidosUltimos30Nome = new Set(vendas30d.map(v => v.produto_nome).filter(Boolean));
  const parados = opts.produtos.filter(p =>
    (p.qtd_atual ?? 0) > 0 &&
    !vendidosUltimos30.has(p.id) &&
    !vendidosUltimos30Nome.has(p.nome)
  );
  if (parados.length > 0) {
    const totalCapital = parados.reduce((s, p) => s + (p.qtd_atual ?? 0) * (p.custo_unit ?? 0), 0);
    out.push({
      tipo: 'alerta',
      titulo: `${parados.length} produto${parados.length !== 1 ? 's' : ''} parado${parados.length !== 1 ? 's' : ''} há 30+ dias`,
      descricao: `R$ ${totalCapital.toFixed(2)} parados em ${parados.length} SKU(s) sem venda recente.`,
      acao: 'Considere promoção, combo ou trocar de mix.',
    });
  }

  // === Vencendo em ≤ 60 dias com estoque ===
  const vencendo = opts.produtos.filter(p => {
    if (!p.validade || (p.qtd_atual ?? 0) <= 0) return false;
    const dias = Math.floor((new Date(p.validade).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return dias >= 0 && dias <= 60;
  });
  if (vencendo.length > 0) {
    const totalCapital = vencendo.reduce((s, p) => s + (p.qtd_atual ?? 0) * (p.custo_unit ?? 0), 0);
    out.push({
      tipo: 'alerta',
      titulo: `${vencendo.length} produto${vencendo.length !== 1 ? 's' : ''} vencendo em ≤ 60 dias`,
      descricao: `R$ ${totalCapital.toFixed(2)} a perder se não vender. Veja: ${vencendo.slice(0, 3).map(p => p.nome).join(', ')}${vencendo.length > 3 ? '…' : ''}`,
      acao: 'Aplicar desconto progressivo ou destacar na vitrine.',
    });
  }

  // === Sem estoque mas teve venda recente (perdendo venda) ===
  const ruptura = opts.produtos.filter(p => {
    if ((p.qtd_atual ?? 0) > 0) return false;
    return vendas14d.some(v => v.produto_id === p.id || v.produto_nome === p.nome);
  });
  if (ruptura.length > 0) {
    out.push({
      tipo: 'oportunidade',
      titulo: `${ruptura.length} produto${ruptura.length !== 1 ? 's' : ''} sem estoque com demanda recente`,
      descricao: `Você está perdendo venda. Itens: ${ruptura.slice(0, 3).map(p => p.nome).join(', ')}${ruptura.length > 3 ? '…' : ''}`,
      acao: 'Comprar urgentemente.',
    });
  }

  // === Empty state friendly ===
  if (out.length === 0) {
    out.push({
      tipo: 'info',
      titulo: 'Sem alertas',
      descricao: 'Margem, estoque e validades estão dentro do esperado.',
    });
  }

  // Ordem: alertas → oportunidades → positivos → info
  const ordem: Record<InsightTipo, number> = { alerta: 0, oportunidade: 1, positivo: 2, info: 3 };
  out.sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);

  return out;
}

