// CMO Peak — motor de marketing 100% local (sem IA, sem tokens).
// Gera a "pauta do dia" combinando sinais reais de estoque/vendas com uma
// biblioteca de roteiros. Funções puras → testáveis e independentes do Supabase.

export type VendaCMO = {
  produto_id?: string | null;
  produto_nome: string | null;
  quantidade: number;
  preco_venda: number;
  custo_unit: number;
  desconto_rs?: number | null;
  cliente_id?: string | null;
  created_at: string | null;
};

export type ProdutoCMO = {
  id: string;
  nome: string;
  categoria?: string | null;
  qtd_atual: number | null;
  custo_unit: number | null;
  preco_venda?: number | null;
};

// ============================================================
// Dados da loja (do material da Peak; editável depois)
// ============================================================
export const LOJA = {
  nome: 'Peak Suplementos',
  cidade: 'Cassino, RS',
  endereco: 'Rua Rio de Janeiro, 230 — Loja 11, Cassino/RS',
  whatsapp: '(53) 99970-7160',
  instagram: '@peaksuplementosrg',
};

// ============================================================
// Kit de marca — diretrizes de identidade e design
// ============================================================
export const MARCA = {
  cores: [
    { nome: 'Azul-marinho (base)', hex: '#0E2A47', uso: 'Fundo, blocos escuros' },
    { nome: 'Turquesa (assinatura)', hex: '#22B8CF', uso: 'Destaques, títulos, CTA' },
    { nome: 'Ciano claro', hex: '#7FE3F0', uso: 'Realces, gradiente do logo' },
    { nome: 'Branco', hex: '#FFFFFF', uso: 'Texto sobre foto, respiro' },
    { nome: 'Grafite', hex: '#1A2230', uso: 'Texto sobre fundo claro' },
  ],
  tipografia: 'Títulos em sans condensada itálica e pesada (estilo "LOJA ABERTA"). Corpo em sans limpa. SEMPRE caixa-alta nos títulos.',
  tom: 'Performance + qualidade de vida. Direto, motivacional, sem enrolação.',
  // A diretriz central que o Nicolas pediu: subir o nível da foto de produto
  fotografia: [
    'Produto em superfície limpa (madeira clara, mármore, fundo neutro) — não só na prateleira.',
    'Luz natural, bastante respiro/branco ao redor do produto.',
    'Estilizar com o contexto: whey ao lado de copo de leite, pasta com torrada/amendoim, creatina com a coqueteleira.',
    'Menos overlay turquesa cobrindo tudo — deixe o produto respirar. Use o overlay forte só em avisos/ofertas.',
    'Foco e nitidez no rótulo; fundo levemente desfocado (premium).',
  ],
  dos: [
    'Manter o turquesa + montanha como assinatura.',
    'Título curto e forte, 1 ideia por story.',
    'Sempre um CTA claro (chama no Whats / passa na loja / arrasta).',
  ],
  donts: [
    'Encher o story de texto.',
    'Foto escura/poluída de prateleira como destaque de produto.',
    'Mais de 1 chamada por arte.',
  ],
};

// ============================================================
// Calendário semanal sugerido (0=Dom ... 6=Sáb)
// ============================================================
export const CALENDARIO: { dia: number; label: string; foco: string }[] = [
  { dia: 1, label: 'Segunda', foco: 'Motivação + meta da semana' },
  { dia: 2, label: 'Terça', foco: 'Educativo (benefício de um produto)' },
  { dia: 3, label: 'Quarta', foco: 'Oferta / girar estoque parado' },
  { dia: 4, label: 'Quinta', foco: 'Prova social (mais vendidos)' },
  { dia: 5, label: 'Sexta', foco: 'Sugestão pro fim de semana / combo' },
  { dia: 6, label: 'Sábado', foco: 'Bastidor / loja / atendimento' },
  { dia: 0, label: 'Domingo', foco: 'Recompra / planejamento da semana' },
];

