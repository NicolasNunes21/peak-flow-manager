import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatPercent, margemColorClass } from "@/lib/format";
import { Plus, Search, Pencil, X, Download, Upload, List, Table2, Filter, Check, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

const CLASSES = ['A', 'B', 'C'];

export default function Estoque() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
  const [editProduto, setEditProduto] = useState<Produto | null>(null);
  const [showNovo, setShowNovo] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingInline, setEditingInline] = useState<string | null>(null);
  const [inlineData, setInlineData] = useState<Partial<Produto>>({});
  const [sortCol, setSortCol] = useState<string>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterMarcas, setFilterMarcas] = useState<string[]>([]);
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [filterClasses, setFilterClasses] = useState<string[]>([]);
  const [filterVencendo, setFilterVencendo] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<string | null>(null);

  const [editQtd, setEditQtd] = useState(0);
  const [editCusto, setEditCusto] = useState(0);

  const [novoForm, setNovoForm] = useState({
    nome: '', marca: '', categoria: '', sabor: '', qtd_atual: 0,
    custo_unit: 0, preco_venda: 0, estoque_min: 5, pto_reposicao: 8,
    validade: '', classe_abc: 'B', fornecedor: '',
  });

  // Dynamic marcas and categorias
  const { data: marcasDb } = useQuery({
    queryKey: ["marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("marcas").select("*").order("nome");
      return (data || []) as { id: string; nome: string }[];
    },
  });
  const { data: categoriasDb } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias").select("*").order("nome");
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const marcasList = useMemo(() => (marcasDb || []).map(m => m.nome), [marcasDb]);
  const categoriasList = useMemo(() => (categoriasDb || []).map(c => c.nome), [categoriasDb]);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*").order("nome");
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, any> }) => {
      await supabase.from("produtos").update(data.updates).eq("id", data.id);
    },
    onSuccess: () => {
      toast({ title: "✅ Estoque atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setEditProduto(null);
      setEditingInline(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("produtos").insert({
        nome: novoForm.nome, marca: novoForm.marca || null, categoria: novoForm.categoria || null,
        sabor: novoForm.sabor || null, qtd_atual: novoForm.qtd_atual,
        custo_unit: novoForm.custo_unit, preco_venda: novoForm.preco_venda,
        estoque_min: novoForm.estoque_min, pto_reposicao: novoForm.pto_reposicao,
        validade: novoForm.validade || null, classe_abc: novoForm.classe_abc,
        fornecedor: novoForm.fornecedor || null,
      });
    },
    onSuccess: () => {
      toast({ title: "✅ Produto adicionado!" });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setShowNovo(false);
      setNovoForm({ nome: '', marca: '', categoria: '', sabor: '', qtd_atual: 0, custo_unit: 0, preco_venda: 0, estoque_min: 5, pto_reposicao: 8, validade: '', classe_abc: 'B', fornecedor: '' });
    },
  });

  const filtered = useMemo(() => {
    let list = (produtos || []).filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.nome.toLowerCase().includes(q) || (p.marca && p.marca.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q));
      const status = getStatus(p);
      if (tab === "repor" && status !== "repor") return false;
      if (tab === "atencao" && status !== "atencao") return false;
      if (tab === "ok" && status !== "ok") return false;
      if (filterMarcas.length && !filterMarcas.includes(p.marca || '')) return false;
      if (filterCats.length && !filterCats.includes(p.categoria || '')) return false;
      if (filterClasses.length && !filterClasses.includes(p.classe_abc || '')) return false;
      if (filterVencendo) {
        const diasVal = p.validade ? Math.floor((new Date(p.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
        if (diasVal >= 30) return false;
      }
      return matchSearch;
    });

    list.sort((a, b) => {
      let va: any = (a as any)[sortCol];
      let vb: any = (b as any)[sortCol];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [produtos, search, tab, sortCol, sortDir, filterMarcas, filterCats, filterClasses, filterVencendo]);

  const counts = {
    repor: (produtos || []).filter(p => getStatus(p) === "repor").length,
    atencao: (produtos || []).filter(p => getStatus(p) === "atencao").length,
  };

  const valorEstoque = (produtos || []).reduce((s, p) => s + (p.qtd_atual || 0) * (p.custo_unit || 0), 0);
  const margemMedia = (() => {
    const all = produtos || [];
    if (!all.length) return 0;
    const total = all.reduce((s, p) => s + ((p.preco_venda && p.custo_unit && p.preco_venda > 0) ? ((p.preco_venda - p.custo_unit) / p.preco_venda) * 100 : 0), 0);
    return total / all.length;
  })();

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const exportCsv = () => {
    const headers = ['sku', 'nome', 'marca', 'categoria', 'sabor', 'qtd_atual', 'custo_unit', 'preco_venda', 'estoque_min', 'pto_reposicao', 'validade', 'classe_abc', 'fornecedor'];
    const rows = filtered.map(p => headers.map(h => (p as any)[h] ?? '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'estoque.csv'; a.click();
  };

  const downloadTemplate = () => {
    const headers = 'sku,nome,marca,categoria,sabor,qtd_atual,custo_unit,preco_venda,estoque_min,pto_reposicao,validade,classe_abc,fornecedor';
    const example = 'WH-001,Whey Exemplo 900g,DUX,Whey,Chocolate,10,128.00,189.90,5,8,2026-12-31,A,Fornecedor X';
    const blob = new Blob([headers + '\n' + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modelo_estoque.csv'; a.click();
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => obj[h] = vals[i]?.trim() || '');
        return obj;
      });
      setCsvData(data);
    };
    reader.readAsText(file);
  };

  const importCsv = async () => {
    let created = 0, updated = 0, errors = 0;
    for (const row of csvData) {
      try {
        const payload = {
          nome: row.nome, marca: row.marca || null, categoria: row.categoria || null,
          sabor: row.sabor || null, qtd_atual: parseInt(row.qtd_atual) || 0,
          custo_unit: parseFloat(row.custo_unit) || 0, preco_venda: parseFloat(row.preco_venda) || 0,
          estoque_min: parseInt(row.estoque_min) || 5, pto_reposicao: parseInt(row.pto_reposicao) || 8,
          validade: row.validade || null, classe_abc: row.classe_abc || 'B',
          fornecedor: row.fornecedor || null, sku: row.sku || null,
        };
        if (row.sku) {
          const { data: existing } = await supabase.from("produtos").select("id").eq("sku", row.sku).maybeSingle();
          if (existing) {
            await supabase.from("produtos").update(payload).eq("id", existing.id);
            updated++;
          } else {
            await supabase.from("produtos").insert(payload);
            created++;
          }
        } else {
          await supabase.from("produtos").insert(payload);
          created++;
        }
      } catch { errors++; }
    }
    setImportResult(`${created} criados | ${updated} atualizados | ${errors} erros`);
    queryClient.invalidateQueries({ queryKey: ["produtos"] });
  };

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-secondary">Estoque</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(v => v === 'table' ? 'list' : 'table')} className="p-2 rounded-lg border hover:bg-muted" title="Alternar modo">
            {viewMode === 'table' ? <List size={18} /> : <Table2 size={18} />}
          </button>
          <button onClick={() => setShowFilter(!showFilter)} className="p-2 rounded-lg border hover:bg-muted" title="Filtrar">
            <Filter size={18} />
          </button>
          <button onClick={exportCsv} className="p-2 rounded-lg border hover:bg-muted" title="Exportar CSV">
            <Download size={18} />
          </button>
          <button onClick={() => setShowImport(true)} className="p-2 rounded-lg border hover:bg-muted" title="Importar CSV">
            <Upload size={18} />
          </button>
          <button onClick={() => setShowNovo(true)} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center active:scale-95">
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl p-3 shadow-sm text-sm">
        <span className="font-medium">{(produtos || []).length} SKUs</span>
        <span className="text-muted-foreground"> · Valor: </span>
        <span className="font-semibold">{formatCurrency(valorEstoque)}</span>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-3 border">
          <p className="text-xs font-semibold text-secondary">Filtros avançados</p>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Marca</p>
            <div className="flex flex-wrap gap-2">
              {marcasList.map(m => (
                <button key={m} onClick={() => setFilterMarcas(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterMarcas.includes(m) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Categoria</p>
            <div className="flex flex-wrap gap-2">
              {categoriasList.map(c => (
                <button key={c} onClick={() => setFilterCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCats.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Classe ABC</p>
            <div className="flex gap-2">
              {CLASSES.map(c => (
                <button key={c} onClick={() => setFilterClasses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterClasses.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{c}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={filterVencendo} onChange={e => setFilterVencendo(e.target.checked)} className="rounded" />
            Apenas vencendo em 30 dias
          </label>
          <button onClick={() => { setFilterMarcas([]); setFilterCats([]); setFilterClasses([]); setFilterVencendo(false); }} className="text-xs text-destructive underline">Limpar filtros</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "todos", label: "Todos" },
          { key: "repor", label: "Repor agora", count: counts.repor, color: "bg-destructive" },
          { key: "atencao", label: "Atenção", count: counts.atencao, color: "bg-warning" },
          { key: "ok", label: "OK" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${tab === t.key ? "bg-secondary text-secondary-foreground" : "bg-card border hover:bg-muted"}`}>
            {t.label}
            {t.count ? <span className={`${t.color} text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold`}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Buscar por nome, marca ou SKU..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table view */}
      {viewMode === 'table' ? (
        <div className="bg-card rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                {[
                  { key: 'status', label: '' },
                  { key: 'sku', label: 'SKU' },
                  { key: 'nome', label: 'Produto' },
                  { key: 'marca', label: 'Marca' },
                  { key: 'categoria', label: 'Cat.' },
                  { key: 'qtd_atual', label: 'Qtd' },
                  { key: 'custo_unit', label: 'Custo' },
                  { key: 'preco_venda', label: 'Venda' },
                  { key: 'margem', label: 'Margem' },
                  { key: 'estoque_min', label: 'Mín' },
                  { key: 'pto_reposicao', label: 'Repos.' },
                  { key: 'valor_estoque', label: 'Val. Est.' },
                  { key: 'validade', label: 'Validade' },
                  { key: 'classe_abc', label: 'ABC' },
                ].map(col => (
                  <th key={col.key} className="px-2 py-2 text-left font-medium whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => col.key !== 'status' && col.key !== 'margem' && col.key !== 'valor_estoque' && toggleSort(col.key)}>
                    <span className="flex items-center gap-1">{col.label} {sortCol === col.key && <ArrowUpDown size={10} />}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const status = getStatus(p);
                const margem = (p.preco_venda && p.custo_unit && p.preco_venda > 0) ? ((p.preco_venda - p.custo_unit) / p.preco_venda) * 100 : 0;
                const valEstoque = (p.qtd_atual || 0) * (p.custo_unit || 0);
                const diasVal = p.validade ? Math.floor((new Date(p.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const isEditing = editingInline === p.id;

                if (isEditing) {
                  return (
                    <tr key={p.id} className="border-b bg-accent/20">
                      <td className="px-2 py-1"><span className={`inline-block w-2 h-2 rounded-full ${status === 'repor' ? 'bg-destructive' : status === 'atencao' ? 'bg-warning' : 'bg-success'}`} /></td>
                      <td className="px-2 py-1"><input className="w-16 px-1 py-0.5 border rounded text-xs" value={inlineData.sku || ''} onChange={e => setInlineData(d => ({ ...d, sku: e.target.value }))} /></td>
                      <td className="px-2 py-1"><input className="w-32 px-1 py-0.5 border rounded text-xs" value={inlineData.nome || ''} onChange={e => setInlineData(d => ({ ...d, nome: e.target.value }))} /></td>
                      <td className="px-2 py-1">
                        <select className="w-20 px-1 py-0.5 border rounded text-xs" value={inlineData.marca || ''} onChange={e => setInlineData(d => ({ ...d, marca: e.target.value }))}>
                          <option value="">—</option>
                          {marcasList.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select className="w-20 px-1 py-0.5 border rounded text-xs" value={inlineData.categoria || ''} onChange={e => setInlineData(d => ({ ...d, categoria: e.target.value }))}>
                          <option value="">—</option>
                          {categoriasList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><input type="number" className="w-12 px-1 py-0.5 border rounded text-xs" value={inlineData.qtd_atual ?? 0} onChange={e => setInlineData(d => ({ ...d, qtd_atual: parseInt(e.target.value) || 0 }))} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className="w-16 px-1 py-0.5 border rounded text-xs" value={inlineData.custo_unit ?? 0} onChange={e => setInlineData(d => ({ ...d, custo_unit: parseFloat(e.target.value) || 0 }))} /></td>
                      <td className="px-2 py-1"><input type="number" step="0.01" className="w-16 px-1 py-0.5 border rounded text-xs" value={inlineData.preco_venda ?? 0} onChange={e => setInlineData(d => ({ ...d, preco_venda: parseFloat(e.target.value) || 0 }))} /></td>
                      <td className="px-2 py-1">—</td>
                      <td className="px-2 py-1"><input type="number" className="w-10 px-1 py-0.5 border rounded text-xs" value={inlineData.estoque_min ?? 0} onChange={e => setInlineData(d => ({ ...d, estoque_min: parseInt(e.target.value) || 0 }))} /></td>
                      <td className="px-2 py-1"><input type="number" className="w-10 px-1 py-0.5 border rounded text-xs" value={inlineData.pto_reposicao ?? 0} onChange={e => setInlineData(d => ({ ...d, pto_reposicao: parseInt(e.target.value) || 0 }))} /></td>
                      <td className="px-2 py-1">—</td>
                      <td className="px-2 py-1"><input type="date" className="w-24 px-1 py-0.5 border rounded text-xs" value={inlineData.validade || ''} onChange={e => setInlineData(d => ({ ...d, validade: e.target.value }))} /></td>
                      <td className="px-2 py-1"><input className="w-8 px-1 py-0.5 border rounded text-xs" value={inlineData.classe_abc || ''} onChange={e => setInlineData(d => ({ ...d, classe_abc: e.target.value }))} /></td>
                      <td className="px-2 py-1 flex gap-1">
                        <button onClick={() => updateMutation.mutate({ id: p.id, updates: inlineData })} className="p-1 rounded bg-success text-success-foreground"><Check size={12} /></button>
                        <button onClick={() => setEditingInline(null)} className="p-1 rounded bg-muted"><X size={12} /></button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p.id} className={`border-b hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="px-2 py-2"><span className={`inline-block w-2 h-2 rounded-full ${status === 'repor' ? 'bg-destructive' : status === 'atencao' ? 'bg-warning' : 'bg-success'}`} /></td>
                    <td className="px-2 py-2 text-muted-foreground">{p.sku}</td>
                    <td className="px-2 py-2 font-medium max-w-[150px] truncate">{p.nome}</td>
                    <td className="px-2 py-2">{p.marca}</td>
                    <td className="px-2 py-2">{p.categoria}</td>
                    <td className={`px-2 py-2 font-medium ${status === 'repor' ? 'text-destructive' : status === 'atencao' ? 'text-warning' : ''}`}>{p.qtd_atual}</td>
                    <td className="px-2 py-2">{formatCurrency(p.custo_unit || 0)}</td>
                    <td className="px-2 py-2">{formatCurrency(p.preco_venda || 0)}</td>
                    <td className={`px-2 py-2 font-medium ${margemColorClass(margem)}`}>{formatPercent(margem)}</td>
                    <td className="px-2 py-2">{p.estoque_min}</td>
                    <td className="px-2 py-2">{p.pto_reposicao}</td>
                    <td className="px-2 py-2 italic text-muted-foreground">{formatCurrency(valEstoque)}</td>
                    <td className={`px-2 py-2 ${diasVal !== null && diasVal < 30 ? 'text-warning font-medium' : ''}`}>
                      {p.validade ? (diasVal !== null && diasVal < 30 ? `${diasVal}d` : p.validade) : '—'}
                    </td>
                    <td className="px-2 py-2">{p.classe_abc}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => { setEditingInline(p.id); setInlineData({ ...p }); }} className="p-1 rounded hover:bg-muted"><Pencil size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Footer */}
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-4">
            <span>{filtered.length} SKUs</span>
            <span>Valor: {formatCurrency(filtered.reduce((s, p) => s + (p.qtd_atual || 0) * (p.custo_unit || 0), 0))}</span>
            <span className="text-destructive">🔴 {counts.repor}</span>
            <span className="text-warning">🟡 {counts.atencao}</span>
            <span>Margem média: {formatPercent(margemMedia)}</span>
          </div>
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map(p => {
            const status = getStatus(p);
            const margem = (p.preco_venda && p.custo_unit && p.preco_venda > 0) ? ((p.preco_venda - p.custo_unit) / p.preco_venda) * 100 : 0;
            const diasVal = p.validade ? Math.floor((new Date(p.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            return (
              <div key={p.id} className="bg-card rounded-xl p-4 shadow-sm flex items-start gap-3">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${status === "repor" ? "bg-destructive" : status === "atencao" ? "bg-warning" : "bg-success"}`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold truncate">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.marca}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className={status === "repor" ? "text-destructive font-medium" : status === "atencao" ? "text-warning font-medium" : ""}>{p.qtd_atual} un.</span>
                    <span>{formatCurrency(p.preco_venda || 0)}</span>
                    <span className={margemColorClass(margem)}>Margem {formatPercent(margem)}</span>
                    {diasVal !== null && diasVal < 30 && <span className="text-warning font-medium">Vence em {diasVal}d</span>}
                  </div>
                </div>
                <button onClick={() => { setEditProduto(p); setEditQtd(p.qtd_atual || 0); setEditCusto(p.custo_unit || 0); }} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-muted active:scale-95">
                  <Pencil size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editProduto && (
        <Modal onClose={() => setEditProduto(null)} title="Atualizar estoque">
          <p className="text-sm text-muted-foreground mb-4">{editProduto.nome}</p>
          <div className="space-y-3">
            <Field label="Nova quantidade" type="number" value={editQtd} onChange={v => setEditQtd(parseInt(v) || 0)} />
            <Field label="Custo unitário (R$)" type="number" value={editCusto} onChange={v => setEditCusto(parseFloat(v) || 0)} step="0.01" />
            <button onClick={() => updateMutation.mutate({ id: editProduto.id, updates: { qtd_atual: editQtd, custo_unit: editCusto } })} disabled={updateMutation.isPending} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98] disabled:opacity-50">Atualizar</button>
          </div>
        </Modal>
      )}

      {/* New Product Modal */}
      {showNovo && (
        <Modal onClose={() => setShowNovo(false)} title="Novo produto">
          <div className="space-y-3">
            <Field label="Nome *" value={novoForm.nome} onChange={v => setNovoForm(f => ({ ...f, nome: v }))} />
            <DynamicSelectField
              label="Marca *"
              value={novoForm.marca}
              options={marcasList}
              onChange={v => setNovoForm(f => ({ ...f, marca: v }))}
              tableName="marcas"
              queryClient={queryClient}
              toast={toast}
            />
            <DynamicSelectField
              label="Categoria *"
              value={novoForm.categoria}
              options={categoriasList}
              onChange={v => setNovoForm(f => ({ ...f, categoria: v }))}
              tableName="categorias"
              queryClient={queryClient}
              toast={toast}
            />
            <Field label="Sabor" value={novoForm.sabor} onChange={v => setNovoForm(f => ({ ...f, sabor: v }))} />
            <Field label="Qtd atual *" type="number" value={novoForm.qtd_atual} onChange={v => setNovoForm(f => ({ ...f, qtd_atual: parseInt(v) || 0 }))} />
            <Field label="Custo unit. (R$)" type="number" value={novoForm.custo_unit} onChange={v => setNovoForm(f => ({ ...f, custo_unit: parseFloat(v) || 0 }))} step="0.01" />
            <Field label="Preço venda (R$)" type="number" value={novoForm.preco_venda} onChange={v => setNovoForm(f => ({ ...f, preco_venda: parseFloat(v) || 0 }))} step="0.01" />
            <Field label="Estoque mínimo *" type="number" value={novoForm.estoque_min} onChange={v => setNovoForm(f => ({ ...f, estoque_min: parseInt(v) || 0 }))} />
            <Field label="Ponto reposição *" type="number" value={novoForm.pto_reposicao} onChange={v => setNovoForm(f => ({ ...f, pto_reposicao: parseInt(v) || 0 }))} />
            <Field label="Validade" type="date" value={novoForm.validade} onChange={v => setNovoForm(f => ({ ...f, validade: v }))} />
            <SelectField label="Classe ABC" value={novoForm.classe_abc} options={CLASSES} onChange={v => setNovoForm(f => ({ ...f, classe_abc: v }))} />
            <Field label="Fornecedor" value={novoForm.fornecedor} onChange={v => setNovoForm(f => ({ ...f, fornecedor: v }))} />
            <button onClick={() => createMutation.mutate()} disabled={!novoForm.nome || createMutation.isPending} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium active:scale-[0.98] disabled:opacity-50">Adicionar produto</button>
          </div>
        </Modal>
      )}

      {/* Import CSV Sheet */}
      <Sheet open={showImport} onOpenChange={setShowImport}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Importar CSV</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <button onClick={downloadTemplate} className="text-xs text-primary underline">Baixar modelo CSV</button>
            <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50" onClick={() => fileInputRef.current?.click()}>
              <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Clique ou arraste um arquivo CSV</p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
            </div>
            {csvData.length > 0 && (
              <>
                <p className="text-xs font-medium">Preview ({csvData.length} linhas):</p>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border">
                    <thead><tr className="bg-muted">{Object.keys(csvData[0]).slice(0, 5).map(k => <th key={k} className="px-2 py-1 text-left">{k}</th>)}</tr></thead>
                    <tbody>{csvData.slice(0, 5).map((r, i) => <tr key={i}>{Object.values(r).slice(0, 5).map((v: any, j) => <td key={j} className="px-2 py-1 border-t">{v}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <button onClick={importCsv} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium">Confirmar importação</button>
              </>
            )}
            {importResult && <p className="text-sm font-medium text-success">{importResult}</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        style={{ width: '100vw', height: '100vh', top: 0, left: 0 }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed z-[51] w-[calc(100%-2rem)] max-w-md bg-card rounded-2xl p-5 space-y-3 shadow-xl"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-secondary">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X size={18} /></button>
        </div>
        {children}
      </div>
    </>
  );
}

function Field({ label, type = "text", value, onChange, step }: { label: string; type?: string; value: any; onChange: (v: string) => void; step?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} step={step} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function DynamicSelectField({ label, value, options, onChange, tableName, queryClient, toast }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  tableName: string; queryClient: any; toast: any;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await supabase.from(tableName as any).insert({ nome: newName.trim() } as any);
      queryClient.invalidateQueries({ queryKey: [tableName] });
      onChange(newName.trim());
      toast({ title: `✅ ${label.replace(' *', '')} "${newName.trim()}" criada com sucesso` });
      setNewName("");
      setShowNew(false);
    } catch {
      toast({ title: "Erro ao criar", variant: "destructive" as const });
    }
    setCreating(false);
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary mt-1"
        value={value}
        onChange={e => {
          if (e.target.value === '__new__') { setShowNew(true); return; }
          onChange(e.target.value);
        }}
      >
        <option value="">Selecione...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__new__">+ Adicionar {label.replace(' *', '').toLowerCase()}</option>
      </select>
      {showNew && (
        <div className="flex gap-2 mt-2">
          <input
            className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={`Nome da nova ${label.replace(' *', '').toLowerCase()}`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button onClick={handleCreate} disabled={creating || !newName.trim()} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">Criar</button>
          <button onClick={() => { setShowNew(false); setNewName(""); }} className="px-2 py-2 rounded-lg border text-sm hover:bg-muted"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
