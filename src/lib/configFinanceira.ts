// Configuração financeira com fallback gracioso: tenta Supabase, cai pra localStorage
// quando a tabela não existe (migration ainda não aplicada). Migra automaticamente
// quando a tabela voltar a funcionar.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConfigFinanceira = {
  pro_labore_socio1: number;
  pro_labore_socio2: number;
  das_mei_mensal: number;
  teto_mei_anual: number;
  reserva_caixa: number;
  meta_lucro_mensal: number;
  nome_socio1: string;
  nome_socio2: string;
};

export const CONFIG_DEFAULT: ConfigFinanceira = {
  pro_labore_socio1: 0,
  pro_labore_socio2: 0,
  das_mei_mensal: 80.90,
  teto_mei_anual: 81000,
  reserva_caixa: 0,
  meta_lucro_mensal: 0,
  nome_socio1: 'Você',
  nome_socio2: 'Sócio',
};

const STORAGE_KEY = 'peak-config-financeira-v1';

function isTabelaNaoExisteErro(err: any): boolean {
  return err?.code === 'PGRST205' || err?.message?.includes('config_financeira');
}

function lerLocal(): ConfigFinanceira {
  if (typeof window === 'undefined') return CONFIG_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return CONFIG_DEFAULT;
    return { ...CONFIG_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return CONFIG_DEFAULT;
  }
}

function salvarLocal(c: ConfigFinanceira) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

function limparLocal() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function temDadosLocaisPersonalizados(): boolean {
  const local = lerLocal();
  return JSON.stringify(local) !== JSON.stringify(CONFIG_DEFAULT);
}

async function salvarConfigSupabase(c: ConfigFinanceira): Promise<void> {
  const updates = [
    { chave: 'pro_labore_socio1', valor: c.pro_labore_socio1, valor_texto: c.nome_socio1 },
    { chave: 'pro_labore_socio2', valor: c.pro_labore_socio2, valor_texto: c.nome_socio2 },
    { chave: 'das_mei_mensal', valor: c.das_mei_mensal, valor_texto: 'DAS MEI mensal' },
    { chave: 'teto_mei_anual', valor: c.teto_mei_anual, valor_texto: 'Limite anual MEI' },
    { chave: 'reserva_caixa', valor: c.reserva_caixa, valor_texto: 'Reserva atual' },
    { chave: 'meta_lucro_mensal', valor: c.meta_lucro_mensal, valor_texto: 'Meta de lucro' },
  ];
  for (const u of updates) {
    const { error } = await supabase
      .from('config_financeira')
      .upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
    if (error) throw error;
  }
}

export type LerResult = {
  config: ConfigFinanceira;
  origem: 'supabase' | 'local';
  migrado?: boolean; // true quando dados locais foram migrados pro Supabase nessa leitura
};

export async function lerConfigFinanceira(): Promise<LerResult> {
  const { data, error } = await supabase.from('config_financeira').select('*');

  if (error) {
    if (isTabelaNaoExisteErro(error)) {
      return { config: lerLocal(), origem: 'local' };
    }
    throw error;
  }

  // Lê do Supabase
  const dbConfig: ConfigFinanceira = { ...CONFIG_DEFAULT };
  (data || []).forEach((row: any) => {
    const chave = row.chave;
    const valor = Number(row.valor);
    const texto = row.valor_texto;
    if (chave === 'pro_labore_socio1') {
      dbConfig.pro_labore_socio1 = valor;
      if (texto) dbConfig.nome_socio1 = texto;
    } else if (chave === 'pro_labore_socio2') {
      dbConfig.pro_labore_socio2 = valor;
      if (texto) dbConfig.nome_socio2 = texto;
    } else if (chave in CONFIG_DEFAULT) {
      (dbConfig as any)[chave] = valor;
    }
  });

  // Migração automática: se há dados locais personalizados e o Supabase está vazio
  const dbVazio = JSON.stringify(dbConfig) === JSON.stringify(CONFIG_DEFAULT);
  if (temDadosLocaisPersonalizados() && dbVazio) {
    const local = lerLocal();
    try {
      await salvarConfigSupabase(local);
      limparLocal();
      return { config: local, origem: 'supabase', migrado: true };
    } catch {
      // Migração falhou — segue usando local
      return { config: local, origem: 'local' };
    }
  }

  return { config: dbConfig, origem: 'supabase' };
}

export async function salvarConfigFinanceira(c: ConfigFinanceira): Promise<{ origem: 'supabase' | 'local' }> {
  try {
    await salvarConfigSupabase(c);
    // Se tinha dados locais, limpa porque agora o supabase é a fonte
    if (temDadosLocaisPersonalizados()) limparLocal();
    return { origem: 'supabase' };
  } catch (err: any) {
    if (isTabelaNaoExisteErro(err)) {
      salvarLocal(c);
      return { origem: 'local' };
    }
    throw err;
  }
}

// ============================================================
// React Query hooks
// ============================================================
export function useConfigFinanceira() {
  return useQuery({
    queryKey: ['config-financeira'],
    queryFn: lerConfigFinanceira,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSalvarConfigFinanceira() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salvarConfigFinanceira,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-financeira'] });
    },
  });
}