// ============================================================
// Biblioteca de roteiros de stories (por objetivo)
// ============================================================
export type Roteiro = { objetivo: string; quando: string; frames: string[]; cta: string };
export const ROTEIROS: Roteiro[] = [
  {
    objetivo: 'Lançamento / novidade',
    quando: 'Chegou produto novo',
    frames: [
      'Gancho: "Chegou novidade na Peak 👀" (foto do produto fechado, premium)',
      'O que é + para quem serve (1 frase)',
      'Benefício principal + preço',
      'CTA: "Corre que é limitado — chama no Whats"',
    ],
    cta: 'Chama no Whats / passa na loja',
  },
  {
    objetivo: 'Oferta / girar estoque',
    quando: 'Produto parado ou promoção',
    frames: [
      'Gancho com o problema ("Acabou seu whey?")',
      'A oferta clara (produto + preço/condição)',
      'Escassez ("últimas unidades")',
      'CTA direto',
    ],
    cta: 'Chama no Whats que eu separo',
  },
  {
    objetivo: 'Prova social',
    quando: 'Toda semana (campeões de venda)',
    frames: [
      '"Mais vendidos da semana na Peak 🔥"',
      'Top 3 com foto',
      'Enquete: "Qual é o seu?"',
    ],
    cta: 'Responde a enquete',
  },
  {
    objetivo: 'Educativo',
    quando: 'Construir autoridade',
    frames: [
      'Pergunta ("Pra que serve creatina?")',
      'Resposta simples em 1 frase',
      'Como usar / dose',
      'CTA: "Tenho aqui na loja"',
    ],
    cta: 'Passa na loja / arrasta',
  },
  {
    objetivo: 'Combo',
    quando: 'Aumentar ticket',
    frames: [
      '"Combo que faz sentido: Whey + Creatina"',
      'Por que juntos (1 frase)',
      'Preço do combo vs separado',
      'CTA',
    ],
    cta: 'Garante o combo no Whats',
  },
  {
    objetivo: 'Recompra',
    quando: 'Lembrar o cliente recorrente',
    frames: [
      '"Sua creatina já está acabando? ⏳"',
      'Lembrete do ciclo (dose diária)',
      'CTA: "Reservo a sua?"',
    ],
    cta: 'Reservo a sua?',
  },
  {
    objetivo: 'Bastidor / loja',
    quando: 'Aproximar / mostrar a loja',
    frames: [
      'Mostra a loja/atendimento (vídeo curto)',
      `Endereço: ${LOJA.endereco}`,
      'CTA: "Vem nos visitar!"',
    ],
    cta: 'Vem nos visitar',
  },
];

// ============================================================
// Sinais de estoque/venda
// ============================================================
function liq(v: VendaCMO) { return v.preco_venda * v.quantidade - Number(v.desconto_rs || 0); }

export type SinaisCMO = {
  bombando: { nome: string; qtd: number }[];
  parados: { nome: string; categoria: string; qtd: number; capital: number }[];
  destaque: { nome: string; preco: number }[];
  categorias: string[];
};

export function sinaisDeEstoque(opts: { produtos: ProdutoCMO[]; vendas: VendaCMO[]; hoje?: Date; janelaDias?: number }): SinaisCMO {
  const hoje = opts.hoje ?? new Date();
  const janela = opts.janelaDias ?? 14;
  const desde = new Date(hoje.getTime() - janela * 86400000);
  const desde30 = new Date(hoje.getTime() - 30 * 86400000);

  const vendidoJanela: Record<string, number> = {};
  const vendidos30 = new Set<string>();
  for (const v of opts.vendas) {
    if (!v.created_at || !v.produto_nome) continue;
    const d = new Date(v.created_at);
    if (d >= desde) vendidoJanela[v.produto_nome] = (vendidoJanela[v.produto_nome] || 0) + v.quantidade;
    if (d >= desde30) vendidos30.add(v.produto_nome);
  }

  const bombando = Object.entries(vendidoJanela)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, qtd]) => ({ nome, qtd }));

  const comEstoque = opts.produtos.filter(p => (p.qtd_atual ?? 0) > 0);

  const parados = comEstoque
    .filter(p => !vendidos30.has(p.nome) && (p.qtd_atual ?? 0) >= 2)
    .map(p => ({
      nome: p.nome,
      categoria: p.categoria || 'Outro',
      qtd: p.qtd_atual ?? 0,
      capital: (p.qtd_atual ?? 0) * (p.custo_unit ?? 0),
    }))
    .sort((a, b) => b.capital - a.capital);

  const destaque = comEstoque
    .filter(p => (p.preco_venda ?? 0) > 0)
    .map(p => ({ nome: p.nome, preco: p.preco_venda ?? 0 }))
    .sort((a, b) => b.preco - a.preco)
    .slice(0, 5);

  const categorias = [...new Set(comEstoque.map(p => p.categoria).filter(Boolean) as string[])];

  return { bombando, parados, destaque, categorias };
}

