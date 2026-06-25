import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { gerarPautas, melhorDiaSemana, metricasRetencao, CALENDARIO, ROTEIROS, MARCA, LOJA, type Pauta } from "@/lib/cmo";
import { Megaphone, Calendar, Palette, Camera, Users, Copy, Check, ChevronDown, ChevronUp, MapPin, Lightbulb, TrendingUp, Sparkles, MessageCircle } from "lucide-react";

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copiado!" : label}
    </button>
  );
}

function pautaToText(p: Pauta): string {
  const stories = p.stories.map((s, i) => `Story ${i + 1} (${s.titulo}): ${s.texto}`).join('\n');
  return `PAUTA: ${p.tema}\n\n${stories}\n\nLegenda: ${p.legenda}\n\n${p.hashtags.join(' ')}`;
}

const TIPO_LABEL: Record<Pauta['tipo'], string> = {
  oferta: 'Oferta', 'prova-social': 'Prova social', educativo: 'Educativo',
  combo: 'Combo', destaque: 'Destaque', recompra: 'Recompra', loja: 'Loja',
};

function PautaCard({ p, principal }: { p: Pauta; principal?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 space-y-3 ${principal ? 'bg-gradient-to-br from-primary/10 to-secondary/5 border border-primary/30' : 'bg-card card-elev'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-bold">{TIPO_LABEL[p.tipo]}</span>
            {principal && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">Pauta de hoje</span>}
          </div>
          <h3 className="text-sm font-bold mt-1.5">{p.tema}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{p.porque}</p>
        </div>
        <CopyButton text={pautaToText(p)} label="Copiar tudo" />
      </div>

      <div className="space-y-1.5">
        {p.stories.map((s, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="shrink-0 w-5 h-5 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
            <p className="text-xs"><span className="font-semibold text-secondary">{s.titulo}:</span> {s.texto}</p>
          </div>
        ))}
      </div>

      <div className="bg-muted/40 rounded-lg p-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legenda</p>
          <CopyButton text={`${p.legenda}\n\n${p.hashtags.join(' ')}`} />
        </div>
        <p className="text-xs">{p.legenda}</p>
        <p className="text-[10px] text-primary">{p.hashtags.join(' ')}</p>
      </div>
    </div>
  );
}

export default function CMOPeak() {
  const today = new Date();
  const [showRoteiros, setShowRoteiros] = useState(false);
  const [showMarca, setShowMarca] = useState(false);
  const [altOpen, setAltOpen] = useState(false);

  const { data: produtos } = useQuery({
    queryKey: ["cmo-produtos"],
    queryFn: async () => (await supabase.from("produtos").select("*")).data || [],
  });
  const { data: vendas } = useQuery({
    queryKey: ["cmo-vendas"],
    queryFn: async () => (await supabase.from("vendas").select("*").order("created_at", { ascending: false })).data || [],
  });
  const { data: clientes } = useQuery({
    queryKey: ["cmo-clientes"],
    queryFn: async () => (await supabase.from("clientes").select("*")).data || [],
  });
  const { data: gastos } = useQuery({
    queryKey: ["cmo-gastos"],
    queryFn: async () => (await supabase.from("custos_fixos").select("*")).data || [],
  });

  const pautas = useMemo(() => gerarPautas({ produtos: (produtos || []) as any, vendas: (vendas || []) as any, hoje: today }), [produtos, vendas]);
  const melhorDia = useMemo(() => melhorDiaSemana((vendas || []) as any), [vendas]);
  const ret = useMemo(() => metricasRetencao({ clientes: (clientes || []) as any, vendas: (vendas || []) as any, hoje: today }), [clientes, vendas]);

  const marketingMes = useMemo(() => {
    const mesInicio = new Date(today.getFullYear(), today.getMonth(), 1);
    const mesFim = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return (gastos || []).filter((g: any) => {
      const cat = (g.categoria || '').toLowerCase();
      if (!(cat.includes('marketing') || cat.includes('anúncio') || cat.includes('anuncio'))) return false;
      if (g.recorrencia === 'mensal') return true;
      if (g.data) { const d = new Date(g.data); return d >= mesInicio && d < mesFim; }
      return false;
    }).reduce((s: number, g: any) => s + Number(g.valor), 0);
  }, [gastos]);

  const cacAprox = ret.novosMes > 0 ? marketingMes / ret.novosMes : null;
  const hojeIdx = today.getDay();
  const focoHoje = CALENDARIO.find(c => c.dia === hojeIdx);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="CMO Peak"
        subtitle="Seu marketing de Instagram — pauta do dia, roteiros e marca"
        icon={<Megaphone size={20} strokeWidth={2.5} />}
        iconGradient
      />

      {/* Foco do dia */}
      {focoHoje && (
        <div className="bg-card rounded-2xl p-4 card-elev flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Foco de hoje ({focoHoje.label})</p>
            <p className="text-sm font-semibold">{focoHoje.foco}</p>
          </div>
        </div>
      )}

      {/* Pauta do dia */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-secondary">Pauta do dia</h2>
          <span className="text-[10px] text-muted-foreground">muda todo dia · puxa seu estoque</span>
        </div>
        {pautas[0] && <PautaCard p={pautas[0]} principal />}

        {pautas.length > 1 && (
          <>
            <button onClick={() => setAltOpen(o => !o)} className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary py-1.5">
              {altOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {altOpen ? 'Ocultar' : `Ver mais ${pautas.length - 1} ideias`}
            </button>
            {altOpen && <div className="space-y-2">{pautas.slice(1).map((p, i) => <PautaCard key={i} p={p} />)}</div>}
          </>
        )}
      </div>

      {/* Calendário semanal */}
      <div className="bg-card rounded-2xl p-4 card-elev space-y-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-secondary" />
          <h2 className="text-sm font-semibold text-secondary">Calendário da semana</h2>
        </div>
        <div className="space-y-1">
          {CALENDARIO.slice().sort((a, b) => (a.dia === 0 ? 7 : a.dia) - (b.dia === 0 ? 7 : b.dia)).map(c => (
            <div key={c.dia} className={`flex items-center gap-3 text-xs py-1.5 px-2 rounded-lg ${c.dia === hojeIdx ? 'bg-primary/10' : ''}`}>
              <span className={`w-16 font-semibold ${c.dia === hojeIdx ? 'text-primary' : 'text-muted-foreground'}`}>{c.label}</span>
              <span>{c.foco}</span>
            </div>
          ))}
        </div>
        {melhorDia && (
          <p className="text-[11px] text-muted-foreground pt-1 border-t">
            📈 Seu dia mais forte de vendas é <strong className="text-foreground">{melhorDia.dia}</strong> — bom dia pra empurrar oferta.
          </p>
        )}
      </div>

      {/* Aquisição & retenção */}
      <div className="bg-card rounded-2xl p-4 card-elev space-y-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-secondary" />
          <h2 className="text-sm font-semibold text-secondary">Aquisição & retenção</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-muted/40 rounded-xl">
            <p className="text-[10px] text-muted-foreground">Novos clientes (mês)</p>
            <p className="text-base font-bold tabular-nums">{ret.novosMes}</p>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl">
            <p className="text-[10px] text-muted-foreground">Taxa de recompra</p>
            <p className="text-base font-bold tabular-nums">{formatPercent(ret.taxaRecompra)}</p>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl">
            <p className="text-[10px] text-muted-foreground">CAC aprox.</p>
            <p className="text-base font-bold tabular-nums">{cacAprox !== null ? formatCurrency(cacAprox) : '—'}</p>
          </div>
        </div>
        {marketingMes > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Investimento de marketing no mês: <strong className="text-foreground">{formatCurrency(marketingMes)}</strong>
            {cacAprox !== null && <> · custo por cliente novo ≈ {formatCurrency(cacAprox)}</>}
          </p>
        )}
        {ret.semOrigem > 0 && (
          <div className="bg-warning/5 border border-warning/30 rounded-lg p-2.5 text-[11px] text-muted-foreground">
            ⚠️ {ret.semOrigem} cliente(s) sem origem registrada. Pra saber se o Instagram traz cliente, capriche no campo "Como conheceu?" ao cadastrar.
          </div>
        )}

        {ret.inativos.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reativar (45+ dias sem comprar) — dinheiro na mesa</p>
            {ret.inativos.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
                <span className="truncate flex-1 min-w-0">{c.nome}</span>
                <span className="text-muted-foreground tabular-nums ml-2">{formatCurrency(c.total_acumulado || 0)}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground pt-1">Reative pelo WhatsApp na aba <strong>Clientes → Contatar</strong>. Reter é mais barato que adquirir.</p>
          </div>
        )}
      </div>

      {/* Biblioteca de roteiros */}
      <div className="bg-card rounded-2xl card-elev overflow-hidden">
        <button onClick={() => setShowRoteiros(o => !o)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-secondary" />
            <h2 className="text-sm font-semibold text-secondary">Biblioteca de roteiros</h2>
          </div>
          {showRoteiros ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>
        {showRoteiros && (
          <div className="p-4 pt-0 space-y-3">
            {ROTEIROS.map((r, i) => (
              <div key={i} className="border rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{r.objetivo}</p>
                  <span className="text-[10px] text-muted-foreground">{r.quando}</span>
                </div>
                <ol className="space-y-0.5">
                  {r.frames.map((f, j) => <li key={j} className="text-xs text-muted-foreground">{j + 1}. {f}</li>)}
                </ol>
                <p className="text-[11px] text-secondary font-medium">→ CTA: {r.cta}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kit de marca */}
      <div className="bg-card rounded-2xl card-elev overflow-hidden">
        <button onClick={() => setShowMarca(o => !o)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-secondary" />
            <h2 className="text-sm font-semibold text-secondary">Kit de marca & design</h2>
          </div>
          {showMarca ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>
        {showMarca && (
          <div className="p-4 pt-0 space-y-4">
            {/* Cores */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Paleta</p>
              <div className="flex flex-wrap gap-2">
                {MARCA.cores.map(c => (
                  <div key={c.hex} className="flex items-center gap-2 border rounded-lg p-2">
                    <span className="w-6 h-6 rounded-md border" style={{ background: c.hex }} />
                    <div>
                      <p className="text-[11px] font-medium leading-tight">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{c.hex} · {c.uso}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fotografia — a diretriz principal */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Camera size={13} className="text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fotografia (subir o nível — estilo premium)</p>
              </div>
              <ul className="space-y-1">
                {MARCA.fotografia.map((f, i) => <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary">•</span>{f}</li>)}
              </ul>
            </div>

            {/* Tipografia & tom */}
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-muted/40 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipografia</p>
                <p className="text-xs">{MARCA.tipografia}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tom de voz</p>
                <p className="text-xs">{MARCA.tom}</p>
              </div>
            </div>

            {/* Do / Don't */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-success/5 border border-success/20 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-success mb-1">Faça</p>
                {MARCA.dos.map((d, i) => <p key={i} className="text-[11px] text-muted-foreground">✓ {d}</p>)}
              </div>
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">Evite</p>
                {MARCA.donts.map((d, i) => <p key={i} className="text-[11px] text-muted-foreground">✕ {d}</p>)}
              </div>
            </div>

            {/* Specs */}
            <div className="bg-muted/40 rounded-lg p-2.5 text-[11px] text-muted-foreground space-y-0.5">
              <p><strong className="text-foreground">Tamanhos:</strong> Story 1080×1920 · Feed 1080×1350 (vertical rende mais).</p>
              <p className="flex items-center gap-1"><MapPin size={11} /> {LOJA.endereco}</p>
              <p className="flex items-center gap-1"><MessageCircle size={11} /> {LOJA.whatsapp} · {LOJA.instagram}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
