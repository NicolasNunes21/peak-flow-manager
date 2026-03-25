import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, diasAtras, getRecontatoDias, margemBgClass, margemColorClass } from "@/lib/format";
import { Search, Minus, Plus, Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";

const FORMAS_PGTO = ["PIX", "Dinheiro", "Crédito", "Débito"];
const CANAIS = ["Loja física", "Delivery", "Academia parceira"];

export default function Venda() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preSelectedClienteId = searchParams.get('cliente');

  const [produtoSearch, setProdutoSearch] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<any>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [precoVenda, setPrecoVenda] = useState<number>(0);
  const [formaPgto, setFormaPgto] = useState("");
  const [canal, setCanal] = useState("Loja física");
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteWhats, setNovoClienteWhats] = useState("");
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [semCadastro, setSemCadastro] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [showProdutoList, setShowProdutoList] = useState(false);
  const [showClienteList, setShowClienteList] = useState(false);
  const [dataVenda, setDataVenda] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*").order("nome");
      return data || [];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").order("nome");
      if (preSelectedClienteId && !selectedCliente) {
        const found = (data || []).find(c => c.id === preSelectedClienteId);
        if (found) setSelectedCliente(found);
      }
      return data || [];
    },
  });

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  const { data: vendasHoje } = useQuery({
    queryKey: ["vendas-hoje"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("*").gte("created_at", startOfDay).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: vendasSemana } = useQuery({
    queryKey: ["vendas-semana-top"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("produto_id, produto_nome, quantidade").gte("created_at", weekAgo);
      return data || [];
    },
  });

  const topProdutosSemana = useMemo(() => {
    const map: Record<string, { id: string; nome: string; qtd: number }> = {};
    (vendasSemana || []).forEach(v => {
      const k = v.produto_id || '';
      if (!map[k]) map[k] = { id: k, nome: v.produto_nome || '', qtd: 0 };
      map[k].qtd += v.quantidade;
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd).slice(0, 4);
  }, [vendasSemana]);

  const { data: ultimaVendaProduto } = useQuery({
    queryKey: ["ultima-venda-produto", selectedProduto?.id],
    enabled: !!selectedProduto,
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("created_at").eq("produto_id", selectedProduto.id).order("created_at", { ascending: false }).limit(1);
      return data?.[0] || null;
    },
  });

  const filteredProdutos = useMemo(() => {
    if (!produtoSearch.trim()) return [];
    const q = produtoSearch.toLowerCase();
    return (produtos || []).filter(p => p.nome.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))).slice(0, 5);
  }, [produtoSearch, produtos]);

  const filteredClientes = useMemo(() => {
    if (!clienteSearch.trim()) return [];
    const q = clienteSearch.toLowerCase();
    return (clientes || []).filter(c => c.nome.toLowerCase().includes(q)).slice(0, 5);
  }, [clienteSearch, clientes]);

  const custoUnit = selectedProduto?.custo_unit || 0;
  const margemPct = precoVenda > 0 ? ((precoVenda - custoUnit) / precoVenda) * 100 : 0;
  const margemRs = precoVenda - custoUnit;
  const margemTotal = margemRs * quantidade;
  const canSubmit = selectedProduto && formaPgto;

  const todayStr = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();

  const totalHoje = (vendasHoje || []).reduce((s, v) => s + v.preco_venda * v.quantidade, 0);
  const margemHoje = (vendasHoje || []).reduce((s, v) => s + (v.preco_venda - v.custo_unit) * v.quantidade, 0);
  const margemPctHoje = totalHoje > 0 ? (margemHoje / totalHoje) * 100 : 0;

  const resetForm = () => {
    setSelectedProduto(null); setProdutoSearch(""); setQuantidade(1); setPrecoVenda(0);
    setFormaPgto(""); setCanal("Loja física"); setClienteSearch(""); setSelectedCliente(null);
    setNovoClienteNome(""); setNovoClienteWhats(""); setShowNovoCliente(false); setSemCadastro(false); setObservacao("");
    setDataVenda(todayStr);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      let clienteId = selectedCliente?.id || null;
      let clienteNome = selectedCliente?.nome || null;

      if (showNovoCliente && novoClienteNome) {
        const { data: newCliente } = await supabase.from("clientes").insert({
          nome: novoClienteNome, whatsapp: novoClienteWhats || null,
          data_primeira_compra: dataVenda,
          data_ultima_compra: dataVenda, status: 'Novo',
        }).select().single();
        if (newCliente) { clienteId = newCliente.id; clienteNome = newCliente.nome; }
      }

      const totalPreco = precoVenda * quantidade;
      const vendaDate = new Date(dataVenda + 'T12:00:00');
      await supabase.from("vendas").insert({
        produto_id: selectedProduto.id, produto_nome: selectedProduto.nome,
        cliente_id: clienteId, cliente_nome: clienteNome, quantidade,
        preco_venda: precoVenda, custo_unit: custoUnit, forma_pgto: formaPgto,
        canal, observacao: observacao || null,
        created_at: vendaDate.toISOString(),
      });

      await supabase.from("produtos").update({
        qtd_atual: (selectedProduto.qtd_atual || 0) - quantidade,
      }).eq("id", selectedProduto.id);

      if (clienteId) {
        const categoria = selectedProduto.categoria || '';
        const recontatoDias = getRecontatoDias(categoria);
        const proximoRecontato = new Date();
        proximoRecontato.setDate(proximoRecontato.getDate() + recontatoDias);
        const currentTotal = selectedCliente?.total_acumulado || 0;
        await supabase.from("clientes").update({
          data_ultima_compra: dataVenda,
          total_acumulado: currentTotal + totalPreco,
          ultimo_produto_categoria: categoria,
          valor_ultima_compra: totalPreco,
          data_proximo_recontato: proximoRecontato.toISOString().split('T')[0],
          status: (currentTotal + totalPreco) >= 500 ? 'VIP' : 'Ativo',
        }).eq("id", clienteId);
      }

      const newQtd = (selectedProduto.qtd_atual || 0) - quantidade;
      if (newQtd < (selectedProduto.estoque_min || 0)) {
        toast({ title: "⚠ Estoque baixo", description: `${selectedProduto.nome} ficou abaixo do mínimo.`, variant: "destructive" });
      }

      return { totalPreco, produtoNome: selectedProduto.nome, margemPct };
    },
    onSuccess: ({ totalPreco, produtoNome, margemPct: m }) => {
      toast({ title: "✅ Venda registrada", description: `${produtoNome} × ${quantidade} | ${formatCurrency(totalPreco)} | Margem: ${formatPercent(m)}` });
      queryClient.invalidateQueries();
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao salvar. Tente novamente.", variant: "destructive" });
    },
  });

  const selectProdutoById = (id: string) => {
    const p = (produtos || []).find(pr => pr.id === id);
    if (p) { setSelectedProduto(p); setPrecoVenda(p.preco_venda || 0); setProdutoSearch(""); setShowProdutoList(false); }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Today's summary bar */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-secondary">Registrar Venda</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-primary">{formatCurrency(totalHoje)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{(vendasHoje || []).length} vendas</span>
            <span className="text-muted-foreground">·</span>
            <span className={`font-medium ${margemColorClass(margemPctHoje)}`}>Margem {formatPercent(margemPctHoje)}</span>
          </div>
        </div>
      </div>

      {/* Form only — no sidebar */}
      <div className="space-y-5 max-w-lg">
        {/* Quick picks */}
        {topProdutosSemana.length > 0 && !selectedProduto && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Mais vendidos esta semana:</p>
            <div className="flex flex-wrap gap-2">
              {topProdutosSemana.map(p => (
                <button key={p.id} onClick={() => selectProdutoById(p.id)} className="px-3 py-1.5 rounded-full text-xs font-medium bg-accent text-accent-foreground hover:bg-primary/15 transition-colors">
                  {p.nome.length > 25 ? p.nome.slice(0, 25) + '…' : p.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Produto */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Produto *</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Buscar por nome ou SKU..."
              value={selectedProduto ? selectedProduto.nome : produtoSearch}
              onChange={e => { setProdutoSearch(e.target.value); setSelectedProduto(null); setShowProdutoList(true); }}
              onFocus={() => setShowProdutoList(true)}
            />
            {showProdutoList && filteredProdutos.length > 0 && !selectedProduto && (
              <div className="absolute z-10 w-full mt-1 bg-card border rounded-xl shadow-lg overflow-hidden">
                {filteredProdutos.map(p => (
                  <button key={p.id} className="w-full text-left px-4 py-3 hover:bg-muted text-sm border-b last:border-0 transition-colors" onClick={() => { setSelectedProduto(p); setPrecoVenda(p.preco_venda || 0); setProdutoSearch(""); setShowProdutoList(false); }}>
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.sku} · {formatCurrency(p.preco_venda || 0)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product detail card */}
          {selectedProduto && (
            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold">{selectedProduto.nome}</p>
                  <p className="text-xs text-muted-foreground">{selectedProduto.marca} · {selectedProduto.categoria}</p>
                </div>
                <button className="text-xs text-destructive underline" onClick={() => { setSelectedProduto(null); setProdutoSearch(""); }}>Trocar</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`text-xs ${(selectedProduto.qtd_atual || 0) < (selectedProduto.estoque_min || 0) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                  <Package size={12} className="inline mr-1" />{selectedProduto.qtd_atual} un. restantes
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${margemBgClass(margemPct)}`}>Margem {formatPercent(margemPct)}</span>
                {ultimaVendaProduto && (
                  <span className="text-xs text-muted-foreground">Última venda: há {diasAtras(ultimaVendaProduto.created_at!)} dias</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quantidade */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quantidade</label>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-95" onClick={() => setQuantidade(Math.max(1, quantidade - 1))}><Minus size={16} /></button>
            <span className="text-lg font-bold w-10 text-center">{quantidade}</span>
            <button className="w-10 h-10 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-95" onClick={() => setQuantidade(quantidade + 1)}><Plus size={16} /></button>
          </div>
        </div>

        {/* Margem prominent */}
        {selectedProduto && (
          <div className={`rounded-xl px-4 py-4 text-center ${margemBgClass(margemPct)}`}>
            <p className="text-lg font-bold">Margem: {formatPercent(margemPct)}</p>
            <p className="text-sm">{formatCurrency(margemRs)} por unidade — {formatCurrency(margemTotal)} no total</p>
          </div>
        )}

        {/* Preço */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Preço de venda</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
            <input type="number" step="0.01" className="w-full pl-10 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={precoVenda || ''} onChange={e => setPrecoVenda(parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        {/* Forma de pagamento */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Forma de pagamento *</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS_PGTO.map(f => (
              <button key={f} onClick={() => setFormaPgto(f)} className={`py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${formaPgto === f ? "bg-primary text-primary-foreground shadow-md" : "bg-card border hover:bg-muted"}`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Canal */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Canal</label>
          <div className="flex gap-2">
            {CANAIS.map(c => (
              <button key={c} onClick={() => setCanal(c)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] ${canal === c ? "bg-secondary text-secondary-foreground" : "bg-card border hover:bg-muted"}`}>{c}</button>
            ))}
          </div>
        </div>

        {/* Data da venda */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Data da venda</label>
          <input
            type="date"
            max={todayStr}
            className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={dataVenda}
            onChange={e => setDataVenda(e.target.value)}
          />
          {dataVenda !== todayStr && (
            <p className="text-xs text-warning font-medium">⚠ Registrando venda retroativa ({dataVenda})</p>
          )}
        </div>

        {/* Cliente */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Cliente (opcional)</label>
          {!semCadastro && !showNovoCliente && !selectedCliente && (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Buscar cliente..." value={clienteSearch} onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }} onFocus={() => setShowClienteList(true)} />
                {showClienteList && filteredClientes.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border rounded-xl shadow-lg overflow-hidden">
                    {filteredClientes.map(c => (
                      <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-muted text-sm border-b last:border-0" onClick={() => { setSelectedCliente(c); setClienteSearch(""); setShowClienteList(false); }}>{c.nome}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button className="text-xs text-primary underline" onClick={() => setShowNovoCliente(true)}>Cadastrar novo</button>
                <button className="text-xs text-muted-foreground underline" onClick={() => setSemCadastro(true)}>Sem cadastro</button>
              </div>
            </>
          )}
          {selectedCliente && (
            <div className="flex items-center gap-2">
              <span className="text-sm">{selectedCliente.nome}</span>
              <button className="text-xs text-destructive underline" onClick={() => setSelectedCliente(null)}>Remover</button>
            </div>
          )}
          {semCadastro && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sem cadastro</span>
              <button className="text-xs text-destructive underline" onClick={() => setSemCadastro(false)}>Alterar</button>
            </div>
          )}
          {showNovoCliente && (
            <div className="space-y-2 p-3 bg-muted rounded-xl">
              <input className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Nome do cliente" value={novoClienteNome} onChange={e => setNovoClienteNome(e.target.value)} />
              <input className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="WhatsApp (opcional)" value={novoClienteWhats} onChange={e => setNovoClienteWhats(e.target.value)} />
              <button className="text-xs text-destructive underline" onClick={() => { setShowNovoCliente(false); setNovoClienteNome(""); setNovoClienteWhats(""); }}>Cancelar</button>
            </div>
          )}
        </div>

        {/* Observação */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Observação</label>
          <textarea rows={2} className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Alguma observação..." value={observacao} onChange={e => setObservacao(e.target.value)} />
        </div>

        {/* Submit */}
        <button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {mutation.isPending ? <Loader2 size={20} className="animate-spin" /> : null}
          Confirmar Venda
        </button>
      </div>
    </div>
  );
}