// ============================================================
// Pauta do dia
// ============================================================
export type StoryFrame = { titulo: string; texto: string };
export type Pauta = {
  tipo: 'oferta' | 'prova-social' | 'educativo' | 'combo' | 'destaque' | 'recompra' | 'loja';
  tema: string;
  porque: string;
  produtosFoco: string[];
  stories: StoryFrame[];
  legenda: string;
  hashtags: string[];
};

const HASHTAGS_BASE = ['#peaksuplementos', '#cassino', '#suplementos', '#foco', '#treino'];

const EDUCATIVO: Record<string, { pergunta: string; resposta: string }> = {
  Whey: { pergunta: 'Pra que serve o whey?', resposta: 'Proteína de absorção rápida pra recuperar e construir músculo. Pós-treino ou pra bater a meta de proteína do dia.' },
  Creatina: { pergunta: 'Por que tomar creatina todo dia?', resposta: 'Mais força e desempenho no treino. O segredo é a constância — 3-5g por dia, sempre.' },
  'Pré-treino': { pergunta: 'Pré-treino funciona?', resposta: 'Energia e foco pra render mais. Toma 20-30min antes e sente a diferença.' },
  Vitamina: { pergunta: 'Vale tomar multivitamínico?', resposta: 'Cobre o que a alimentação às vezes não dá. Imunidade e energia no dia a dia.' },
  Sobremesa: { pergunta: 'Doce sem sair da dieta?', resposta: 'Dá sim — pasta, barrinha e cremes proteicos matam a vontade e ainda somam proteína.' },
};

function pautaGirarParado(s: SinaisCMO): Pauta | null {
  if (!s.parados.length) return null;
  const top = s.parados[0];
  const mesmaCat = s.parados.filter(p => p.categoria === top.categoria).slice(0, 4);
  const lista = mesmaCat.length >= 2 ? mesmaCat.map(p => p.nome).join(', ') : top.nome;
  return {
    tipo: 'oferta',
    tema: `Girar ${top.categoria !== 'Outro' ? top.categoria : top.nome} parado`,
    porque: `${top.nome} está há 30+ dias sem giro (R$ ${top.capital.toFixed(0)} parados). Bom candidato pra empurrar.`,
    produtosFoco: mesmaCat.length >= 2 ? mesmaCat.map(p => p.nome) : [top.nome],
    stories: [
      { titulo: 'Gancho', texto: `Tá precisando repor ${top.categoria !== 'Outro' ? 'sua ' + top.categoria.toLowerCase() : 'esse item'}? 👀` },
      { titulo: 'Oferta', texto: `Temos ${lista} em estoque. Qualidade garantida e pronto pra retirar.` },
      { titulo: 'CTA', texto: `Algumas com últimas unidades. Chama no ${LOJA.whatsapp} que eu separo 👇` },
    ],
    legenda: `Bora repor sem sair do foco 💪 ${lista} te esperando aqui na Peak. Chama no direct ou no Whats!`,
    hashtags: HASHTAGS_BASE,
  };
}

function pautaProvaSocial(s: SinaisCMO): Pauta | null {
  if (s.bombando.length < 2) return null;
  const top3 = s.bombando.slice(0, 3);
  return {
    tipo: 'prova-social',
    tema: 'Campeões de venda da semana',
    porque: `${top3[0].nome} lidera com ${top3[0].qtd}un nos últimos 14 dias.`,
    produtosFoco: top3.map(p => p.nome),
    stories: [
      { titulo: 'Abre', texto: 'Mais vendidos da semana na Peak 🔥' },
      { titulo: 'Top 3', texto: top3.map((p, i) => `${i + 1}º ${p.nome}`).join('\n') },
      { titulo: 'Enquete', texto: 'Qual é o SEU? 👇 (enquete)' },
    ],
    legenda: `Os queridinhos da galera essa semana 🔥 Já provou? Conta aqui qual é o seu.`,
    hashtags: HASHTAGS_BASE,
  };
}

