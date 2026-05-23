import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Trash2, X, AlertTriangle } from "lucide-react";
import { editarVenda, excluirVenda, preverImpactoExclusao, type VendaRow } from "@/lib/vendaActions";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";

type Props = {
  venda: VendaRow;
  onClose: () => void;
};

export default function EditVendaModal({ venda, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'edit' | 'delete'>('edit');
  const [quantidade, setQuantidade] = useState(venda.quantidade);
  const [precoVenda, setPrecoVenda] = useState(Number(venda.preco_venda));
  const [descontoRs, setDescontoRs] = useState(Number(venda.desconto_rs || 0));
  const [brinde, setBrinde] = useState(venda.brinde || '');
  const [observacao, setObservacao] = useState(venda.observacao || '');

  const editar = useMutation({
    mutationFn: () => editarVenda(venda, {
      quantidade, preco_venda: precoVenda, desconto_rs: descontoRs,
      brinde: brinde.trim() || null, observacao: observacao.trim() || null,
    }),
    onSuccess: () => {
      toast({ title: "✅ Venda atualizada" });
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err?.message, variant: "destructive" as const });
    },
  });

  const excluir = useMutation({
    mutationFn: () => excluirVenda(venda),
    onSuccess: () => {
      toast({ title: "🗑 Venda excluída", description: "Estoque e cliente foram revertidos." });
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" as const });
    },
  });

  const totalAntes = venda.quantidade * Number(venda.preco_venda) - Number(venda.desconto_rs || 0);
  const totalDepois = quantidade * precoVenda - descontoRs;
  const diferenca = totalDepois - totalAntes;
  const impactoExclusao = preverImpactoExclusao(venda);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-secondary">{mode === 'edit' ? 'Editar venda' : 'Excluir venda'}</h2>
            <p className="text-[11px] text-muted-foreground">
              {venda.produto_nome} · {venda.created_at && `${formatDate(venda.created_at)} ${formatTime(venda.created_at)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {mode === 'edit' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Quantidade</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1"
                    value={quantidade}
                    onChange={e => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Preço unitário</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
                    <input
                      type="number" step="0.01"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
                      value={precoVenda || ''}
                      onChange={e => setPrecoVenda(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Desconto aplicado (R$)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
                  <input
                    type="number" step="0.01" min={0}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
                    value={descontoRs || ''}
                    onChange={e => setDescontoRs(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Brinde dado</label>
                <input
                  type="text"
                  placeholder="ex: Pasta amendoim 30g"
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1"
                  value={brinde}
                  onChange={e => setBrinde(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Observação</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1"
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                />
              </div>

              {/* Resumo do impacto */}
              <div className={`p-3 rounded-lg border ${diferenca !== 0 ? 'bg-warning/5 border-warning/30' : 'bg-muted/30'}`}>
                <p className="text-[11px] font-semibold text-secondary mb-1">Impacto da edição</p>
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between"><span>Total original</span><span>{formatCurrency(totalAntes)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total novo</span><span>{formatCurrency(totalDepois)}</span></div>
                  {diferenca !== 0 && (
                    <div className={`flex justify-between font-bold pt-1 border-t mt-1 ${diferenca > 0 ? 'text-success' : 'text-destructive'}`}>
                      <span>Diferença</span><span>{diferenca > 0 ? '+' : ''}{formatCurrency(diferenca)}</span>
                    </div>
                  )}
                  {quantidade !== venda.quantidade && venda.produto_id && (
                    <p className="text-[10px] text-muted-foreground pt-1">
                      Estoque ajusta: {venda.quantidade} → {quantidade} (Δ {quantidade - venda.quantidade > 0 ? '+' : ''}{quantidade - venda.quantidade} un)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={editar.isPending}
                  onClick={() => editar.mutate()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
                <button
                  onClick={() => setMode('delete')}
                  className="px-3 py-2.5 rounded-xl border text-destructive text-sm font-medium hover:bg-destructive/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-destructive/5 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-destructive mb-1">Confirme a exclusão</p>
                  <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                    {impactoExclusao.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={excluir.isPending}
                  onClick={() => excluir.mutate()}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {excluir.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Confirmar exclusão
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-muted"
                >
                  Voltar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
