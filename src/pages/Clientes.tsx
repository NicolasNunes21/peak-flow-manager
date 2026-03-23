import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, diasAtras, getWhatsAppScript, formatPercent } from "@/lib/format";
import { Plus, Search, MessageCircle, ChevronRight, X, Gift, Users, Phone, Crown, DollarSign, ArrowLeft, Clock, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATUS_COLORS: Record<string, string> = {
  Novo: "bg-primary/15 text-primary",
  Ativo: "bg-success/15 text-success",
  VIP: "bg-warning/15 text-warning",
  Inativo: "bg-muted text-muted-foreground",
};

const CANAIS_AQUISICAO = ['Loja física', 'Instagram', 'Indicação', 'Academia'];

export default function Clientes() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [showNovo, setShowNovo] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCliente, setDetailCliente] = useState<any>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoWhats, setNovoWhats] = useState("");
  const [novoCanal, setNovoCanal] = useState("Loja física");

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").order("nome");
      return data || [];
    },
  });

  const { data: vendas } = useQuery({
    queryKey: ["vendas-all"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("clientes").insert({
        nome: novoNome, whatsapp: novoWhats || null, canal_aquisicao: novoCanal,
        data_primeira_compra: new Date().toISOString().split('T')[0], status: 'Novo',
      });
    },
    onSuccess: () => {
      toast({ title: "✅ Cliente cadastrado!" });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setShowNovo(false); setNovoNome(""); setNovoWhats(""); setNovoCanal("Loja física");
    },
  });

  const updateObsMutation = useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao: string }) => {
      await supabase.from("clientes").update({ observacao }).eq("id", id);
    },
  });

  const adiarRecontatoMutation = useMutation({
    mutationFn: async ({ id, dias }: { id: string; dias: number }) => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + dias);
      await supabase.from("clientes").update({ data_proximo_recontato: newDate.toISOString().split('T')[0] }).eq("id", id);
    },
    onSuccess: () => {
      toast({ title: "📅 Recontato adiado" });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const contatarHoje = (clientes || []).filter(c => c.data_proximo_recontato && c.data_proximo_recontato <= todayStr);
  const vipClientes = (clientes || []).filter(c => (c.total_acumulado || 0) >= 500);
  const ativosCount = (clientes || []).filter(c => c.status === 'Ativo' || c.status === 'VIP' || c.status === 'Novo').length;

  // Revenue per client this month
  const receitaMediaMes = useMemo(() => {
    const vendasMes = (vendas || []).filter(v => v.created_at && v.created_at >= monthStart && v.cliente_id);
    const clientIds = new Set(vendasMes.map(v => v.cliente_id));
    const totalMes = vendasMes.reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
    return clientIds.size > 0 ? totalMes / clientIds.size : 0;
  }, [vendas, monthStart]);

  // Segments
  const segmentos = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

    return {
      prestes: (clientes || []).filter(c => { const t = c.total_acumulado || 0; return t >= 400 && t < 500; }),
      churn: (clientes || []).filter(c => {
        if (c.status === 'Inativo') return false;
        const d = c.data_ultima_compra ? new Date(c.data_ultima_compra) : null;
        return d && d < fortyFiveDaysAgo;
      }),
      campeoes: (clientes || []).filter(c => {
        if ((c.total_acumulado || 0) < 500) return false;
        const d = c.data_ultima_compra ? new Date(c.data_ultima_compra) : null;
        return d && d >= thirtyDaysAgo;
      }),
      novos: (clientes || []).filter(c => {
        const d = c.created_at ? new Date(c.created_at) : null;
        return d && d >= weekAgo;
      }),
    };
  }, [clientes]);

  const filtered = useMemo(() => {
    return (clientes || []).filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.nome.toLowerCase().includes(q);
      if (tab === "contatar") return matchSearch && c.data_proximo_recontato && c.data_proximo_recontato <= todayStr;
      if (tab === "vip") return matchSearch && (c.total_acumulado || 0) >= 500;
      if (tab === "inativos") { const dias = c.data_ultima_compra ? diasAtras(c.data_ultima_compra) : 999; return matchSearch && dias >= 60; }
      if (tab === "prestes") return matchSearch && segmentos.prestes.includes(c);
      if (tab === "churn") return matchSearch && segmentos.churn.includes(c);
      if (tab === "campeoes") return matchSearch && segmentos.campeoes.includes(c);
      if (tab === "novos") return matchSearch && segmentos.novos.includes(c);
      return matchSearch;
    });
  }, [clientes, search, tab, todayStr, segmentos]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const exportWhatsApps = () => {
    const selected = (clientes || []).filter(c => selectedIds.has(c.id) && c.whatsapp);
    const text = selected.map(c => `${c.nome}: ${c.whatsapp}`).join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: `📋 ${selected.length} WhatsApps copiados` });
  };

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  // Detail view
  if (detailCliente) {
    const c = detailCliente;
    const clienteVendas = (vendas || []).filter(v => v.cliente_id === c.id);
    const numCompras = clienteVendas.length;
    const ticketMedio = numCompras > 0 ? clienteVendas.reduce((s: number, v: any) => s + v.preco_venda * v.quantidade, 0) / numCompras : 0;
    const dias = c.data_ultima_compra ? diasAtras(c.data_ultima_compra) : 0;
    const whatsScript = getWhatsAppScript(c.nome, c.ultimo_produto_categoria || 'Whey', dias);
    const whatsUrl = c.whatsapp ? `https://wa.me/55${c.whatsapp}?text=${encodeURIComponent(whatsScript)}` : null;
    const diasRecontato = c.data_proximo_recontato ? Math.floor((new Date(c.data_proximo_recontato).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    return (
      <div className="space-y-4 animate-fade-in">
        <button onClick={() => setDetailCliente(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-lg">{c.nome.charAt(0)}</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{c.nome}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status || 'Novo']}`}>{c.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">{c.canal_aquisicao} · Desde {c.data_primeira_compra ? formatDate(c.data_primeira_compra) : '—'}</p>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total gasto" value={formatCurrency(c.total_acumulado || 0)} icon={DollarSign} />
          <MetricCard label="Nº compras" value={String(numCompras)} icon={ShoppingCart} />
          <MetricCard label="Ticket médio" value={formatCurrency(ticketMedio)} icon={Crown} />
          <MetricCard label="Última compra" value={`há ${dias}d`} icon={Clock} />
        </div>

        {/* Recontato */}
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-secondary">Próximo recontato</h3>
          {diasRecontato !== null ? (
            <p className="text-sm">{diasRecontato <= 0 ? <span className="text-warning font-medium">Contatar agora!</span> : <span>Em {diasRecontato} dias — {formatDate(c.data_proximo_recontato!)}</span>}</p>
          ) : <p className="text-xs text-muted-foreground">Sem data definida</p>}
          <div className="flex gap-2 flex-wrap">
            {whatsUrl && <a href={whatsUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-success text-success-foreground text-xs font-medium flex items-center gap-2"><MessageCircle size={14} /> WhatsApp</a>}
            <button onClick={() => adiarRecontatoMutation.mutate({ id: c.id, dias: 7 })} className="px-3 py-2 rounded-xl border text-xs font-medium hover:bg-muted">+7 dias</button>
            <button onClick={() => adiarRecontatoMutation.mutate({ id: c.id, dias: 15 })} className="px-3 py-2 rounded-xl border text-xs font-medium hover:bg-muted">+15 dias</button>
          </div>
        </div>

        {/* Purchase history */}
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-secondary">Histórico de compras</h3>
          {clienteVendas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma compra registrada.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Data</th><th className="text-left py-2">Produto</th><th className="text-right py-2">Qtd</th><th className="text-right py-2">Valor</th><th className="text-right py-2">Pgto</th></tr></thead>
                <tbody>
                  {clienteVendas.map(v => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2">{formatDate(v.created_at || '')}</td>
                      <td className="py-2">{v.produto_nome}</td>
                      <td className="py-2 text-right">{v.quantidade}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(v.preco_venda * v.quantidade)}</td>
                      <td className="py-2 text-right"><span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">{v.forma_pgto}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Timeline */}
        {clienteVendas.length > 0 && (
          <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-secondary">Linha do tempo</h3>
            <div className="relative pl-4 space-y-3">
              <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-muted" />
              {clienteVendas.slice(0, 10).map(v => {
                const val = v.preco_venda * v.quantidade;
                const maxVal = Math.max(...clienteVendas.map(vv => vv.preco_venda * vv.quantidade));
                const size = val >= maxVal * 0.8 ? 'w-3 h-3' : 'w-2 h-2';
                return (
                  <div key={v.id} className="flex items-center gap-3 relative">
                    <div className={`${size} rounded-full bg-primary absolute -left-[14px]`} />
                    <div className="flex-1 flex justify-between">
                      <span className="text-xs">{formatDate(v.created_at || '')} · {v.produto_nome}</span>
                      <span className="text-xs font-medium">{formatCurrency(val)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-2">
          <h3 className="text-sm font-semibold text-secondary">Observações</h3>
          <textarea rows={3} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" defaultValue={c.observacao || ''} onBlur={e => { if (e.target.value !== (c.observacao || '')) { updateObsMutation.mutate({ id: c.id, observacao: e.target.value }); queryClient.invalidateQueries({ queryKey: ["clientes"] }); } }} placeholder="Notas sobre o cliente..." />
        </div>

        <button onClick={() => navigate(`/venda?cliente=${c.id}`)} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98]">
          Registrar venda para {c.nome.split(' ')[0]}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-secondary">Clientes</h1>
        <button onClick={() => setShowNovo(true)} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95">
          <Plus size={20} />
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Ativos" value={String(ativosCount)} icon={Users} />
        <MetricCard label="Contatar hoje" value={String(contatarHoje.length)} icon={Phone} accent />
        <MetricCard label="VIP" value={String(vipClientes.length)} icon={Crown} />
        <MetricCard label="Receita média/mês" value={formatCurrency(receitaMediaMes)} icon={DollarSign} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "todos", label: "Todos" },
          { key: "contatar", label: "Contatar", count: contatarHoje.length, color: "bg-warning" },
          { key: "vip", label: "VIP" },
          { key: "inativos", label: "Inativos" },
          { key: "prestes", label: "Prestes desconto", count: segmentos.prestes.length },
          { key: "churn", label: "Risco churn", count: segmentos.churn.length, color: "bg-destructive" },
          { key: "campeoes", label: "Campeões", count: segmentos.campeoes.length },
          { key: "novos", label: "Novos", count: segmentos.novos.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${tab === t.key ? "bg-secondary text-secondary-foreground" : "bg-card border hover:bg-muted"}`}>
            {t.label}
            {t.count ? <span className={`${t.color || 'bg-muted-foreground'} text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold`}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="bg-secondary rounded-xl p-3 flex items-center gap-3 text-secondary-foreground">
          <span className="text-sm font-medium">{selectedIds.size} selecionados</span>
          <button onClick={exportWhatsApps} className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-medium">Exportar WhatsApps</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs underline ml-auto">Limpar</button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {filtered.map(c => {
          const dias = c.data_ultima_compra ? diasAtras(c.data_ultima_compra) : 0;
          const diasColor = dias > 60 ? "text-destructive" : dias > 30 ? "text-warning" : dias > 15 ? "text-warning" : "text-success";
          const fidelidade = Math.min(((c.total_acumulado || 0) / 500) * 100, 100);
          const isVip = (c.total_acumulado || 0) >= 500;

          const whatsScript = getWhatsAppScript(c.nome, c.ultimo_produto_categoria || 'Whey', dias);
          const whatsUrl = c.whatsapp ? `https://wa.me/55${c.whatsapp}?text=${encodeURIComponent(whatsScript)}` : null;

          return (
            <div key={c.id} className="bg-card rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="mt-1 rounded" />
                <div className="flex-1 min-w-0 space-y-1.5 cursor-pointer" onClick={() => setDetailCliente(c)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{c.nome}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status || 'Novo']}`}>{c.status}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{formatCurrency(c.total_acumulado || 0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.ultimo_produto_categoria || '—'}</p>
                  <p className={`text-xs font-medium ${diasColor}`}>há {dias} dias</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5 max-w-[120px]">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${fidelidade}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatCurrency(c.total_acumulado || 0)} / R$500</span>
                    {isVip && <span className="flex items-center gap-1 text-[10px] text-warning font-medium"><Gift size={12} /> Desconto!</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {whatsUrl && (
                    <a href={whatsUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-success flex items-center justify-center transition-transform active:scale-95">
                      <MessageCircle size={16} className="text-success-foreground" />
                    </a>
                  )}
                  <button onClick={() => setDetailCliente(c)} className="p-1">
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New client modal */}
      {showNovo && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowNovo(false)}>
          <div className="bg-card w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-secondary">Novo cliente</h2>
              <button onClick={() => setShowNovo(false)} className="p-1 rounded-lg hover:bg-muted"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary" value={novoNome} onChange={e => setNovoNome(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
                <input className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary" value={novoWhats} onChange={e => setNovoWhats(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Canal de aquisição</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {CANAIS_AQUISICAO.map(c => (
                    <button key={c} onClick={() => setNovoCanal(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${novoCanal === c ? "bg-secondary text-secondary-foreground" : "bg-muted hover:bg-muted/80"}`}>{c}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => createMutation.mutate()} disabled={!novoNome || createMutation.isPending} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98] disabled:opacity-50">Cadastrar cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ElementType; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 shadow-sm space-y-1 ${accent ? 'bg-warning/10 border border-warning/20' : 'bg-card'}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold ${accent ? 'text-warning' : ''}`}>{value}</p>
    </div>
  );
}
