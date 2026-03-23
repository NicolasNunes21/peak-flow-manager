export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPercent(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function diasAtras(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function diaSemanaAbrev(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

export function getSaudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function getDataHojeCompleta(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('pt-BR', { month: 'long' });
  const year = d.getFullYear();
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap}, ${day} de ${month} de ${year}`;
}

export function getRecontatoDias(categoria: string): number {
  const map: Record<string, number> = {
    'Whey': 25, 'Creatina': 50, 'Pré-treino': 30, 'Sobremesa': 15, 'Vitamina': 60,
  };
  return map[categoria] || 30;
}

export function getWhatsAppScript(nome: string, categoria: string, diasSemCompra: number): string {
  const firstName = nome.split(' ')[0];
  if (diasSemCompra > 60) {
    return `Oi ${firstName}! Tudo bem? Aqui é o Nicolas da Peak Suplementos. Faz um tempo que a gente não se fala — queria saber se você tá precisando de alguma coisa. Chegaram produtos novos e tenho condições especiais pra clientes que conheço 🤝`;
  }
  const scripts: Record<string, string> = {
    'Whey': `Oi ${firstName}! 👋 Aqui é o Nicolas da Peak Suplementos. Seu whey tá chegando no fim? Posso reservar uma unidade pra você?`,
    'Creatina': `Oi ${firstName}! Nicolas da Peak aqui. Você já deve estar chegando na metade da sua creatina — manutenção constante é tudo né? 💪 Reposição disponível aqui, posso apartar pra você?`,
    'Pré-treino': `Oi ${firstName}! Nicolas da Peak. Seu pré-treino tá acabando em breve, certo? Tenho produto que chegou essa semana. Quer que eu reserve o seu?`,
    'Sobremesa': `Oi ${firstName}! Nicolas da Peak aqui 👋 A pasta de amendoim tá acabando? Chegou sabor novo essa semana. Passa na loja ou me fala que faço a entrega!`,
    'Vitamina': `Oi ${firstName}! Nicolas da Peak. Tudo bem? Seu suplemento deve estar quase no fim por agora. Posso já deixar reservado pra você? Assim você não fica sem!`,
  };
  return scripts[categoria] || scripts['Whey'];
}

export function margemColorClass(pct: number): string {
  if (pct >= 31) return 'text-success';
  if (pct >= 25) return 'text-warning';
  return 'text-destructive';
}

export function margemBgClass(pct: number): string {
  if (pct >= 31) return 'bg-success text-success-foreground';
  if (pct >= 25) return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}
