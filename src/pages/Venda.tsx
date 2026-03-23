import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, getRecontatoDias } from "@/lib/format";
import { Search, Minus, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const FORMAS_PGTO = ["PIX", "Dinheiro", "Crédito", "Débito"];
const CANAIS = ["Loja física", "Delivery", "Academia parceira"];

export default function Venda() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      return data || [];
    },
  });

  const filteredProdutos = useMemo(() => {
    if (!produtoSearch.trim()) return [];
    const q = produtoSearch.toLowerCase();
    return (produtos || []).filter(p =>
      p.nome.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [produtoSearch, produtos]);

  const filteredClientes = useMemo(() => {
    if (!clienteSearch.trim()) return [];
    const q = clienteSearch.toLowerCase();
    return (clientes || []).filter(c => c.nome.toLowerCase().includes(q)).slice(0, 5);
  }, [clienteSearch, clientes]);

  const custoUnit = selectedProduto?.custo_unit || 0;
  const margemPct = precoVenda > 0 ? ((precoVenda - custoUnit) / precoVenda) * 100 : 0;
  const margemRs = precoVenda - custoUnit;
  const margemColor = margemPct >= 31 ? "bg-success text-success-foreground" : margemPct >= 25 ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground";

  const canSubmit = selectedProduto && formaPgto;

  const mutation = useMutation({
    mutationFn: async () => {
      let clienteId = selectedCliente?.id || null;
      let clienteNome = selectedCliente?.nome || null;

      // Create new client if needed
      if (showNovoCliente && novoClienteNome) {
        const { data: newCliente } = await supabase.from("clientes").insert({
          nome: novoClienteNome,
          whatsapp: novoClienteWhats || null,
          data_primeira_compra: new Date().toISOString().split('T')[0],
          data_ultima_compra: new Date().toISOString().split('T')[0],
          status: 'Novo',
        }).select().single();
        if (newCliente) {
          clienteId = newCliente.id;
          clienteNome = newCliente.nome;
        }
      }

      // Insert venda
      const totalPreco = precoVenda * quantidade;
      await supabase.from("vendas").insert({
        produto_id: selectedProduto.id,
        produto_nome: selectedProduto.nome,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        quantidade,
        preco_venda: precoVenda,
        custo_unit: custoUnit,
        forma_pgto: formaPgto,
        canal,
        observacao: observacao || null,
      });

      // Decrement stock
      await supabase.from("produtos").update({
        qtd_atual: (selectedProduto.qtd_atual || 0) - quantidade,
      }).eq("id", selectedProduto.id);

      // Update client if linked
      if (clienteId) {
        const categoria = selectedProduto.categoria || '';
        const recontatoDias = getRecontatoDias(categoria);
        const proximoRecontato = new Date();
        proximoRecontato.setDate(proximoRecontato.getDate() + recontatoDias);

        const currentTotal = selectedCliente?.total_acumulado || 0;
        await supabase.from("clientes").update({
          data_ultima_compra: new Date().toISOString().split('T')[0],
          total_acumulado: currentTotal + totalPreco,
          ultimo_produto_categoria: categoria,
          valor_ultima_compra: totalPreco,
          data_proximo_recontato: proximoRecontato.toISOString().split('T')[0],
          status: (currentTotal + totalPreco) >= 500 ? 'VIP' : 'Ativo',
        }).eq("id", clienteId);
      }

      // Check low stock
      const newQtd = (selectedProduto.qtd_atual || 0) - quantidade;
      if (newQtd < (selectedProduto.estoque_min || 0)) {
        toast({
          title: "⚠ Estoque baixo",
          description: `${selectedProduto.nome} ficou abaixo do mínimo.`,
          variant: "destructive",
        });
      }

      return totalPreco;
    },
    onSuccess: (totalPreco) => {
      toast({ title: "✅ Venda registrada!", description: `Venda de ${formatCurrency(totalPreco)} registrada!` });
      queryClient.invalidateQueries();
      navigate("/");
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao salvar. Tente novamente.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5 animate-fade-in max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-secondary">Registrar Venda</h1>

      {/* Produto */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Produto *</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Buscar por nome ou SKU..."
            value={selectedProduto ? selectedProduto.nome : produtoSearch}
            onChange={e => {
              setProdutoSearch(e.target.value);
              setSelectedProduto(null);
              setShowProdutoList(true);
            }}
            onFocus={() => setShowProdutoList(true)}
          />
          {showProdutoList && filteredProdutos.length > 0 && !selectedProduto && (
            <div className="absolute z-10 w-full mt-1 bg-card border rounded-xl shadow-lg overflow-hidden">
              {filteredProdutos.map(p => (
                <button
                  key={p.id}
                  className="w-full text-left px-4 py-3 hover:bg-muted text-sm border-b last:border-0 transition-colors"
                  onClick={() => {
                    setSelectedProduto(p);
                    setPrecoVenda(p.preco_venda || 0);
                    setProdutoSearch("");
                    setShowProdutoList(false);
                  }}
                >
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.sku} · {formatCurrency(p.preco_venda || 0)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedProduto && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{selectedProduto.nome}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${margemColor}`}>
              Margem {formatPercent(margemPct)}
            </span>
            <button className="text-xs text-destructive underline" onClick={() => { setSelectedProduto(null); setProdutoSearch(""); }}>
              Trocar
            </button>
          </div>
        )}
      </div>

      {/* Quantidade */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Quantidade</label>
        <div className="flex items-center gap-3">
          <button
            className="w-10 h-10 rounded-xl border bg-card flex items-center justify-center transition-colors hover:bg-muted active:scale-95"
            onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
          >
            <Minus size={16} />
          </button>
          <span className="text-lg font-bold w-10 text-center">{quantidade}</span>
          <button
            className="w-10 h-10 rounded-xl border bg-card flex items-center justify-center transition-colors hover:bg-muted active:scale-95"
            onClick={() => setQuantidade(quantidade + 1)}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Margem */}
      {selectedProduto && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${margemColor}`}>
          Margem: {formatPercent(margemPct)} — {formatCurrency(margemRs)} por unidade
        </div>
      )}

      {/* Preço */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Preço de venda</label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
          <input
            type="number"
            step="0.01"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={precoVenda || ''}
            onChange={e => setPrecoVenda(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Forma de pagamento */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Forma de pagamento *</label>
        <div className="grid grid-cols-2 gap-2">
          {FORMAS_PGTO.map(f => (
            <button
              key={f}
              onClick={() => setFormaPgto(f)}
              className={`py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
                formaPgto === f
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card border hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Canal */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Canal</label>
        <div className="flex gap-2">
          {CANAIS.map(c => (
            <button
              key={c}
              onClick={() => setCanal(c)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] ${
                canal === c
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-card border hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Cliente (opcional)</label>
        {!semCadastro && !showNovoCliente && !selectedCliente && (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Buscar cliente..."
                value={clienteSearch}
                onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                onFocus={() => setShowClienteList(true)}
              />
              {showClienteList && filteredClientes.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border rounded-xl shadow-lg overflow-hidden">
                  {filteredClientes.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted text-sm border-b last:border-0"
                      onClick={() => {
                        setSelectedCliente(c);
                        setClienteSearch("");
                        setShowClienteList(false);
                      }}
                    >
                      {c.nome}
                    </button>
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
            <input
              className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nome do cliente"
              value={novoClienteNome}
              onChange={e => setNovoClienteNome(e.target.value)}
            />
            <input
              className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="WhatsApp (opcional)"
              value={novoClienteWhats}
              onChange={e => setNovoClienteWhats(e.target.value)}
            />
            <button className="text-xs text-destructive underline" onClick={() => { setShowNovoCliente(false); setNovoClienteNome(""); setNovoClienteWhats(""); }}>Cancelar</button>
          </div>
        )}
      </div>

      {/* Observação */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Observação</label>
        <textarea
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Alguma observação..."
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
        />
      </div>

      {/* Submit */}
      <button
        disabled={!canSubmit || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {mutation.isPending ? <Loader2 size={20} className="animate-spin" /> : null}
        Confirmar Venda
      </button>
    </div>
  );
}
