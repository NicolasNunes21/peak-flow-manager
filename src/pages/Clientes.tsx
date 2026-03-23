import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, diasAtras, getWhatsAppScript } from "@/lib/format";
import { Plus, Search, MessageCircle, ChevronRight, X, Gift } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
        nome: novoNome,
        whatsapp: novoWhats || null,
        canal_aquisicao: novoCanal,
        data_primeira_compra: new Date().toISOString().split('T')[0],
        status: 'Novo',
      });
    },
    onSuccess: () => {
      toast({ title: "✅ Cliente cadastrado!" });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setShowNovo(false);
      setNovoNome(""); setNovoWhats(""); setNovoCanal("Loja física");
    },
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const contatarHoje = (clientes || []).filter(c => c.data_proximo_recontato && c.data_proximo_recontato <= todayStr);

  const filtered = (clientes || []).filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.nome.toLowerCase().includes(q);
    if (tab === "contatar") return matchSearch && c.data_proximo_recontato && c.data_proximo_recontato <= todayStr;
    if (tab === "vip") return matchSearch && (c.total_acumulado || 0) >= 500;
    if (tab === "inativos") {
      const dias = c.data_ultima_compra ? diasAtras(c.data_ultima_compra) : 999;
      return matchSearch && dias >= 60;
    }
    return matchSearch;
  });

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-secondary">Clientes</h1>
        <button onClick={() => setShowNovo(true)} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95">
          <Plus size={20} />
        </button>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl p-3 shadow-sm text-sm">
        <span className="font-medium">{(clientes || []).length} clientes</span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-warning font-medium">{contatarHoje.length} para contatar hoje</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "todos", label: "Todos" },
          { key: "contatar", label: "Contatar hoje", count: contatarHoje.length, color: "bg-warning" },
          { key: "vip", label: "VIP" },
          { key: "inativos", label: "Inativos" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === t.key ? "bg-secondary text-secondary-foreground" : "bg-card border hover:bg-muted"
            }`}
          >
            {t.label}
            {t.count ? <span className={`${t.color} text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold`}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {filtered.map(c => {
          const dias = c.data_ultima_compra ? diasAtras(c.data_ultima_compra) : 0;
          const diasColor = dias > 60 ? "text-destructive" : dias > 30 ? "text-warning" : "text-muted-foreground";
          const fidelidade = Math.min(((c.total_acumulado || 0) / 500) * 100, 100);
          const isVip = (c.total_acumulado || 0) >= 500;
          const expanded = expandedId === c.id;
          const clienteVendas = (vendas || []).filter(v => v.cliente_id === c.id);

          const whatsScript = getWhatsAppScript(c.nome, c.ultimo_produto_categoria || 'Whey', dias);
          const whatsUrl = c.whatsapp ? `https://wa.me/55${c.whatsapp}?text=${encodeURIComponent(whatsScript)}` : null;

          return (
            <div key={c.id} className="bg-card rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1.5" onClick={() => setExpandedId(expanded ? null : c.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{c.nome}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status || 'Novo']}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.ultimo_produto_categoria || '—'}</p>
                  <p className={`text-xs font-medium ${diasColor}`}>há {dias} dias</p>
                  {/* Fidelidade */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${fidelidade}%` }} />
                    </div>
                    {isVip && (
                      <span className="flex items-center gap-1 text-[10px] text-warning font-medium">
                        <Gift size={12} /> Desconto!
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {whatsUrl && (
                    <a
                      href={whatsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full bg-success flex items-center justify-center transition-transform active:scale-95"
                    >
                      <MessageCircle size={16} className="text-success-foreground" />
                    </a>
                  )}
                  <button onClick={() => setExpandedId(expanded ? null : c.id)} className="p-1">
                    <ChevronRight size={16} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Expanded */}
              {expanded && (
                <div className="border-t px-4 py-3 space-y-3 bg-muted/30">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/venda?cliente=${c.id}`)}
                      className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium active:scale-[0.97]"
                    >
                      Registrar venda
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Histórico de compras</p>
                    {clienteVendas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma compra registrada.</p>}
                    {clienteVendas.slice(0, 5).map(v => (
                      <div key={v.id} className="flex justify-between text-xs">
                        <span>{formatDate(v.created_at || '')} · {v.produto_nome}</span>
                        <span className="font-medium">{formatCurrency(v.preco_venda * v.quantidade)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total acumulado: <span className="font-semibold text-foreground">{formatCurrency(c.total_acumulado || 0)}</span>
                  </p>
                </div>
              )}
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
                    <button
                      key={c}
                      onClick={() => setNovoCanal(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        novoCanal === c ? "bg-secondary text-secondary-foreground" : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!novoNome || createMutation.isPending}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98] disabled:opacity-50"
              >
                Cadastrar cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
