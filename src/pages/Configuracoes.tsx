import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2, Pencil, Check, X, Loader2, Briefcase, Receipt, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ConfigCFOTab from "@/components/ConfigCFOTab";
import ConfigCanaisTab from "@/components/ConfigCanaisTab";
import { useCanais } from "@/lib/canaisStore";

const CATEGORIAS = ['Custo Fixo', 'Marketing', 'Anúncios', 'Investimento', 'Parceria', 'Outros'] as const;
type Categoria = typeof CATEGORIAS[number];

const CAT_COLORS: Record<Categoria, string> = {
  'Custo Fixo': 'bg-secondary/15 text-secondary',
  'Marketing': 'bg-primary/15 text-primary',
  'Anúncios': 'bg-warning/15 text-warning',
  'Investimento': 'bg-success/15 text-success',
  'Parceria': 'bg-accent/40 text-accent-foreground',
  'Outros': 'bg-muted text-muted-foreground',
};

const CAT_HINT: Record<Categoria, string> = {
  'Custo Fixo': 'Aluguel, energia, internet, salário — gastos que se repetem todo mês',
  'Marketing': 'Brindes, panfletos, ações locais, eventos',
  'Anúncios': 'Meta Ads, Google Ads, impulsionamento Instagram',
  'Investimento': 'Equipamento, móvel, reforma, melhoria da loja',
  'Parceria': 'Patrocínio, presente influencer, comissão de revenda',
  'Outros': 'Qualquer outro gasto do negócio',
};

type Gasto = {
  id: string;
  nome: string;
  valor: number;
  categoria: string;
  recorrencia: string;
  data: string | null;
  descricao: string | null;
  canal: string | null;
};

const emptyForm = {
  nome: '',
  valor: 0,
  categoria: 'Custo Fixo' as Categoria,
  recorrencia: 'mensal' as 'mensal' | 'unica',
  data: '',
  descricao: '',
  canal: '',
};

