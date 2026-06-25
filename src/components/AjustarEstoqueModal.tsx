import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, X, Gift, Heart, AlertOctagon, Package, Pencil } from "lucide-react";

type Produto = {
  id: string;
  nome: string;
  qtd_atual: number | null;
};

type Props = {
  produto: Produto;
  onClose: () => void;
};

const MOTIVOS = [
  { key: 'brinde', label: 'Brinde / Amostra', desc: 'Dado de graça para cliente', icon: Gift, color: 'text-primary' },
  { key: 'perda', label: 'Quebra / Perda', desc: 'Produto danificado ou expirado', icon: Heart, color: 'text-warning' },
  { key: 'furto', label: 'Furto', desc: 'Roubado / sumiu sem registro', icon: AlertOctagon, color: 'text-destructive' },
  { key: 'erro_recebimento', label: 'Erro de recebimento', desc: 'Fornecedor mandou diferente do nota', icon: Package, color: 'text-secondary' },
  { key: 'correcao', label: 'Correção', desc: 'Descobri que o sistema estava errado', icon: Pencil, color: 'text-muted-foreground' },
] as const;

export default function AjustarEstoqueModal({ produto, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const qtdAtual = produto.qtd_atual ?? 0;

  const [qtdNova, setQtdNova] = useState(qtdAtual);
  const [motivo, setMotivo] = useState<typeof MOTIVOS[number]['key']>('correcao');
  const [observacao, setObservacao] = useState("");

  const diferenca = qtdNova - qtdAtual;

  const ajustar = useMutation({
    mutationFn: async () => {
      // 1) Registra histórico (best-effort: se tabela não existe, segue)
      const histErr = await registrarHistorico({
        produto_id: produto.id,
        produto_nome: produto.nome,
        qtd_anterior: qtdAtual,
        qtd_nova: qtdNova,
        diferenca,
        motivo,
        observacao: observacao.trim() || null,
      });

      // 2) Atualiza o produto (essencial)
      const { error: updErr } = await supabase
        .from("produtos")
        .update({ qtd_atual: qtdNova })
        .eq("id", produto.id);
      if (updErr) throw updErr;

      return { historicoFalhou: !!histErr };
    },
    onSuccess: (res) => {
      toast({
        title: "✅ Estoque ajustado",
        description: res.historicoFalhou
          ? `${produto.nome}: ${qtdAtual} → ${qtdNova}. (Tabela ajustes_estoque não existe, histórico não registrado.)`
          : `${produto.nome}: ${qtdAtual} → ${qtdNova} (${diferenca > 0 ? '+' : ''}${diferenca}).`,
      });
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao ajustar", description: err?.message, variant: "destructive" as const });
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-secondary">Ajustar estoque</h2>
            <p className="text-[11px] text-muted-foreground">{produto.nome}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground">Quantidade atual</p>
              <p className="text-2xl font-bold text-secondary">{qtdAtual}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Quantidade nova</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded-lg border bg-background text-lg font-bold mt-1"
                value={qtdNova}
                onChange={e => setQtdNova(Math.max(0, parseInt(e.target.value) || 0))}
                autoFocus
              />
            </div>
          </div>

          {diferenca !== 0 && (
            <div className={`p-3 rounded-lg border text-sm font-semibold ${diferenca > 0 ? 'bg-success/5 border-success/30 text-success' : 'bg-destructive/5 border-destructive/30 text-destructive'}`}>
              Diferença: {diferenca > 0 ? '+' : ''}{diferenca} un
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground block mb-2">Motivo do ajuste</label>
            <div className="space-y-1.5">
              {MOTIVOS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMotivo(m.key)}
                  className={`w-full text-left p-2.5 rounded-lg border flex items-start gap-2 transition-colors ${motivo === m.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
                >
                  <m.icon size={14} className={`shrink-0 mt-0.5 ${m.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Observação (opcional)</label>
            <input
              type="text"
              placeholder="ex: dei pro João, vence em 5 dias"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>

          <button
            disabled={diferenca === 0 || ajustar.isPending}
            onClick={() => ajustar.mutate()}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {ajustar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {diferenca === 0 ? 'Sem mudança' : 'Confirmar ajuste'}
          </button>
        </div>
      </div>
    </div>
  );
}

async function registrarHistorico(payload: {
  produto_id: string;
  produto_nome: string;
  qtd_anterior: number;
  qtd_nova: number;
  diferenca: number;
  motivo: string;
  observacao: string | null;
}): Promise<Error | null> {
  try {
    // Cast p/ any: a tabela ajustes_estoque pode não existir nos tipos gerados
    // (ela ainda não foi criada no banco). Isso mantém o build verde mesmo quando
    // os tipos são regenerados a partir do schema real. Runtime continua best-effort.
    const { error } = await (supabase as any).from("ajustes_estoque").insert(payload);
    if (error) {
      // PGRST205 = tabela não existe — não bloquear o fluxo
      if (error.code === "PGRST205" || error.message?.includes("ajustes_estoque")) {
        return new Error("tabela ajustes_estoque não existe");
      }
      throw error;
    }
    return null;
  } catch (err) {
    return err as Error;
  }
}