function pautaEducativo(s: SinaisCMO): Pauta | null {
  const cat = s.categorias.find(c => EDUCATIVO[c]) || s.categorias[0];
  if (!cat) return null;
  const e = EDUCATIVO[cat] || { pergunta: `Por que vale a pena ${cat}?`, resposta: 'Te ajuda a chegar mais perto do seu objetivo com constância.' };
  return {
    tipo: 'educativo',
    tema: `Educativo — ${cat}`,
    porque: `Conteúdo de autoridade sobre uma categoria que você tem em estoque.`,
    produtosFoco: [cat],
    stories: [
      { titulo: 'Pergunta', texto: e.pergunta },
      { titulo: 'Resposta', texto: e.resposta },
      { titulo: 'CTA', texto: `Tenho ${cat} aqui na loja — passa pra escolher a sua 👇` },
    ],
    legenda: `${e.pergunta} ${e.resposta} 💡 Qualquer dúvida, chama que a gente te orienta.`,
    hashtags: HASHTAGS_BASE,
  };
}

function pautaCombo(s: SinaisCMO): Pauta | null {
  const temWhey = s.categorias.includes('Whey');
  const temCrea = s.categorias.includes('Creatina');
  if (!(temWhey && temCrea)) return null;
  return {
    tipo: 'combo',
    tema: 'Combo Whey + Creatina',
    porque: 'Combo clássico que aumenta o ticket e faz sentido pro cliente.',
    produtosFoco: ['Whey', 'Creatina'],
    stories: [
      { titulo: 'Abre', texto: 'O combo que não pode faltar 💪' },
      { titulo: 'Por quê', texto: 'Whey constrói, creatina dá força. Juntos, resultado mais rápido.' },
      { titulo: 'CTA', texto: 'Combo com condição especial. Chama no Whats!' },
    ],
    legenda: 'Whey + Creatina = dupla campeã 🏆 Garante o seu combo aqui na Peak.',
    hashtags: HASHTAGS_BASE,
  };
}

function pautaDestaque(s: SinaisCMO): Pauta | null {
  if (!s.destaque.length) return null;
  const p = s.destaque[0];
  return {
    tipo: 'destaque',
    tema: `Destaque premium — ${p.nome}`,
    porque: 'Produto de ticket alto — ótimo pra foto premium e margem.',
    produtosFoco: [p.nome],
    stories: [
      { titulo: 'Hero shot', texto: `${p.nome} (foto premium, superfície limpa, bastante respiro)` },
      { titulo: 'Benefício', texto: 'Qualidade que você sente no resultado.' },
      { titulo: 'CTA', texto: 'Disponível na loja — vem conferir 👇' },
    ],
    legenda: `Qualidade de verdade faz diferença. ${p.nome} te esperando aqui na Peak ✨`,
    hashtags: HASHTAGS_BASE,
  };
}

function pautaRecompra(s: SinaisCMO): Pauta {
  const cat = s.categorias.includes('Creatina') ? 'Creatina' : s.categorias[0] || 'suplemento';
  return {
    tipo: 'recompra',
    tema: 'Lembrete de recompra',
    porque: 'Reativa quem já comprou — venda mais barata que conquistar cliente novo.',
    produtosFoco: [cat],
    stories: [
      { titulo: 'Gancho', texto: `Sua ${cat.toLowerCase()} já está acabando? ⏳` },
      { titulo: 'Lembrete', texto: 'Constância é tudo. Não deixa faltar e perder o ritmo.' },
      { titulo: 'CTA', texto: 'Reservo a sua reposição? Chama no Whats 👇' },
    ],
    legenda: 'Não deixa faltar e perder o progresso 💪 Reservo sua reposição, é só chamar.',
    hashtags: HASHTAGS_BASE,
  };
}

