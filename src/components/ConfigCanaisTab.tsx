import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Loader2, Pencil, Check, X, EyeOff, Eye, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Canal = {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
};

const TIPOS = [
  { key: 'loja', label: 'Loja', desc: 'Canal próprio físico ou digital' },
  { key: 'organico', label: 'Orgânico', desc: 'Instagram, indicação grátis, boca a boca, WhatsApp' },
  { key: 'pago', label: 'Pago', desc: 'Meta Ads, Google Ads, impulsionamento' },
  { key: 'parceria', label: 'Parceria', desc: 'Personal, academia parceira, indicação remunerada' },
] as const;

const TIPO_COLOR: Record<string, string> = {
  loja: 'bg-secondary/10 text-secondary',
  organico: 'bg-success/10 text-success',
  pago: 'bg-warning/10 text-warning',
  parceria: 'bg-primary/10 text-primary',
};

export default function ConfigCanaisTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<typeof TIPOS[number]['key']>('parceria');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTipo, setEditTipo] = useState<typeof TIPOS[number]['key']>('parceria');

  const { data: canais, isLoading, error: loadError } = useQuery({
    queryKey: ["canais-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("canais").select("*").order("nome");
      if (error) {
        if (error.code === "PGRST205" || error.message?.includes("canais")) {
          return [] as Canal[];
        }
        throw error;
      }
      return (data || []) as Canal[];
    },
    retry: false,
  });
  const tabelaFaltando = !!loadError;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["canais"] });
    queryClient.invalidateQueries({ queryKey: ["canais-todos"] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("canais").insert({ nome: nome.trim(), tipo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Canal adicionado" });
      setNome("");
      invalidate();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message, variant: "destructive" as const });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, nome, tipo }: { id: string; nome: string; tipo: string }) => {
      const { error } = await supabase.from("canais").update({ nome, tipo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ Canal atualizado" });
      setEditingId(null);
      invalidate();
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message, variant: "destructive" as const });
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("canais").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const startEdit = (c: Canal) => {
    setEditingId(c.id);
    setEditNome(c.nome);
    setEditTipo((TIPOS.find(t => t.key === c.tipo)?.key) || 'parceria');
  };

  if (tabelaFaltando) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Tabela de canais não existe ainda</p>
            <p className="text-xs text-muted-foreground mt-1">
              Aplique a migration no <strong>Supabase Dashboard → SQL Editor</strong>:
            </p>
          </div>
        </div>
        <pre className="bg-card border rounded-lg p-3 text-[10px] overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS public.canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'organico',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.canais (nome, tipo) VALUES
  ('Loja física', 'loja'),
  ('Instagram', 'organico'),
  ('WhatsApp', 'organico'),
  ('Indicação', 'organico'),
  ('Anúncio Meta', 'pago'),
  ('Anúncio Google', 'pago')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.custos_fixos
  ADD COLUMN IF NOT EXISTS canal text;`}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-secondary">Canais de venda</h2>
        <p className="text-xs text-muted-foreground">Onde suas vendas acontecem. Vínculo essencial pra calcular ROAS dos canais pagos e parcerias.</p>
      </div>

      {/* Form */}
      <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-secondary">Adicionar canal</p>
        <input
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
          placeholder="Nome (ex: Personal João, Crossfit Box X, TikTok)"
          value={nome}
          onChange={e => setNome(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map(t => (
            <button
              key={t.key}
              onClick={() => setTipo(t.key)}
              className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${tipo === t.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
            >
              <p className="font-semibold">{t.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
        <button
          disabled={!nome.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="w-full md:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
        >
          {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Adicionar canal
        </button>
      </div>

      {/* Lista */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (canais || []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum canal cadastrado.</div>
        ) : (
          <div className="divide-y">
            {canais!.map(c => (
              <div key={c.id} className={`px-4 py-3 flex items-center gap-3 ${c.ativo ? '' : 'opacity-50'}`}>
                {editingId === c.id ? (
                  <>
                    <input
                      className="flex-1 px-2 py-1 rounded border bg-background text-sm"
                      value={editNome}
                      onChange={e => setEditNome(e.target.value)}
                    />
                    <select
                      value={editTipo}
                      onChange={e => setEditTipo(e.target.value as any)}
                      className="px-2 py-1 rounded border bg-background text-xs"
                    >
                      {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <button
                      onClick={() => updateMutation.mutate({ id: c.id, nome: editNome, tipo: editTipo })}
                      className="p-1 rounded hover:bg-success/10"
                    >
                      <Check size={14} className="text-success" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.nome}</p>
                      <span className={`inline-block text-[10px] uppercase px-2 py-0.5 rounded-full font-medium mt-1 ${TIPO_COLOR[c.tipo]}`}>{c.tipo}</span>
                    </div>
                    <button
                      onClick={() => toggleAtivoMutation.mutate({ id: c.id, ativo: !c.ativo })}
                      className="p-1.5 rounded hover:bg-muted"
                      title={c.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {c.ativo ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                    </button>
                    <button onClick={() => startEdit(c)} className="p-1.5 rounded hover:bg-muted">
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-muted/40 rounded-xl p-3 flex gap-2">
        <Info size={14} className="shrink-0 text-muted-foreground mt-0.5" />
        <p className="text-[11px] text-muted-foreground">
          <strong>Vínculo gasto → canal:</strong> ao registrar um gasto em "Anúncios" ou "Parceria", você pode associar a um canal específico
          (ex: gasto "Meta Ads campanha março" → canal "Anúncio Meta"). O CFO Peak cruza esses dados pra calcular ROAS por canal.
          Não pode excluir canais que já têm vendas — desative ao invés disso.
        </p>
      </div>
    </div>
  );
}
