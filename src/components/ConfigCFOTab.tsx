import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Loader2, Save, Info, Briefcase, Shield, Building2, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Config = {
  pro_labore_socio1: number;
  pro_labore_socio2: number;
  das_mei_mensal: number;
  teto_mei_anual: number;
  reserva_caixa: number;
  meta_lucro_mensal: number;
  nome_socio1: string;
  nome_socio2: string;
};

const emptyConfig: Config = {
  pro_labore_socio1: 0,
  pro_labore_socio2: 0,
  das_mei_mensal: 80.90,
  teto_mei_anual: 81000,
  reserva_caixa: 0,
  meta_lucro_mensal: 0,
  nome_socio1: 'Você',
  nome_socio2: 'Sócio',
};

export default function ConfigCFOTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Config>(emptyConfig);
  const [dirty, setDirty] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["config-financeira"],
    queryFn: async () => {
      const { data } = await supabase.from("config_financeira").select("*");
      return data || [];
    },
  });

  useEffect(() => {
    if (!Array.isArray(rows)) return;
    const map: Record<string, { valor: number; texto: string | null }> = {};
    rows.forEach((r: any) => { map[r.chave] = { valor: Number(r.valor), texto: r.valor_texto }; });
    setForm({
      pro_labore_socio1: map['pro_labore_socio1']?.valor ?? 0,
      pro_labore_socio2: map['pro_labore_socio2']?.valor ?? 0,
      das_mei_mensal: map['das_mei_mensal']?.valor ?? 80.90,
      teto_mei_anual: map['teto_mei_anual']?.valor ?? 81000,
      reserva_caixa: map['reserva_caixa']?.valor ?? 0,
      meta_lucro_mensal: map['meta_lucro_mensal']?.valor ?? 0,
      nome_socio1: map['pro_labore_socio1']?.texto || 'Você',
      nome_socio2: map['pro_labore_socio2']?.texto || 'Sócio',
    });
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { chave: 'pro_labore_socio1', valor: form.pro_labore_socio1, valor_texto: form.nome_socio1 },
        { chave: 'pro_labore_socio2', valor: form.pro_labore_socio2, valor_texto: form.nome_socio2 },
        { chave: 'das_mei_mensal', valor: form.das_mei_mensal, valor_texto: 'DAS MEI mensal' },
        { chave: 'teto_mei_anual', valor: form.teto_mei_anual, valor_texto: 'Limite anual MEI' },
        { chave: 'reserva_caixa', valor: form.reserva_caixa, valor_texto: 'Reserva atual' },
        { chave: 'meta_lucro_mensal', valor: form.meta_lucro_mensal, valor_texto: 'Meta de lucro' },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from("config_financeira")
          .upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "✅ Configurações salvas" });
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["config-financeira"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" as const });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const proLaboreTotal = form.pro_labore_socio1 + form.pro_labore_socio2;

  const update = <K extends keyof Config>(key: K, value: Config[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-secondary">Configurações CFO</h2>
        <p className="text-xs text-muted-foreground">Esses valores alimentam o DRE, lucro líquido e recomendações do CFO Peak.</p>
      </div>

      {/* Pró-labore */}
      <Section icon={Briefcase} title="Pró-labore mensal" hint="Quanto cada sócio tira do caixa por mês. Sem isso, lucro líquido fica fictício.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome do sócio 1</label>
            <input
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1"
              value={form.nome_socio1}
              onChange={e => update('nome_socio1', e.target.value)}
            />
            <label className="text-xs text-muted-foreground mt-2 block">Pró-labore</label>
            <ValorInput value={form.pro_labore_socio1} onChange={v => update('pro_labore_socio1', v)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nome do sócio 2</label>
            <input
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm mt-1"
              value={form.nome_socio2}
              onChange={e => update('nome_socio2', e.target.value)}
            />
            <label className="text-xs text-muted-foreground mt-2 block">Pró-labore</label>
            <ValorInput value={form.pro_labore_socio2} onChange={v => update('pro_labore_socio2', v)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          Total: <span className="font-bold text-destructive">{formatCurrency(proLaboreTotal)}/mês</span>
        </p>
      </Section>

      {/* Reserva */}
      <Section icon={Shield} title="Reserva de caixa atual" hint="Quanto vocês têm guardado hoje. Atualizem manualmente uma vez por mês. Saudável: 3 meses de custo fixo.">
        <ValorInput value={form.reserva_caixa} onChange={v => update('reserva_caixa', v)} />
      </Section>

      {/* MEI */}
      <Section icon={Building2} title="Configuração MEI" hint="DAS mensal e teto anual. Valores 2026 padrão comércio.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">DAS mensal</label>
            <ValorInput value={form.das_mei_mensal} onChange={v => update('das_mei_mensal', v)} />
            <p className="text-[10px] text-muted-foreground mt-1">Comércio 2026: R$ 80,90</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Teto anual</label>
            <ValorInput value={form.teto_mei_anual} onChange={v => update('teto_mei_anual', v)} />
            <p className="text-[10px] text-muted-foreground mt-1">2026: R$ 81.000</p>
          </div>
        </div>
      </Section>

      {/* Meta */}
      <Section icon={Target} title="Meta de lucro mensal" hint="Sua meta de lucro líquido (depois de pró-labore e DAS). Aparece no Dashboard como referência.">
        <ValorInput value={form.meta_lucro_mensal} onChange={v => update('meta_lucro_mensal', v)} />
      </Section>

      {/* Save */}
      <div className="sticky bottom-0 bg-background pt-3 pb-2 border-t mt-4">
        <button
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {dirty ? 'Salvar alterações' : 'Sem alterações'}
        </button>
      </div>

      <div className="bg-muted/40 rounded-xl p-3 flex gap-2">
        <Info size={14} className="shrink-0 text-muted-foreground mt-0.5" />
        <p className="text-[11px] text-muted-foreground">
          <strong>Como o CFO Peak usa esses dados:</strong> O lucro líquido real do mês é calculado como
          Faturamento − Custo dos produtos − Todos os gastos − Pró-labore − DAS. A reserva define quantos meses você
          sobreviveria se zerar venda. O teto MEI gera alerta antes de estourar.
        </p>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: any; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl p-4 shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center">
          <Icon size={14} className="text-secondary" />
        </div>
        <p className="text-sm font-semibold text-secondary">{title}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="pt-1">{children}</div>
    </div>
  );
}

function ValorInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
      <input
        type="number"
        step="0.01"
        className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}
