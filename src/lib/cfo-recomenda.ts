// CFO Peak — engine de recomendação de alocação de capital
// Decisões priorizadas baseadas no cenário financeiro atual.
//
// Filosofia: tratar como um CFO real trataria uma loja iniciante.
// Caixa negativo? Para de investir, foca em margem.
// Reserva insuficiente? Constrói reserva antes de crescer.
// Reserva ok + ROAS bom? Cresce no canal que retorna.

import type { CanalROAS, DRE, StatusMEI } from "./cfo";

export type Recomendacao = {
  prioridade: 1 | 2 | 3;
  tipo: 'critico' | 'atencao' | 'oportunidade' | 'info';
  titulo: string;
  descricao: string;
  acoes: string[];
  naoFaca?: string[];
  valorEstimado?: number;
};

export type ProdutoSinal = {
  nome: string;
  qtd?: number;
  valor?: number;
};

export type EstadoFinanceiro = {
  dre: DRE;
  custoFixoMensal: number;          // só recorrência 'mensal'
  reservaCaixa: number;
  faturamento3mMedia: number;
  faturamentoTendencia: 'subindo' | 'estavel' | 'caindo';
  roasCanais: CanalROAS[];
  tetoMEI: StatusMEI;
  produtosBombando: ProdutoSinal[];   // vendendo bem
  produtosParados: ProdutoSinal[];    // estoque sem giro
  produtosRuptura: ProdutoSinal[];    // sem estoque com demanda
  margemMediaSetor?: number;          // benchmark (35% padrão pra suplementos)
};

const MARGEM_SAUDAVEL = 35;
const RUNWAY_MIN_MESES = 3;
const ROAS_BOM = 3;
const ROAS_RUIM = 1.5;