// Categorias onde faz sentido vincular a um canal (para ROAS)
const CATEGORIAS_COM_CANAL: Categoria[] = ['Marketing', 'Anúncios', 'Parceria'];

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topTab, setTopTab] = useState<'gastos' | 'cfo' | 'canais'>('gastos');
  const [tab, setTab] = useState<'todos' | Categoria>('todos');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const { data: gastos, isLoading } = useQuery({
    queryKey: ["custos-fixos"],
    queryFn: async () => {
      const { data } = await supabase.from("custos_fixos").select("*").order("nome");
      return (data || []) as Gasto[];
    },
  });

  const { data: canaisResult } = useCanais(true);
  const canaisAtivos = canaisResult?.canais || [];

  const totalFixoMensal = useMemo(
    () => (gastos || []).filter(g => g.recorrencia === 'mensal').reduce((s, g) => s + Number(g.valor), 0),
    [gastos]
  );

  const totalMes = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return (gastos || []).reduce((s, g) => {
      if (g.recorrencia === 'mensal') return s + Number(g.valor);
      if (g.data) {
        const d = new Date(g.data);
        if (d >= monthStart && d < monthEnd) return s + Number(g.valor);
      }
      return s;
    }, 0);
  }, [gastos]);

  const visible = useMemo(() => {
    if (tab === 'todos') return gastos || [];
    return (gastos || []).filter(g => g.categoria === tab);
  }, [gastos, tab]);

  const countsByCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    (gastos || []).forEach(g => { map[g.categoria] = (map[g.categoria] || 0) + 1; });
    return map;
  }, [gastos]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nome: form.nome.trim(),
        valor: form.valor,
        categoria: form.categoria,
        recorrencia: form.recorrencia,
        data: form.recorrencia === 'unica' ? (form.data || new Date().toISOString().split('T')[0]) : null,
        descricao: form.descricao.trim() || null,
        canal: CATEGORIAS_COM_CANAL.includes(form.categoria) && form.canal ? form.canal : null,
      };
      const { error } = await supabase.from("custos_fixos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Gasto registrado" });
      setForm({ ...emptyForm, categoria: form.categoria });
      queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao registrar", description: err?.message, variant: "destructive" as const });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const payload: any = {
        nome: editForm.nome.trim(),
        valor: editForm.valor,
        categoria: editForm.categoria,
        recorrencia: editForm.recorrencia,
        data: editForm.recorrencia === 'unica' ? (editForm.data || null) : null,
        descricao: editForm.descricao.trim() || null,
        canal: CATEGORIAS_COM_CANAL.includes(editForm.categoria) && editForm.canal ? editForm.canal : null,
      };
      const { error } = await supabase.from("custos_fixos").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Gasto atualizado" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err?.message, variant: "destructive" as const });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custos_fixos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "🗑 Gasto removido" });
      queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
    },
  });

  const startEdit = (g: Gasto) => {
    setEditingId(g.id);
    setEditForm({
      nome: g.nome,
      valor: Number(g.valor),
      categoria: (CATEGORIAS.includes(g.categoria as Categoria) ? g.categoria : 'Outros') as Categoria,
      recorrencia: (g.recorrencia === 'mensal' ? 'mensal' : 'unica'),
      data: g.data || '',
      descricao: g.descricao || '',
      canal: g.canal || '',
    });
  };

  return (
    <div className="animate-fade-in space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-secondary">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie gastos, dados financeiros (CFO Peak) e canais de venda.</p>
      </div>

      {/* Top Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 sticky top-0 z-10">
        <button
          onClick={() => setTopTab('gastos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${topTab === 'gastos' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Receipt size={14} /> Gastos
        </button>
        <button
          onClick={() => setTopTab('cfo')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${topTab === 'cfo' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Briefcase size={14} /> Financeiro (CFO)
        </button>
        <button
          onClick={() => setTopTab('canais')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${topTab === 'canais' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Radio size={14} /> Canais
        </button>
      </div>

      {topTab === 'cfo' && <ConfigCFOTab />}
      {topTab === 'canais' && <ConfigCanaisTab />}

      {topTab === 'gastos' && <>
      <div>
        <h2 className="text-base font-bold text-secondary">Gastos & Custos</h2>
        <p className="text-xs text-muted-foreground">Tudo o que sai do caixa: custos fixos, marketing, anúncios, investimentos, parcerias.</p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Custos fixos mensais</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalFixoMensal)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Usado em EBITDA e break-even</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total gasto este mês</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalMes)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Fixos + pontuais do mês</p>
        </div>
      </div>

      {/* Adicionar */}
      <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-secondary">Registrar gasto</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nome (ex: Meta Ads campanha março)"
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          />
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
            <input
              type="number"
              step="0.01"
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Valor"
              value={form.valor || ''}
              onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <select
            className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))}
          >
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={form.recorrencia}
            onChange={e => setForm(f => ({ ...f, recorrencia: e.target.value as 'mensal' | 'unica' }))}
          >
            <option value="mensal">Mensal (se repete todo mês)</option>
            <option value="unica">Único (gasto pontual)</option>
          </select>
          {form.recorrencia === 'unica' && (
            <input
              type="date"
              className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary md:col-span-2"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
            />
          )}
          {CATEGORIAS_COM_CANAL.includes(form.categoria) && (
            <select
              className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary md:col-span-2"
              value={form.canal}
              onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}
            >
              <option value="">Vincular a canal (opcional — pra ROAS)</option>
              {(canaisAtivos || []).map(c => (
                <option key={c.nome} value={c.nome}>{c.nome} ({c.tipo})</option>
              ))}
            </select>
          )}
          <input
            className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary md:col-span-2"
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">{CAT_HINT[form.categoria]}</p>
        <button
          disabled={!form.nome.trim() || form.valor <= 0 || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="w-full md:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {addMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Registrar gasto
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setTab('todos')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${tab === 'todos' ? 'bg-secondary text-secondary-foreground' : 'bg-card border hover:bg-muted'}`}
        >
          Todos ({(gastos || []).length})
        </button>
        {CATEGORIAS.map(c => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${tab === c ? 'bg-secondary text-secondary-foreground' : 'bg-card border hover:bg-muted'}`}
          >
            {c} {countsByCategoria[c] ? <span className="text-muted-foreground">({countsByCategoria[c]})</span> : null}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum gasto {tab === 'todos' ? 'cadastrado' : `na categoria "${tab}"`}.</p>
          </div>
        ) : (
          <div className="divide-y">
            {visible.map(g => (
              <div key={g.id} className="px-4 py-3">
                {editingId === g.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        className="px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={editForm.nome}
                        onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                      />
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-xs text-muted-foreground">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full pl-8 pr-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={editForm.valor || ''}
                          onChange={e => setEditForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <select
                        className="px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={editForm.categoria}
                        onChange={e => setEditForm(f => ({ ...f, categoria: e.target.value as Categoria }))}
                      >
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select
                        className="px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={editForm.recorrencia}
                        onChange={e => setEditForm(f => ({ ...f, recorrencia: e.target.value as 'mensal' | 'unica' }))}
                      >
                        <option value="mensal">Mensal</option>
                        <option value="unica">Único</option>
                      </select>
                      {editForm.recorrencia === 'unica' && (
                        <input
                          type="date"
                          className="px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary md:col-span-2"
                          value={editForm.data}
                          onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))}
                        />
                      )}
                      {CATEGORIAS_COM_CANAL.includes(editForm.categoria) && (
                        <select
                          className="px-2 py-1.5 rounded border bg-background text-sm md:col-span-2"
                          value={editForm.canal}
                          onChange={e => setEditForm(f => ({ ...f, canal: e.target.value }))}
                        >
                          <option value="">Sem canal vinculado</option>
                          {(canaisAtivos || []).map(c => (
                            <option key={c.nome} value={c.nome}>{c.nome}</option>
                          ))}
                        </select>
                      )}
                      <input
                        className="px-2 py-1.5 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary md:col-span-2"
                        placeholder="Descrição (opcional)"
                        value={editForm.descricao}
                        onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => updateMutation.mutate(g.id)} className="px-3 py-1 rounded bg-success text-success-foreground text-xs font-medium flex items-center gap-1"><Check size={12} /> Salvar</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 rounded bg-muted text-xs font-medium flex items-center gap-1"><X size={12} /> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{g.nome}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[g.categoria as Categoria] || CAT_COLORS['Outros']}`}>{g.categoria}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {g.recorrencia === 'mensal' ? 'Mensal' : g.data ? formatDate(new Date(g.data)) : 'Único'}
                        </span>
                      </div>
                      {g.descricao && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{g.descricao}</p>}
                    </div>
                    <p className="text-sm font-bold text-destructive whitespace-nowrap">{formatCurrency(Number(g.valor))}</p>
                    <button onClick={() => startEdit(g)} className="p-1 rounded hover:bg-muted" title="Editar"><Pencil size={14} className="text-muted-foreground" /></button>
                    <button onClick={() => { if (window.confirm(`Excluir "${g.nome}"?`)) deleteMutation.mutate(g.id); }} className="p-1 rounded hover:bg-destructive/10" title="Excluir"><Trash2 size={14} className="text-destructive" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Impacto */}
      <div className="bg-muted/50 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-secondary">Como os gastos impactam os indicadores</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><strong>Sobra real:</strong> Faturamento − Custo dos Produtos − Todos os gastos do mês</p>
          <p><strong>EBITDA:</strong> Faturamento − Custo dos Produtos − Custos Fixos mensais</p>
          <p><strong>Break-even:</strong> Custos Fixos mensais ({formatCurrency(totalFixoMensal)}) ÷ Margem Bruta %</p>
          <p className="pt-2">Use <strong>Marketing/Anúncios/Investimento/Parceria</strong> para registrar gastos pontuais. Eles aparecem no Dashboard, na "Quebra do Mês", mostrando exatamente pra onde foi seu dinheiro.</p>
        </div>
      </div>
      </>}
    </div>
  );
}
