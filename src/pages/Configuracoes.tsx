import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Configuracoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [novoValor, setNovoValor] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editValor, setEditValor] = useState<number>(0);

  const { data: custos, isLoading } = useQuery({
    queryKey: ["custos-fixos"],
    queryFn: async () => {
      const { data } = await supabase.from("custos_fixos").select("*").order("nome");
      return data || [];
    },
  });

  const totalFixo = (custos || []).reduce((s, c) => s + Number(c.valor), 0);

  const addMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("custos_fixos").insert({ nome: novoNome, valor: novoValor });
    },
    onSuccess: () => {
      toast({ title: "✅ Custo adicionado" });
      setNovoNome("");
      setNovoValor(0);
      queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nome, valor }: { id: string; nome: string; valor: number }) => {
      await supabase.from("custos_fixos").update({ nome, valor }).eq("id", id);
    },
    onSuccess: () => {
      toast({ title: "✅ Custo atualizado" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("custos_fixos").delete().eq("id", id);
    },
    onSuccess: () => {
      toast({ title: "🗑 Custo removido" });
      queryClient.invalidateQueries({ queryKey: ["custos-fixos"] });
    },
  });

  return (
    <div className="animate-fade-in space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-secondary">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie os custos fixos mensais do negócio.</p>
      </div>

      {/* Total */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <p className="text-xs text-muted-foreground font-medium">Total custos fixos mensais</p>
        <p className="text-2xl font-bold text-destructive">{formatCurrency(totalFixo)}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Esse valor é usado no cálculo de EBITDA, break-even e projeções do Dashboard.
        </p>
      </div>

      {/* Add form */}
      <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-secondary">Adicionar custo fixo</p>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nome (ex: Aluguel)"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
          />
          <div className="relative w-32">
            <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
            <input
              type="number"
              step="0.01"
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={novoValor || ''}
              onChange={e => setNovoValor(parseFloat(e.target.value) || 0)}
            />
          </div>
          <button
            disabled={!novoNome.trim() || novoValor <= 0 || addMutation.isPending}
            onClick={() => addMutation.mutate()}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-all active:scale-95"
          >
            {addMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (custos || []).length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum custo fixo cadastrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione itens como aluguel, energia, salários, etc.</p>
          </div>
        ) : (
          <div className="divide-y">
            {custos!.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                {editingId === c.id ? (
                  <>
                    <input
                      className="flex-1 px-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={editNome}
                      onChange={e => setEditNome(e.target.value)}
                    />
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full pl-8 pr-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={editValor || ''}
                        onChange={e => setEditValor(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <button onClick={() => updateMutation.mutate({ id: c.id, nome: editNome, valor: editValor })} className="p-1 rounded hover:bg-success/10"><Check size={16} className="text-success" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted"><X size={16} className="text-muted-foreground" /></button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground">Mensal</p>
                    </div>
                    <p className="text-sm font-bold text-destructive">{formatCurrency(Number(c.valor))}</p>
                    <button onClick={() => { setEditingId(c.id); setEditNome(c.nome); setEditValor(Number(c.valor)); }} className="p-1 rounded hover:bg-muted"><Pencil size={14} className="text-muted-foreground" /></button>
                    <button onClick={() => deleteMutation.mutate(c.id)} className="p-1 rounded hover:bg-destructive/10"><Trash2 size={14} className="text-destructive" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Impact explanation */}
      <div className="bg-muted/50 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-secondary">Como os custos fixos impactam os indicadores</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><strong>EBITDA:</strong> Faturamento − Custo dos Produtos − Custos Fixos ({formatCurrency(totalFixo)})</p>
          <p><strong>Break-even:</strong> Custos Fixos ({formatCurrency(totalFixo)}) ÷ Margem Bruta %</p>
          <p><strong>Projeção:</strong> Se projeção &lt; break-even, mês pode fechar negativo</p>
        </div>
      </div>
    </div>
  );
}