export function gerarRecomendacoes(estado: EstadoFinanceiro): Recomendacao[] {
  const recs: Recomendacao[] = [];
  const { dre, custoFixoMensal, reservaCaixa, roasCanais, tetoMEI } = estado;

  const resultadoLiquido = dre.resultadoLiquido;
  const queimaMensal = -Math.min(resultadoLiquido, 0); // positivo quando perdendo
  // Runway "real": meses que a reserva sobrevive contra o que sai de obrigatório (custo fixo).
  // Métrica de CFO: "se eu zerar venda agora, opero quantos meses?"
  const runwayMeses = custoFixoMensal > 0
    ? reservaCaixa / custoFixoMensal
    : Infinity;

  // ============================================================
  // CENÁRIO 1: RESULTADO LÍQUIDO NEGATIVO (sangrando)
  // ============================================================
  if (resultadoLiquido < 0) {
    const acoes: string[] = [];

    // Sugestão 1: aumentar margem se estiver baixa
    if (dre.margemBrutaPct < MARGEM_SAUDAVEL) {
      const ganhoPotencial = dre.receitaBruta * 0.05; // +5pp
      acoes.push(
        `Aumentar margem em 5pp (${dre.margemBrutaPct.toFixed(0)}% → ${(dre.margemBrutaPct + 5).toFixed(0)}%): renegociar fornecedor dos top vendidos ou ajustar preço. Impacto estimado: +${formatBR(ganhoPotencial)}/mês`
      );
    }

    // Sugestão 2: liquidar estoque parado pra fazer caixa
    if (estado.produtosParados.length > 0) {
      const totalParado = estado.produtosParados.reduce((s, p) => s + (p.valor || 0), 0);
      acoes.push(
        `Liquidar estoque parado (${formatBR(totalParado)} em ${estado.produtosParados.length} SKU) com promoção. Vira caixa imediato.`
      );
    }

    // Sugestão 3: canais orgânicos (custo zero)
    acoes.push(
      `Crescer via canais orgânicos: Instagram (3 posts/semana), indicação com cupom, parcerias de troca (não pagas). Custo zero, retorno em 4-8 semanas.`
    );

    // Sugestão 4: cortar gastos não essenciais se houver
    const gastosNaoEssenciais = (dre.gastosPorCategoria['Marketing'] || 0)
      + (dre.gastosPorCategoria['Anúncios'] || 0)
      + (dre.gastosPorCategoria['Parceria'] || 0);
    if (gastosNaoEssenciais > 0) {
      acoes.push(
        `Pausar gastos com Marketing/Anúncios/Parceria (${formatBR(gastosNaoEssenciais)}/mês) até reverter o resultado.`
      );
    }

    const descricao = runwayMeses === Infinity
      ? `Você fecha o mês negativo em ${formatBR(queimaMensal)}. Sem reserva cadastrada — todo mês negativo vira pressão direta.`
      : runwayMeses < 1
        ? `Você queima ${formatBR(queimaMensal)}/mês e sua reserva acaba em ${runwayMeses.toFixed(1)} mês. URGENTE.`
        : `Você queima ${formatBR(queimaMensal)}/mês. Sua reserva (${formatBR(reservaCaixa)}) cobre ${runwayMeses.toFixed(1)} meses se nada mudar.`;

    recs.push({
      prioridade: 1,
      tipo: 'critico',
      titulo: 'Pare a sangria — não invista até virar o caixa',
      descricao,
      acoes,
      naoFaca: [
        'Aumentar estoque (capital fica preso)',
        'Investir em anúncios pagos (ROAS imprevisível pra loja iniciante)',
        'Parcerias com custo fixo',
      ],
      valorEstimado: queimaMensal,
    });

    // Mesmo em cenário crítico, mostrar teto MEI se for crítico
    addTetoMEI(recs, tetoMEI, 2);
    return recs;
  }

  // ============================================================
  // CENÁRIO 2: EBITDA POSITIVO mas RESERVA INSUFICIENTE
  // ============================================================
  if (runwayMeses < RUNWAY_MIN_MESES) {
    const meta = custoFixoMensal * RUNWAY_MIN_MESES;
    const faltam = Math.max(meta - reservaCaixa, 0);
    const mesesParaMeta = resultadoLiquido > 0 ? Math.ceil(faltam / (resultadoLiquido * 0.7)) : Infinity;

    recs.push({
      prioridade: 1,
      tipo: 'atencao',
      titulo: 'Construa reserva de 3 meses antes de novos investimentos',
      descricao: `Sua reserva (${formatBR(reservaCaixa)}) cobre ${runwayMeses === Infinity ? '∞' : runwayMeses.toFixed(1)} mês. Saudável: ${RUNWAY_MIN_MESES}+ meses (${formatBR(meta)}). Faltam ${formatBR(faltam)}.`,
      acoes: [
        `Direcionar 70% do lucro líquido (${formatBR(resultadoLiquido * 0.7)}/mês) para reserva. Meta atingida em ~${mesesParaMeta === Infinity ? '?' : mesesParaMeta} meses.`,
        `Os outros 30% (${formatBR(resultadoLiquido * 0.3)}) podem ir pra reposição de top-sellers e pequenos testes de marketing orgânico.`,
      ],
      naoFaca: [
        'Ads pagos acima de 5% do faturamento',
        'Compras grandes de estoque novo (preferir reposição do que já vende)',
      ],
      valorEstimado: resultadoLiquido,
    });
  }

  // ============================================================
  // CENÁRIO 3: RESERVA OK — pode investir com critério
  // ============================================================
  const reservaOk = runwayMeses >= RUNWAY_MIN_MESES;
  if (reservaOk && resultadoLiquido > 0) {
    // Avaliar canais pagos com ROAS bom
    const canaisPagosComROAS = roasCanais.filter(c => c.gasto > 0);
    const canalGanhador = canaisPagosComROAS.find(c => c.roas !== null && c.roas >= ROAS_BOM);
    const canalPerdedor = canaisPagosComROAS.find(c => c.roas !== null && c.roas < ROAS_RUIM);

    if (canalGanhador) {
      const sugerido = canalGanhador.gasto * 2;
      const retornoEsperado = sugerido * (canalGanhador.roas ?? 0);
      recs.push({
        prioridade: 1,
        tipo: 'oportunidade',
        titulo: `${canalGanhador.canal} converte bem — escale com cautela`,
        descricao: `ROAS ${canalGanhador.roas!.toFixed(1)}x: cada R$1 gasto retorna ${formatBR(canalGanhador.roas!)} em margem.`,
        acoes: [
          `Dobrar gasto gradualmente para ${formatBR(sugerido)}/mês. Manter olho no ROAS — se cair abaixo de 2x, voltar.`,
          `Retorno estimado: ${formatBR(retornoEsperado)} em margem.`,
        ],
        valorEstimado: sugerido,
      });
    }

    if (canalPerdedor) {
      recs.push({
        prioridade: 2,
        tipo: 'atencao',
        titulo: `${canalPerdedor.canal} está queimando dinheiro`,
        descricao: `ROAS ${canalPerdedor.roas!.toFixed(1)}x — abaixo do mínimo viável (1.5x).`,
        acoes: [
          `Pausar ou reduzir esse canal. Realocar verba para canais orgânicos ou ${canalGanhador ? canalGanhador.canal : 'experimentar outro canal'}.`,
        ],
      });
    }

    // Ruptura de estoque (vendas perdidas)
    if (estado.produtosRuptura.length > 0) {
      recs.push({
        prioridade: canalGanhador ? 2 : 1,
        tipo: 'oportunidade',
        titulo: 'Reponha produtos em ruptura',
        descricao: `${estado.produtosRuptura.length} item(ns) sem estoque com demanda recente — você está perdendo venda agora.`,
        acoes: estado.produtosRuptura.slice(0, 3).map(p => `Comprar ${p.nome}`),
      });
    }

    // Alocação sugerida da sobra
    recs.push({
      prioridade: 3,
      tipo: 'info',
      titulo: 'Alocação sugerida do lucro líquido',
      descricao: `Lucro líquido de ${formatBR(resultadoLiquido)}/mês — distribuição recomendada:`,
      acoes: [
        `40% reserva: ${formatBR(resultadoLiquido * 0.4)}`,
        `30% reposição estoque: ${formatBR(resultadoLiquido * 0.3)}`,
        `20% marketing (canal ${canalGanhador ? canalGanhador.canal : 'orgânico ou teste pequeno'}): ${formatBR(resultadoLiquido * 0.2)}`,
        `10% distribuição entre sócios: ${formatBR(resultadoLiquido * 0.1)}`,
      ],
    });
  }

  // ============================================================
  // CENÁRIO 4: BREAK-EVEN OU NEUTRO (pra completar o roteiro)
  // ============================================================
  if (resultadoLiquido === 0 || (resultadoLiquido > 0 && runwayMeses === Infinity && recs.length === 0)) {
    recs.push({
      prioridade: 2,
      tipo: 'atencao',
      titulo: 'Resultado próximo de zero — foco em margem',
      descricao: 'Você está em break-even. Qualquer redução de receita vira prejuízo. Margem é a alavanca mais segura.',
      acoes: [
        'Subir preço de venda em produtos com pouca elasticidade (creatina, vitamina)',
        'Renegociar fornecedor dos top-3 produtos',
      ],
    });
  }

  // ============================================================
  // Teto MEI — adiciona em qualquer cenário se relevante
  // ============================================================
  addTetoMEI(recs, tetoMEI, 2);

  // ============================================================
  // Margem abaixo do setor (benchmark)
  // ============================================================
  if (dre.margemBrutaPct > 0 && dre.margemBrutaPct < MARGEM_SAUDAVEL - 2) {
    const idx = recs.findIndex(r => r.prioridade === 3);
    recs.splice(idx >= 0 ? idx : recs.length, 0, {
      prioridade: 2,
      tipo: 'atencao',
      titulo: 'Margem bruta abaixo do benchmark de suplementos',
      descricao: `Setor saudável: ≥${MARGEM_SAUDAVEL}%. Você: ${dre.margemBrutaPct.toFixed(1)}%. Cada 1pp = +${formatBR(dre.receitaBruta * 0.01)}/mês com mesmo volume.`,
      acoes: [
        'Análise produto-a-produto: identifique os 3 com pior margem',
        'Estratégias: renegociar com fornecedor, mudar mix para itens com margem maior (creatina, marcas próprias)',
      ],
    });
  }

  return recs.sort((a, b) => a.prioridade - b.prioridade);
}

