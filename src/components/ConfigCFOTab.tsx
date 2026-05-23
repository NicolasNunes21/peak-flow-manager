import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Loader2, Save, Info, Briefcase, Shield, Building2, Target, HardDrive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfigFinanceira, useSalvarConfigFinanceira, CONFIG_DEFAULT, type ConfigFinanceira } from "@/lib/configFinanceira";

export default function ConfigCFOTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<ConfigFinanceira>(CONFIG_DEFAULT);
  const [dirty, setDirty] = useState(false);

  const { data: result, isLoading } = useConfigFinanceira();
  const salvar = useSalvarConfigFinanceira();

  useEffect(() => {
    if (result?.config) {
      setForm(result.config);
      setDirty(false);
    }
  }, [result?.config]);

  const handleSalvar = () => {
    salvar.mutate(form, {
      onSuccess: (res) => {
        if (res.origem === 'local') {
          toast({
            title: "⚠️ Salvo localmente",
            description: "A tabela no Supabase não existe ainda. Os dados sincronizam automaticamente quando a tabela for criada.",
          });
        } else {
          toast({ title: "✅ Configurações salvas" });
        }
        setDirty(false);
      },
      onError: (err: any) => {
        toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" as const });
      },
    });
  };

  const update = <K extends keyof ConfigFinanceira>(key: K, value: ConfigFinanceira[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const proLaboreTotal = form.pro_labore_socio1 + form.pro_labore_socio2;
  const usandoLocalStorage = result?.origem === 'local';
  const acabouMigrar = result?.migrado;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-secondary">Configurações CFO</h2>
        <p className="text-xs text-muted-foreground">Esses valores alimentam o DRE, lucro líquido e recomendações do CFO Peak.</p>
      </div>

      {usandoLocalStorage && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
          <HardDrive size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-warning">Modo offline — salvando neste navegador</p>
            <p className="text-muted-foreground">A tabela <code className="bg-muted px-1 rounded">config_financeira</code> ainda não existe no Supabase. Tudo continua funcionando, mas os dados ficam só neste navegador (não sincronizam entre dispositivos) até a tabela ser criada. Quando ela existir, vou migrar automaticamente.</p>
          </div>
        </div>
      )}

      {acabouMigrar && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-3 flex items-start gap-2">
          <Save size={16} className="text-success shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-success">Sincronizado!</p>
            <p className="text-muted-foreground">Detectei que a tabela passou a existir no Supabase. Migrei seus dados locais para lá. Agora sincroniza entre dispositivos.</p>
          </div>
        </div>
      )}

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
          disabled={!dirty || salvar.isPending}
          onClick={handleSalvar}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
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
