import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Plus, Search, Pencil, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Produto = {
  id: string; sku: string | null; nome: string; marca: string | null; categoria: string | null;
  sabor: string | null; qtd_atual: number | null; custo_unit: number | null; preco_venda: number | null;
  estoque_min: number | null; pto_reposicao: number | null; validade: string | null;
  classe_abc: string | null; fornecedor: string | null;
};

function getStatus(p: Produto) {
  const qtd = p.qtd_atual ?? 0;
  if (qtd < (p.estoque_min ?? 0)) return "repor";
  if (qtd < (p.pto_reposicao ?? 0)) return "atencao";
  return "ok";
}

const CATEGORIAS = ['Whey', 'Creatina', 'Pré-treino', 'Sobremesa', 'Vitamina', 'Outro'];
const MARCAS = ['DUX', 'Max Titanium', 'Dr. Peanut', 'Gummy', 'Lauton', 'Outro'];
const CLASSES = ['A', 'B', 'C'];

export default function Estoque() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [editProduto, setEditProduto] = useState<Produto | null>(null);
  const [showNovo, setShowNovo] = useState(false);

  // Edit modal state
  const [editQtd, setEditQtd] = useState(0);
  const [editCusto, setEditCusto] = useState(0);

  // New product state
  const [novoForm, setNovoForm] = useState({
    nome: '', marca: 'DUX', categoria: 'Whey', sabor: '', qtd_atual: 0,
    custo_unit: 0, preco_venda: 0, estoque_min: 5, pto_reposicao: 8,
    validade: '', classe_abc: 'B', fornecedor: '',
  });

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*").order("nome");
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("produtos").update({
        qtd_atual: editQtd,
        custo_unit: editCusto,
      }).eq("id", editProduto!.id);
    },
    onSuccess: () => {
      toast({ title: "✅ Estoque atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setEditProduto(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("produtos").insert({
        nome: novoForm.nome,
        marca: novoForm.marca,
        categoria: novoForm.categoria,
        sabor: novoForm.sabor || null,
        qtd_atual: novoForm.qtd_atual,
        custo_unit: novoForm.custo_unit,
        preco_venda: novoForm.preco_venda,
        estoque_min: novoForm.estoque_min,
        pto_reposicao: novoForm.pto_reposicao,
        validade: novoForm.validade || null,
        classe_abc: novoForm.classe_abc,
        fornecedor: novoForm.fornecedor || null,
      });
    },
    onSuccess: () => {
      toast({ title: "✅ Produto adicionado!" });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setShowNovo(false);
      setNovoForm({ nome: '', marca: 'DUX', categoria: 'Whey', sabor: '', qtd_atual: 0, custo_unit: 0, preco_venda: 0, estoque_min: 5, pto_reposicao: 8, validade: '', classe_abc: 'B', fornecedor: '' });
    },
  });

  const filtered = (produtos || []).filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.nome.toLowerCase().includes(q) || (p.marca && p.marca.toLowerCase().includes(q));
    const status = getStatus(p);
    if (tab === "repor") return matchSearch && status === "repor";
    if (tab === "atencao") return matchSearch && status === "atencao";
    if (tab === "ok") return matchSearch && status === "ok";
    return matchSearch;
  });

  const counts = {
    repor: (produtos || []).filter(p => getStatus(p) === "repor").length,
    atencao: (produtos || []).filter(p => getStatus(p) === "atencao").length,
  };

  const valorEstoque = (produtos || []).reduce((s, p) => s + (p.qtd_atual || 0) * (p.custo_unit || 0), 0);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-secondary">Estoque</h1>
        <button onClick={() => setShowNovo(true)} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
          <Plus size={20} />
        </button>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl p-3 shadow-sm text-sm">
        <span className="font-medium">{(produtos || []).length} SKUs ativos</span>
        <span className="text-muted-foreground"> · Valor em estoque: </span>
        <span className="font-semibold">{formatCurrency(valorEstoque)}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "todos", label: "Todos" },
          { key: "repor", label: "Repor agora", count: counts.repor, color: "bg-destructive" },
          { key: "atencao", label: "Atenção", count: counts.atencao, color: "bg-warning" },
          { key: "ok", label: "OK" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === t.key ? "bg-secondary text-secondary-foreground" : "bg-card border hover:bg-muted"
            }`}
          >
            {t.label}
            {t.count ? (
              <span className={`${t.color} text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold`}>{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Buscar por nome ou marca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {filtered.map(p => {
          const status = getStatus(p);
          const margem = (p.preco_venda && p.custo_unit) ? ((p.preco_venda - p.custo_unit) / p.preco_venda) * 100 : 0;
          const diasValidade = p.validade ? Math.floor((new Date(p.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

          return (
            <div key={p.id} className="bg-card rounded-xl p-4 shadow-sm flex items-start gap-3">
              <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                status === "repor" ? "bg-destructive" : status === "atencao" ? "bg-warning" : "bg-success"
              }`} />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold truncate">{p.nome}</p>
                <p className="text-xs text-muted-foreground">{p.marca}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className={status === "repor" ? "text-destructive font-medium" : status === "atencao" ? "text-warning font-medium" : ""}>
                    {p.qtd_atual} un.
                  </span>
                  <span>{formatCurrency(p.preco_venda || 0)}</span>
                  <span>Margem {formatPercent(margem)}</span>
                  {diasValidade !== null && diasValidade < 30 && (
                    <span className="text-warning font-medium">Vence em {diasValidade}d</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setEditProduto(p); setEditQtd(p.qtd_atual || 0); setEditCusto(p.custo_unit || 0); }}
                className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors active:scale-95"
              >
                <Pencil size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editProduto && (
        <Modal onClose={() => setEditProduto(null)} title="Atualizar estoque">
          <p className="text-sm text-muted-foreground mb-4">{editProduto.nome}</p>
          <div className="space-y-3">
            <Field label="Nova quantidade" type="number" value={editQtd} onChange={v => setEditQtd(parseInt(v) || 0)} />
            <Field label="Custo unitário (R$)" type="number" value={editCusto} onChange={v => setEditCusto(parseFloat(v) || 0)} step="0.01" />
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98] disabled:opacity-50"
            >
              Atualizar
            </button>
          </div>
        </Modal>
      )}

      {/* New Product Modal */}
      {showNovo && (
        <Modal onClose={() => setShowNovo(false)} title="Novo produto">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <Field label="Nome *" value={novoForm.nome} onChange={v => setNovoForm(f => ({ ...f, nome: v }))} />
            <SelectField label="Marca *" value={novoForm.marca} options={MARCAS} onChange={v => setNovoForm(f => ({ ...f, marca: v }))} />
            <SelectField label="Categoria *" value={novoForm.categoria} options={CATEGORIAS} onChange={v => setNovoForm(f => ({ ...f, categoria: v }))} />
            <Field label="Sabor" value={novoForm.sabor} onChange={v => setNovoForm(f => ({ ...f, sabor: v }))} />
            <Field label="Qtd atual *" type="number" value={novoForm.qtd_atual} onChange={v => setNovoForm(f => ({ ...f, qtd_atual: parseInt(v) || 0 }))} />
            <Field label="Custo unit. (R$)" type="number" value={novoForm.custo_unit} onChange={v => setNovoForm(f => ({ ...f, custo_unit: parseFloat(v) || 0 }))} step="0.01" />
            <Field label="Preço venda (R$)" type="number" value={novoForm.preco_venda} onChange={v => setNovoForm(f => ({ ...f, preco_venda: parseFloat(v) || 0 }))} step="0.01" />
            <Field label="Estoque mínimo *" type="number" value={novoForm.estoque_min} onChange={v => setNovoForm(f => ({ ...f, estoque_min: parseInt(v) || 0 }))} />
            <Field label="Ponto reposição *" type="number" value={novoForm.pto_reposicao} onChange={v => setNovoForm(f => ({ ...f, pto_reposicao: parseInt(v) || 0 }))} />
            <Field label="Validade" type="date" value={novoForm.validade} onChange={v => setNovoForm(f => ({ ...f, validade: v }))} />
            <SelectField label="Classe ABC" value={novoForm.classe_abc} options={CLASSES} onChange={v => setNovoForm(f => ({ ...f, classe_abc: v }))} />
            <Field label="Fornecedor" value={novoForm.fornecedor} onChange={v => setNovoForm(f => ({ ...f, fornecedor: v }))} />
            <button
              onClick={() => createMutation.mutate()}
              disabled={!novoForm.nome || createMutation.isPending}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98] disabled:opacity-50"
            >
              Adicionar produto
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-secondary">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, step }: { label: string; type?: string; value: any; onChange: (v: string) => void; step?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        step={step}
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