function addTetoMEI(recs: Recomendacao[], tetoMEI: StatusMEI, prioridade: 1 | 2 | 3) {
  if (tetoMEI.status === 'ok') return;
  const ultraMes = tetoMEI.ultrapassaEmMes;
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const descricao = tetoMEI.status === 'critico'
    ? `${tetoMEI.pctUsado.toFixed(0)}% do teto MEI atingido (${formatBR(tetoMEI.faturamentoAno)} de ${formatBR(tetoMEI.teto)}). Restam ${formatBR(tetoMEI.restante)}.`
    : tetoMEI.status === 'risco'
    ? `${tetoMEI.pctUsado.toFixed(0)}% usado. Projeção fim do ano: ${formatBR(tetoMEI.projecaoFimAno)}. ${ultraMes ? `Pode estourar em ${meses[ultraMes - 1]}.` : ''}`
    : `Projeção fim do ano (${formatBR(tetoMEI.projecaoFimAno)}) pode passar do teto (${formatBR(tetoMEI.teto)}).`;

  recs.push({
    prioridade: tetoMEI.status === 'critico' ? 1 : prioridade,
    tipo: tetoMEI.status === 'critico' ? 'critico' : 'atencao',
    titulo: tetoMEI.status === 'critico' ? 'TETO MEI no limite' : `Atenção ao teto MEI`,
    descricao,
    acoes: [
      'Consultar contador para planejar transição para ME (tributação muda completamente)',
      'Se possível, dividir vendas com sócio em CPFs separados (esquema MEI duplo)',
      'Antecipar para o próximo regime: simulação de Simples Nacional',
    ],
  });
}

function formatBR(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