function pautaLoja(): Pauta {
  return {
    tipo: 'loja',
    tema: 'Venha nos visitar',
    porque: 'Conteúdo de presença/loja — sempre vale, principalmente fim de semana.',
    produtosFoco: [],
    stories: [
      { titulo: 'Abre', texto: 'LOJA ABERTA — vem nos visitar! 🏔️' },
      { titulo: 'Diferenciais', texto: 'Os melhores suplementos · as melhores marcas · atendimento personalizado' },
      { titulo: 'Local', texto: `${LOJA.endereco}` },
    ],
    legenda: `Bora treinar o shape e a dieta? Te esperamos na Peak — ${LOJA.endereco} 📍`,
    hashtags: HASHTAGS_BASE,
  };
}

// Gera as pautas disponíveis, rotacionadas pelo dia (muda todo dia).
export function gerarPautas(opts: { produtos: ProdutoCMO[]; vendas: VendaCMO[]; hoje?: Date }): Pauta[] {
  const hoje = opts.hoje ?? new Date();
  const s = sinaisDeEstoque({ produtos: opts.produtos, vendas: opts.vendas, hoje });

  const candidatos = [
    pautaGirarParado(s),
    pautaProvaSocial(s),
    pautaEducativo(s),
    pautaCombo(s),
    pautaDestaque(s),
    pautaRecompra(s),
    pautaLoja(),
  ].filter(Boolean) as Pauta[];

  if (candidatos.length === 0) return [pautaLoja()];

  // Rotação determinística por dia → a "pauta do dia" muda diariamente
  const diaIndex = Math.floor(hoje.getTime() / 86400000);
  const offset = diaIndex % candidatos.length;
  return [...candidatos.slice(offset), ...candidatos.slice(0, offset)];
}

// ============================================================
// Melhor dia da semana (proxy: quando você mais vende)
// ============================================================
export function melhorDiaSemana(vendas: VendaCMO[]): { dia: string; total: number } | null {
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const totais = new Array(7).fill(0);
  for (const v of vendas) {
    if (!v.created_at) continue;
    totais[new Date(v.created_at).getDay()] += liq(v);
  }
  const max = Math.max(...totais);
  if (max <= 0) return null;
  return { dia: nomes[totais.indexOf(max)], total: max };
}

// ============================================================
// Aquisição & retenção
// ============================================================
export type ClienteCMO = {
  id: string;
  data_primeira_compra?: string | null;
  data_ultima_compra?: string | null;
  total_acumulado?: number | null;
  nome?: string | null;
  canal_aquisicao?: string | null;
};

export function metricasRetencao(opts: { clientes: ClienteCMO[]; vendas: VendaCMO[]; hoje?: Date }) {
  const hoje = opts.hoje ?? new Date();
  const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const comprasPorCliente: Record<string, number> = {};
  for (const v of opts.vendas) {
    if (v.cliente_id) comprasPorCliente[v.cliente_id] = (comprasPorCliente[v.cliente_id] || 0) + 1;
  }
  const clientesComCompra = Object.keys(comprasPorCliente).length;
  const recorrentes = Object.values(comprasPorCliente).filter(n => n >= 2).length;
  const taxaRecompra = clientesComCompra > 0 ? (recorrentes / clientesComCompra) * 100 : 0;

  const novosMes = opts.clientes.filter(c => c.data_primeira_compra && new Date(c.data_primeira_compra) >= mesInicio).length;

  const inativos = opts.clientes
    .filter(c => {
      if (!c.data_ultima_compra) return false;
      const dias = Math.floor((hoje.getTime() - new Date(c.data_ultima_compra).getTime()) / 86400000);
      return dias >= 45;
    })
    .sort((a, b) => (b.total_acumulado || 0) - (a.total_acumulado || 0));

  // Origem dos clientes (atribuição) — quantos têm canal preenchido
  const porCanal: Record<string, number> = {};
  let semOrigem = 0;
  for (const c of opts.clientes) {
    if (c.canal_aquisicao) porCanal[c.canal_aquisicao] = (porCanal[c.canal_aquisicao] || 0) + 1;
    else semOrigem++;
  }

  return { clientesComCompra, recorrentes, taxaRecompra, novosMes, inativos, porCanal, semOrigem };
}
