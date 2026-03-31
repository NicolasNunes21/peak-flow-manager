import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Search, Plus, Loader2, Package, Truck, ChevronDown, ChevronRight, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_FORNECEDORES = ["NewShape", "RamboFit", "Mercado Livre", "Site oficial da marca"];

export default function Compras() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [produtoSearch, setProdutoSearch] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<any>(null);
  const [showProdutoList, setShowProdutoList] = useState(false);
  const [showNovoProduto, setShowNovoProduto] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [custoUnit, setCustoUnit] = useState<number>(0);
  const [fornecedor, setFornecedor] = useState("");
  const [showNovoFornecedor, setShowNovoFornecedor] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dataCompra, setDataCompra] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });

  // New product form
  const [npNome, setNpNome] = useState("");
  const [npMarca, setNpMarca] = useState("");
  const [npCategoria, setNpCategoria] = useState("");
  const [npPrecoVenda, setNpPrecoVenda] = useState<number>(0);
  const [npEstoqueMin, setNpEstoqueMin] = useState<number>(5);

  // History state
  const [expandedCompra, setExpandedCompra] = useState<string | null>(null);

  // Queries
  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*").order("nome");
      return data || [];
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("*").order("nome");
      return data || [];
    },
  });

  const { data: marcas } = useQuery({
    queryKey: ["marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("marcas").select("*").order("nome");
      return data || [];
    },
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias").select("*").order("nome");
      return data || [];
    },
  });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: compras } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data } = await supabase.from("compras").select("*").order("data_compra", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: comprasMes } = useQuery({
    queryKey: ["compras-mes"],
    queryFn: async () => {
      const { data } = await supabase.from("compras").select("*").gte("data_compra", monthStart.split('T')[0]);
      return data || [];
    },
  });

  // Computed
  const fornecedorList = useMemo(() => {
    const dbNames = (fornecedores || []).map(f => f.nome);
    const all = new Set([...DEFAULT_FORNECEDORES, ...dbNames]);
    return Array.from(all).sort();
  }, [fornecedores]);

  const filteredProdutos = useMemo(() => {
    if (!produtoSearch.trim()) return [];
    const q = produtoSearch.toLowerCase();
    return (produtos || []).filter(p => p.nome.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.marca && p.marca.toLowerCase().includes(q))).slice(0, 6);
  }, [produtoSearch, produtos]);

  const totalMes = (comprasMes || []).reduce((s, c) => s + (c.custo_total || c.custo_unit * c.quantidade), 0);
  const numComprasMes = (comprasMes || []).length;

  const todayStr = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();

  const canSubmit = (selectedProduto || (showNovoProduto && npNome.trim())) && fornecedor && quantidade >= 1 && custoUnit > 0;

  // Reset form
  const resetForm = () => {
    setSelectedProduto(null); setProdutoSearch(""); setShowNovoProduto(false);
    setQuantidade(1); setCustoUnit(0); setFornecedor(""); setObservacao("");
    setShowNovoFornecedor(false); setNovoFornecedorNome("");
    setNpNome(""); setNpMarca(""); setNpCategoria(""); setNpPrecoVenda(0); setNpEstoqueMin(5);
    setDataCompra(todayStr);
  };

  // Mutations
  const compraMutation = useMutation({
    mutationFn: async () => {
      let produtoId = selectedProduto?.id || null;
      let produtoNome = selectedProduto?.nome || npNome.trim();

      // Create new product if needed
      if (showNovoProduto && npNome.trim()) {
        const { data: newProd } = await supabase.from("produtos").insert({
          nome: npNome.trim(),
          marca: npMarca || null,
          categoria: npCategoria || null,
          custo_unit: custoUnit,
          preco_venda: npPrecoVenda || null,
          estoque_min: npEstoqueMin || null,
          qtd_atual: 0, // will be updated below
          fornecedor: fornecedor,
        }).select().single();
        if (newProd) {
          produtoId = newProd.id;
          produtoNome = newProd.nome;
        }
      }

      // Save new supplier if it's a custom one
      if (fornecedor && !fornecedorList.includes(fornecedor)) {
        await supabase.from("fornecedores").insert({ nome: fornecedor });
      }

      // Insert purchase record
      await supabase.from("compras").insert({
        produto_id: produtoId,
        produto_nome: produtoNome,
        fornecedor_nome: fornecedor,
        quantidade,
        custo_unit: custoUnit,
        data_compra: dataCompra,
        observacao: observacao || null,
      });

      // Update product stock and cost
      if (produtoId) {
        const currentQtd = selectedProduto?.qtd_atual || 0;
        await supabase.from("produtos").update({
          qtd_atual: currentQtd + quantidade,
          custo_unit: custoUnit,
          fornecedor: fornecedor,
        }).eq("id", produtoId);
      }

      return { produtoNome, quantidade, custoUnit };
    },
    onSuccess: ({ produtoNome, quantidade: qty, custoUnit: cu }) => {
      toast({ title: "✅ Compra registrada", description: `${qty}× ${produtoNome} — ${formatCurrency(cu * qty)} · Estoque atualizado` });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["compras"] });
      queryClient.invalidateQueries({ queryKey: ["compras-mes"] });
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao salvar compra. Tente novamente.", variant: "destructive" });
    },
  });

  const novoFornecedorMutation = useMutation({
    mutationFn: async (nome: string) => {
      await supabase.from("fornecedores").insert({ nome });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      setFornecedor(novoFornecedorNome.trim());
      setNovoFornecedorNome("");
      setShowNovoFornecedor(false);
      toast({ title: "✅ Fornecedor cadastrado" });
    },
  });

  // Products with low stock for quick reorder
  const lowStock = useMemo(() => {
    return (produtos || []).filter(p => (p.qtd_atual ?? 0) <= (p.estoque_min ?? 0) && (p.estoque_min ?? 0) > 0).slice(0, 4);
  }, [produtos]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header + summary */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-secondary">Registrar Compra</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-destructive">{formatCurrency(totalMes)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{numComprasMes} compra{numComprasMes !== 1 ? 's' : ''} no mês</span>
          </div>
        </div>
      </div>

      <div className="space-y-5 max-w-lg mx-auto">
        {/* Low stock quick picks */}
        {lowStock.length > 0 && !selectedProduto && !showNovoProduto && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-warning">Estoque baixo — precisa repor:</p>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(p => (
                <button key={p.id} onClick={() => { setSelectedProduto(p); setCustoUnit(p.custo_unit || 0); setFornecedor(p.fornecedor || ''); }} className="px-3 py-1.5 rounded-full text-xs font-medium bg-warning/10 text-warning hover:bg-warning/20 transition-colors">
                  {p.nome.length > 22 ? p.nome.slice(0, 22) + '…' : p.nome} ({p.qtd_atual} un.)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Produto */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Produto *</label>
          {!showNovoProduto ? (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Buscar produto no estoque..."
                  value={selectedProduto ? selectedProduto.nome : produtoSearch}
                  onChange={e => { setProdutoSearch(e.target.value); setSelectedProduto(null); setShowProdutoList(true); }}
                  onFocus={() => setShowProdutoList(true)}
                />
                {showProdutoList && filteredProdutos.length > 0 && !selectedProduto && (
                  <div className="absolute z-10 w-full mt-1 bg-card border rounded-xl shadow-lg overflow-hidden">
                    {filteredProdutos.map(p => (
                      <button key={p.id} className="w-full text-left px-4 py-3 hover:bg-muted text-sm border-b last:border-0 transition-colors" onClick={() => { setSelectedProduto(p); setCustoUnit(p.custo_unit || 0); setFornecedor(p.fornecedor || ''); setProdutoSearch(""); setShowProdutoList(false); }}>
                        <p className="font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{p.marca} · Estoque: {p.qtd_atual ?? 0} un. · Custo: {formatCurrency(p.custo_unit || 0)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProduto && (
                <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold">{selectedProduto.nome}</p>
                      <p className="text-xs text-muted-foreground">{selectedProduto.marca} · {selectedProduto.categoria}</p>
                    </div>
                    <button className="text-xs text-destructive underline" onClick={() => { setSelectedProduto(null); setProdutoSearch(""); setCustoUnit(0); }}>Trocar</button>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs ${(selectedProduto.qtd_atual || 0) < (selectedProduto.estoque_min || 0) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      <Package size={12} className="inline mr-1" />{selectedProduto.qtd_atual ?? 0} un. em estoque
                    </span>
                    {selectedProduto.fornecedor && <span className="text-xs text-muted-foreground"><Truck size={12} className="inline mr-1" />{selectedProduto.fornecedor}</span>}
                  </div>
                </div>
              )}
              <button className="text-xs text-primary underline" onClick={() => { setShowNovoProduto(true); setSelectedProduto(null); setProdutoSearch(""); }}>Produto novo? Cadastrar aqui</button>
            </>
          ) : (
            <div className="space-y-3 bg-muted/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-secondary">Cadastrar novo produto</p>
                <button onClick={() => { setShowNovoProduto(false); setNpNome(""); setNpMarca(""); setNpCategoria(""); setNpPrecoVenda(0); setNpEstoqueMin(5); }} className="text-xs text-destructive underline">Cancelar</button>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full px-3 py-2 rounded-lg border bg-card text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Ex: Whey Protein 900g" value={npNome} onChange={e => setNpNome(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Marca</label>
                  <select className="w-full px-3 py-2 rounded-lg border bg-card text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary" value={npMarca} onChange={e => setNpMarca(e.target.value)}>
                    <option value="">Selecionar...</option>
                    {(marcas || []).map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <select className="w-full px-3 py-2 rounded-lg border bg-card text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary" value={npCategoria} onChange={e => setNpCategoria(e.target.value)}>
                    <option value="">Selecionar...</option>
                    {(categorias || []).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Preço de venda</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2 text-xs text-muted-foreground">R$</span>
                    <input type="number" step="0.01" className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={npPrecoVenda || ''} onChange={e => setNpPrecoVenda(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Estoque mínimo</label>
                  <input type="number" className="w-full px-3 py-2 rounded-lg border bg-card text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary" value={npEstoqueMin || ''} onChange={e => setNpEstoqueMin(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fornecedor */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Fornecedor *</label>
          <div className="flex flex-wrap gap-2">
            {fornecedorList.map(f => (
              <button key={f} onClick={() => setFornecedor(f)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] ${fornecedor === f ? "bg-secondary text-secondary-foreground shadow-md" : "bg-card border hover:bg-muted"}`}>{f}</button>
            ))}
          </div>
          {fornecedor && !fornecedorList.includes(fornecedor) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Selecionado:</span>
              <span className="text-xs font-medium">{fornecedor}</span>
              <button className="text-xs text-destructive underline" onClick={() => setFornecedor("")}>Remover</button>
            </div>
          )}
          {!showNovoFornecedor ? (
            <button className="text-xs text-primary underline" onClick={() => setShowNovoFornecedor(true)}>Outro fornecedor</button>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <input className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Nome do fornecedor" value={novoFornecedorNome} onChange={e => setNovoFornecedorNome(e.target.value)} />
              </div>
              <button disabled={!novoFornecedorNome.trim()} onClick={() => { const nome = novoFornecedorNome.trim(); novoFornecedorMutation.mutate(nome); setFornecedor(nome); }} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"><Plus size={14} /></button>
              <button onClick={() => { setShowNovoFornecedor(false); setNovoFornecedorNome(""); }} className="px-3 py-2 rounded-lg border text-xs"><X size={14} /></button>
            </div>
          )}
        </div>

        {/* Quantidade + Custo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantidade *</label>
            <input type="number" min={1} className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={quantidade || ''} onChange={e => setQuantidade(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Custo unitário *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
              <input type="number" step="0.01" className="w-full pl-10 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={custoUnit || ''} onChange={e => setCustoUnit(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        {/* Total */}
        {custoUnit > 0 && quantidade >= 1 && (
          <div className="bg-muted/50 rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold">Total: {formatCurrency(custoUnit * quantidade)}</p>
            <p className="text-xs text-muted-foreground">{quantidade} un. × {formatCurrency(custoUnit)}</p>
            {selectedProduto && selectedProduto.preco_venda > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Margem esperada: {((selectedProduto.preco_venda - custoUnit) / selectedProduto.preco_venda * 100).toFixed(1)}%
              </p>
            )}
          </div>
        )}

        {/* Data */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Data da compra</label>
          <input type="date" max={todayStr} className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
        </div>

        {/* Observação */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Observação</label>
          <textarea rows={2} className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Nº pedido, nota fiscal, link..." value={observacao} onChange={e => setObservacao(e.target.value)} />
        </div>

        {/* Submit */}
        <button disabled={!canSubmit || compraMutation.isPending} onClick={() => compraMutation.mutate()} className="w-full py-4 rounded-xl bg-secondary text-secondary-foreground font-semibold text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {compraMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Truck size={20} />}
          Registrar Compra
        </button>
      </div>

      {/* Purchase history */}
      {(compras || []).length > 0 && (
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-secondary">Últimas compras</h3>
          <div className="space-y-2">
            {(compras || []).slice(0, 15).map(c => {
              const total = c.custo_total || c.custo_unit * c.quantidade;
              const isExpanded = expandedCompra === c.id;
              return (
                <div key={c.id} className="border rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedCompra(isExpanded ? null : c.id)} className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.produto_nome}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.data_compra)} · {c.fornecedor_nome} · {c.quantidade} un.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-sm font-bold text-destructive">{formatCurrency(total)}</p>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-3 pb-3 pt-2 bg-muted/20 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Custo unitário</span>
                        <span>{formatCurrency(c.custo_unit)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Quantidade</span>
                        <span>{c.quantidade} un.</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold">{formatCurrency(total)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Fornecedor</span>
                        <span>{c.fornecedor_nome}</span>
                      </div>
                      {c.observacao && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Obs</span>
                          <span className="text-right max-w-[200px]">{c.observacao}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
