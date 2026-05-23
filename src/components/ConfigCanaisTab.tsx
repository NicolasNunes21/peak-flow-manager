import { useState } from "react";
import { Plus, Loader2, Pencil, Check, X, EyeOff, Eye, Info, HardDrive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCanais, useCriarCanal, useAtualizarCanal, type Canal } from "@/lib/canaisStore";

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
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<typeof TIPOS[number]['key']>('parceria');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTipo, setEditTipo] = useState<typeof TIPOS[number]['key']>('parceria');

  const { data: result, isLoading } = useCanais(false);
  const canais = result?.canais || [];
  const usandoLocalStorage = result?.origem === 'local';
  const acabouMigrar = result?.migrado;

  const criar = useCriarCanal();
  const atualizar = useAtualizarCanal();

  const handleAdd = () => {
    criar.mutate({ nome: nome.trim(), tipo }, {
      onSuccess: (res) => {
        setNome("");
        toast({
          title: "✅ Canal adicionado",
          description: res.origem === 'local' ? 'Salvo neste navegador até a tabela existir no Supabase.' : undefined,
        });
      },
      onError: (err: any) => {
        toast({ title: "Erro", description: err?.message, variant: "destructive" as const });
      },
    });
  };

  const handleUpdate = (id: string) => {
    atualizar.mutate(
      { id, patch: { nome: editNome, tipo: editTipo } },
      {
        onSuccess: () => {
          toast({ title: "✅ Canal atualizado" });
          setEditingId(null);
        },
        onError: (err: any) => {
          toast({ title: "Erro", description: err?.message, variant: "destructive" as const });
        },
      }
    );
  };

  const handleToggleAtivo = (canal: Canal) => {
    atualizar.mutate({ id: canal.id, patch: { ativo: !canal.ativo } });
  };

  const startEdit = (c: Canal) => {
    setEditingId(c.id);
    setEditNome(c.nome);
    setEditTipo((TIPOS.find(t => t.key === c.tipo)?.key) || 'parceria');
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-secondary">Canais de venda</h2>
        <p className="text-xs text-muted-foreground">Onde suas vendas acontecem. Vínculo essencial pra calcular ROAS dos canais pagos e parcerias.</p>
      </div>

      {usandoLocalStorage && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
          <HardDrive size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-warning">Modo offline — salvando neste navegador</p>
            <p className="text-muted-foreground">A tabela <code className="bg-muted px-1 rounded">canais</code> ainda não existe no Supabase. Tudo funciona normalmente, mas os canais ficam só neste navegador até a tabela ser criada. Migração automática quando ela existir.</p>
          </div>
        </div>
      )}

      {acabouMigrar && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-3 flex items-start gap-2">
          <Info size={16} className="text-success shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-success">Sincronizado!</p>
            <p className="text-muted-foreground">Seus canais locais foram migrados pro Supabase.</p>
          </div>
        </div>
      )}

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
          disabled={!nome.trim() || criar.isPending}
          onClick={handleAdd}
          className="w-full md:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
        >
          {criar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Adicionar canal
        </button>
      </div>

      {/* Lista */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        {canais.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum canal cadastrado.</div>
        ) : (
          <div className="divide-y">
            {canais.map(c => (
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
                      onClick={() => handleUpdate(c.id)}
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
                      onClick={() => handleToggleAtivo(c)}
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
        </p>
      </div>
    </div>
  );
}
