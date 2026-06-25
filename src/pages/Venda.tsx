import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, diasAtras, getRecontatoDias, margemBgClass, margemColorClass, liquidoVenda } from "@/lib/format";
import { Search, Minus, Plus, Loader2, Package, ShoppingCart, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { useCanais, useCriarCanal } from "@/lib/canaisStore";

const FORMAS_PGTO = ["PIX", "Dinheiro", "Crédito", "Débito"];

const TIPO_CANAL_LABEL: Record<string, string> = {
  loja: 'Loja',
  organico: 'Orgânico',
  pago: 'Pago',
  parceria: 'Parceria',
};

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
  const [canal, setCanal] = useState("");
  const [descontoRs, setDescontoRs] = useState<number>(0);
  const [brinde, setBrinde] = useState<string>("");
  const [showAddCanal, setShowAddCanal] = useState(false);
  const [novoCanalNome, setNovoCanalNome] = useState("");
  const [novoCanalTipo, setNovoCanalTipo] = useState<'loja' | 'organico' | 'pago' | 'parceria'>('parceria');

  // Carrinho — itens já adicionados (além do item atualmente no form)
  type ItemCarrinho = {
    id: string;
    produto_id: string | null;
    produto_nome: string;
    produto_categoria: string | null;
    qtd_atual: number | null;
    estoque_min: number | null;
    quantidade: number;
    precoVenda: number;
    custoUnit: number;
    descontoRs: number;
    brinde: string;
  };
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
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

  const { data: canaisResult } = useCanais(true);
  const canaisAtivos = useMemo(() => canaisResult?.canais || [], [canaisResult]);

  // Pré-selecionar canal default (Loja física se houver, senão o primeiro)
  useEffect(() => {
    if (!canal && canaisAtivos.length > 0) {
      const loja = canaisAtivos.find(c => c.tipo === 'loja');
      setCanal(loja?.nome || canaisAtivos[0].nome);
    }
  }, [canaisAtivos, canal]);

  const criarCanalMutation = useCriarCanal();
  const handleCriarCanal = () => {
    criarCanalMutation.mutate(
      { nome: novoCanalNome.trim(), tipo: novoCanalTipo },
      {
        onSuccess: (res) => {
          setCanal(res.canal.nome);
          setNovoCanalNome("");
          setShowAddCanal(false);
          toast({
            title: "✅ Canal adicionado",
            description: res.origem === 'local' ? 'Salvo neste navegador.' : undefined,
          });
        },
        onError: (err: any) => {
          toast({ title: "Erro ao adicionar canal", description: err?.message, variant: "destructive" as const });
        },
      }
    );
  };

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

  // Total do carrinho (já adicionados)
  const totalCarrinho = carrinho.reduce((s, i) => s + i.precoVenda * i.quantidade - i.descontoRs, 0);
  // Total do item atual (no form)
  const totalItemAtual = selectedProduto ? precoVenda * quantidade - descontoRs : 0;
  // Total final pra mostrar no botão
  const totalVenda = totalCarrinho + totalItemAtual;
  const numItens = carrinho.length + (selectedProduto ? 1 : 0);

  // Pode finalizar venda quando há ao menos 1 item (no carrinho ou no form)
  // e forma de pagamento selecionada
  const canSubmit = (selectedProduto || carrinho.length > 0) && formaPgto;

  // Adicionar item atual ao carrinho e limpar o form pra próximo item
  const adicionarAoCarrinho = () => {
    if (!selectedProduto) return;
    const novoItem: ItemCarrinho = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      produto_id: selectedProduto.id,
      produto_nome: selectedProduto.nome,
      produto_categoria: selectedProduto.categoria || null,
      qtd_atual: selectedProduto.qtd_atual ?? 0,
      estoque_min: selectedProduto.estoque_min ?? 0,
      quantidade,
      precoVenda,
      custoUnit,
      descontoRs,
      brinde: brinde.trim(),
    };
    setCarrinho(c => [...c, novoItem]);
    // Limpa só os campos do item — mantém cliente/forma/canal/data
    setSelectedProduto(null);
    setProdutoSearch("");
    setQuantidade(1);
    setPrecoVenda(0);
    setDescontoRs(0);
    setBrinde("");
  };

  const removerDoCarrinho = (id: string) => {
    setCarrinho(c => c.filter(i => i.id !== id));
  };

  const todayStr = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();

  const totalHoje = (vendasHoje || []).reduce((s, v) => s + liquidoVenda(v), 0);
  const margemHoje = (vendasHoje || []).reduce((s, v) => s + (liquidoVenda(v) - v.custo_unit * v.quantidade), 0);
  const margemPctHoje = totalHoje > 0 ? (margemHoje / totalHoje) * 100 : 0;

  const resetForm = () => {
    setSelectedProduto(null); setProdutoSearch(""); setQuantidade(1); setPrecoVenda(0);
    setFormaPgto(""); setCanal(canaisAtivos.find(c => c.tipo === 'loja')?.nome || canaisAtivos[0]?.nome || ""); setClienteSearch(""); setSelectedCliente(null);
    setNovoClienteNome(""); setNovoClienteWhats(""); setShowNovoCliente(false); setSemCadastro(false); setObservacao(""); setDescontoRs(0); setBrinde("");
    setDataVenda(todayStr);
    setCarrinho([]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // 1) Monta lista final: itens do carrinho + item atual do form (se houver)
      const itensFinais: ItemCarrinho[] = [...carrinho];
      if (selectedProduto) {
        itensFinais.push({
          id: 'current',
          produto_id: selectedProduto.id,
          produto_nome: selectedProduto.nome,
          produto_categoria: selectedProduto.categoria || null,
          qtd_atual: selectedProduto.qtd_atual ?? 0,
          estoque_min: selectedProduto.estoque_min ?? 0,
          quantidade,
          precoVenda,
          custoUnit,
          descontoRs,
          brinde: brinde.trim(),
        });
      }
      if (itensFinais.length === 0) throw new Error('Nenhum item para registrar');

      // 2) Cria cliente novo se necessário
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

      // 3) Timestamp único pra agrupar todos os itens dessa venda
      const vendaDate = new Date(dataVenda + 'T12:00:00');
      const vendaTimestamp = vendaDate.toISOString();

      // 4) Insere uma linha por item (com mesmo created_at + cliente_id, agrupador implícito)
      // Tenta com colunas extras (desconto_rs, brinde); se a migration não rodou ainda,
      // re-tenta sem essas colunas.
      const linhasComExtras = itensFinais.map(item => ({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        quantidade: item.quantidade,
        preco_venda: item.precoVenda,
        custo_unit: item.custoUnit,
        forma_pgto: formaPgto,
        canal,
        observacao: observacao || null,
        desconto_rs: item.descontoRs > 0 ? item.descontoRs : null,
        brinde: item.brinde || null,
        created_at: vendaTimestamp,
      }));
      let { error: insErr } = await supabase.from("vendas").insert(linhasComExtras as any);
      if (insErr && (
        insErr.message?.includes("'brinde'") ||
        insErr.message?.includes("'desconto_rs'") ||
        insErr.code === 'PGRST204'
      )) {
        // Coluna não existe — tenta sem desconto_rs e brinde
        const linhasBasicas = itensFinais.map(item => ({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          quantidade: item.quantidade,
          preco_venda: item.precoVenda,
          custo_unit: item.custoUnit,
          forma_pgto: formaPgto,
          canal,
          observacao: observacao || null,
          created_at: vendaTimestamp,
        }));
        const retry = await supabase.from("vendas").insert(linhasBasicas as any);
        if (retry.error) throw retry.error;
        // Avisa que descontos/brindes não foram salvos
        if (itensFinais.some(i => i.descontoRs > 0 || i.brinde)) {
          toast({
            title: "⚠ Venda salva (parcial)",
            description: "Desconto/brinde não foram gravados — colunas 'desconto_rs' e 'brinde' não existem na tabela vendas. Aplique a migration no Supabase para registrar esses campos.",
          });
        }
      } else if (insErr) {
        throw insErr;
      }

      // 5) Atualiza estoque de cada produto (consolida se mesmo produto aparece 2x)
      const stockDelta = new Map<string, number>();
      const stockSnapshot = new Map<string, { atual: number; min: number; nome: string }>();
      itensFinais.forEach(item => {
        if (!item.produto_id) return;
        stockDelta.set(item.produto_id, (stockDelta.get(item.produto_id) || 0) + item.quantidade);
        if (!stockSnapshot.has(item.produto_id)) {
          stockSnapshot.set(item.produto_id, {
            atual: item.qtd_atual ?? 0,
            min: item.estoque_min ?? 0,
            nome: item.produto_nome,
          });
        }
      });
      for (const [produtoId, totalVendido] of stockDelta.entries()) {
        const snap = stockSnapshot.get(produtoId)!;
        const novaQtd = snap.atual - totalVendido;
        await supabase.from("produtos").update({ qtd_atual: novaQtd }).eq("id", produtoId);
        if (novaQtd < snap.min) {
          toast({ title: "⚠ Estoque baixo", description: `${snap.nome} ficou abaixo do mínimo.`, variant: "destructive" });
        }
      }

      // 6) Cliente: total da venda e categoria do item mais valioso
      const totalVendaCalc = itensFinais.reduce((s, i) => s + i.precoVenda * i.quantidade - i.descontoRs, 0);
      if (clienteId) {
        const itemMaiorValor = [...itensFinais].sort((a, b) => (b.precoVenda * b.quantidade) - (a.precoVenda * a.quantidade))[0];
        const categoria = itemMaiorValor.produto_categoria || '';
        const recontatoDias = getRecontatoDias(categoria);
        const proximoRecontato = new Date();
        proximoRecontato.setDate(proximoRecontato.getDate() + recontatoDias);
        const currentTotal = selectedCliente?.total_acumulado || 0;
        await supabase.from("clientes").update({
          data_ultima_compra: dataVenda,
          total_acumulado: currentTotal + totalVendaCalc,
          ultimo_produto_categoria: categoria,
          valor_ultima_compra: totalVendaCalc,
          data_proximo_recontato: proximoRecontato.toISOString().split('T')[0],
          status: (currentTotal + totalVendaCalc) >= 500 ? 'VIP' : 'Ativo',
        }).eq("id", clienteId);
      }

      return { totalVendaCalc, numItens: itensFinais.length };
    },
    onSuccess: ({ totalVendaCalc, numItens }) => {
      toast({
        title: "✅ Venda registrada",
        description: numItens > 1
          ? `${numItens} itens · Total ${formatCurrency(totalVendaCalc)}`
          : `Total ${formatCurrency(totalVendaCalc)}`,
      });
      queryClient.invalidateQueries();
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message || "Erro ao salvar. Tente novamente.", variant: "destructive" });
    },
  });

  const selectProdutoById = (id: string) => {
    const p = (produtos || []).find(pr => pr.id === id);
    if (p) { setSelectedProduto(p); setPrecoVenda(p.preco_venda || 0); setProdutoSearch(""); setShowProdutoList(false); }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Registrar Venda"
        subtitle={`Hoje: ${formatCurrency(totalHoje)} · ${(vendasHoje || []).length} vendas · Margem ${formatPercent(margemPctHoje)}`}
        icon={<ShoppingCart size={20} strokeWidth={2.5} />}
        iconGradient
      />

      {/* Form only — no sidebar */}
      <div className="space-y-5 max-w-lg mx-auto">
        {/* Quick picks */}
        {topProdutosSemana.length > 0 && !selectedProduto && (
          <div className="space-y-1.5 text-center">
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
          <label className="text-sm font-medium text-center block">Produto *</label>
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
        <div className="space-y-2 text-center">
          <label className="text-sm font-medium">Quantidade</label>
          <div className="flex items-center justify-center gap-3">
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
          <label className="text-sm font-medium text-center block">Preço de venda</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
            <input type="number" step="0.01" className="w-full pl-10 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={precoVenda || ''} onChange={e => setPrecoVenda(parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        {/* Forma de pagamento */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-center block">Forma de pagamento *</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS_PGTO.map(f => (
              <button key={f} onClick={() => setFormaPgto(f)} className={`py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${formaPgto === f ? "bg-primary text-primary-foreground shadow-md" : "bg-card border hover:bg-muted"}`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Canal */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-center block">Canal</label>
          <div className="flex flex-wrap gap-2">
            {canaisAtivos.map(c => (
              <button
                key={c.id}
                onClick={() => setCanal(c.nome)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] flex items-center gap-1.5 ${canal === c.nome ? "bg-secondary text-secondary-foreground" : "bg-card border hover:bg-muted"}`}
              >
                <span>{c.nome}</span>
                <span className={`text-[9px] uppercase ${canal === c.nome ? 'opacity-70' : 'text-muted-foreground'}`}>{TIPO_CANAL_LABEL[c.tipo] || c.tipo}</span>
              </button>
            ))}
            <button
              onClick={() => setShowAddCanal(true)}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-dashed text-muted-foreground hover:bg-muted transition-all active:scale-[0.97] flex items-center gap-1"
            >
              <Plus size={12} /> Novo
            </button>
          </div>
          {showAddCanal && (
            <div className="bg-muted/50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-secondary">Novo canal de venda</p>
              <input
                autoFocus
                placeholder="Nome do canal (ex: Personal João, Crossfit Box X)"
                className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={novoCanalNome}
                onChange={e => setNovoCanalNome(e.target.value)}
              />
              <select
                className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={novoCanalTipo}
                onChange={e => setNovoCanalTipo(e.target.value as any)}
              >
                <option value="parceria">Parceria (personal, academia, indicação remunerada)</option>
                <option value="organico">Orgânico (Instagram, indicação grátis, boca a boca)</option>
                <option value="pago">Pago (Meta Ads, Google Ads, impulsionamento)</option>
                <option value="loja">Loja (canal próprio físico/digital)</option>
              </select>
              <div className="flex gap-2">
                <button
                  disabled={!novoCanalNome.trim() || criarCanalMutation.isPending}
                  onClick={handleCriarCanal}
                  className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {criarCanalMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Salvar
                </button>
                <button
                  onClick={() => { setShowAddCanal(false); setNovoCanalNome(""); }}
                  className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Data da venda */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-center block">Data da venda</label>
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
          <label className="text-sm font-medium text-center block">Cliente (opcional)</label>
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

        {/* Desconto e brinde */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-center block">Desconto</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-xs text-muted-foreground">R$</span>
              <input
                type="number" step="0.01" min={0}
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={descontoRs || ''}
                onChange={e => setDescontoRs(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-center block">Brinde</label>
            <input
              type="text"
              placeholder="ex: Pasta amendoim"
              className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={brinde}
              onChange={e => setBrinde(e.target.value)}
            />
          </div>
        </div>

        {(descontoRs > 0 || brinde.trim()) && selectedProduto && (
          <div className="bg-warning/5 border border-warning/30 rounded-xl p-3 text-xs">
            <p className="font-semibold text-warning mb-0.5">Resumo</p>
            <p className="text-muted-foreground">
              Valor cheio: {formatCurrency(precoVenda * quantidade)} ·
              {descontoRs > 0 && ` Desconto: −${formatCurrency(descontoRs)} ·`}
              {brinde.trim() && ` Brinde: ${brinde}`}
            </p>
            <p className="font-bold mt-1">
              Total cobrado: {formatCurrency(precoVenda * quantidade - descontoRs)}
            </p>
          </div>
        )}

        {/* Botão: adicionar mais um item ao carrinho */}
        {selectedProduto && (
          <button
            onClick={adicionarAoCarrinho}
            type="button"
            className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} strokeWidth={2.5} />
            Adicionar este item e incluir mais um
          </button>
        )}

        {/* Carrinho — itens já adicionados */}
        {carrinho.length > 0 && (
          <div className="bg-card rounded-2xl p-4 card-elev space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">No carrinho ({carrinho.length})</p>
              <button onClick={() => setCarrinho([])} className="text-[11px] text-muted-foreground hover:text-destructive">Limpar</button>
            </div>
            {carrinho.map(item => {
              const totalItem = item.precoVenda * item.quantidade - item.descontoRs;
              return (
                <div key={item.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.produto_nome}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {item.quantidade}× {formatCurrency(item.precoVenda)}
                      {item.descontoRs > 0 && ` − ${formatCurrency(item.descontoRs)} desc.`}
                      {item.brinde && ` · 🎁 ${item.brinde}`}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums whitespace-nowrap">{formatCurrency(totalItem)}</p>
                  <button onClick={() => removerDoCarrinho(item.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="font-medium">Subtotal do carrinho</span>
              <span className="font-bold tabular-nums">{formatCurrency(totalCarrinho)}</span>
            </div>
          </div>
        )}

        {/* Observação */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-center block">Observação</label>
          <textarea rows={2} className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Alguma observação..." value={observacao} onChange={e => setObservacao(e.target.value)} />
        </div>

        {/* Submit */}
        <button
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="w-full py-4 rounded-xl bg-gradient-to-br from-primary to-[hsl(192_85%_32%)] text-primary-foreground font-semibold text-base pressable shadow-[0_8px_24px_-8px_hsl(192_83%_38%/0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {mutation.isPending && <Loader2 size={20} className="animate-spin" />}
          {numItens > 1
            ? `Finalizar venda (${numItens} itens · ${formatCurrency(totalVenda)})`
            : numItens === 1
              ? `Confirmar Venda · ${formatCurrency(totalVenda)}`
              : 'Confirmar Venda'}
        </button>
      </div>
    </div>
  );
}
