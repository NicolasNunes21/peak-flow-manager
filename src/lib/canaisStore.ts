// Canais de venda com fallback localStorage — funciona mesmo sem a tabela `canais`
// no Supabase. Migra automaticamente quando a tabela passa a existir.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Canal = {
  id: string;
  nome: string;
  tipo: 'loja' | 'organico' | 'pago' | 'parceria' | string;
  ativo: boolean;
  created_at: string | null;
};

const CANAIS_PADRAO: Canal[] = [
  { id: 'default-loja', nome: 'Loja física', tipo: 'loja', ativo: true, created_at: null },
  { id: 'default-instagram', nome: 'Instagram', tipo: 'organico', ativo: true, created_at: null },
  { id: 'default-whatsapp', nome: 'WhatsApp', tipo: 'organico', ativo: true, created_at: null },
  { id: 'default-indica', nome: 'Indicação', tipo: 'organico', ativo: true, created_at: null },
  { id: 'default-meta', nome: 'Anúncio Meta', tipo: 'pago', ativo: true, created_at: null },
  { id: 'default-google', nome: 'Anúncio Google', tipo: 'pago', ativo: true, created_at: null },
];

const STORAGE_KEY = 'peak-canais-v1';

function isTabelaNaoExiste(err: any): boolean {
  return err?.code === 'PGRST205' || err?.message?.includes('canais') && err?.message?.includes('schema');
}

function lerLocal(): Canal[] {
  if (typeof window === 'undefined') return CANAIS_PADRAO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return CANAIS_PADRAO;
    return JSON.parse(raw);
  } catch {
    return CANAIS_PADRAO;
  }
}

function salvarLocal(list: Canal[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function limparLocal() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function temPersonalizacaoLocal(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem(STORAGE_KEY);
}

export type LerCanaisResult = {
  canais: Canal[];
  origem: 'supabase' | 'local';
  migrado?: boolean;
};

export async function lerCanais(somenteAtivos = false): Promise<LerCanaisResult> {
  let query = supabase.from('canais').select('*').order('nome');
  if (somenteAtivos) query = query.eq('ativo', true);

  const { data, error } = await query;

  if (error) {
    if (isTabelaNaoExiste(error)) {
      const local = lerLocal();
      return {
        canais: somenteAtivos ? local.filter(c => c.ativo) : local,
        origem: 'local',
      };
    }
    throw error;
  }

  const supabaseList = (data || []) as Canal[];

  // Migra dados locais pro Supabase se Supabase estiver "vazio" (só com canais padrão ou nada)
  if (temPersonalizacaoLocal() && supabaseList.length === 0) {
    const local = lerLocal();
    try {
      const inserts = local.filter(c => !c.id.startsWith('default-')).map(c => ({
        nome: c.nome,
        tipo: c.tipo,
        ativo: c.ativo,
      }));
      if (inserts.length > 0) {
        await supabase.from('canais').insert(inserts);
      }
      limparLocal();
      // Re-fetch após migração
      const { data: novo } = await query;
      return {
        canais: (novo || []) as Canal[],
        origem: 'supabase',
        migrado: true,
      };
    } catch {
      return { canais: local, origem: 'local' };
    }
  }

  return { canais: supabaseList, origem: 'supabase' };
}

export async function criarCanal(nome: string, tipo: string): Promise<{ canal: Canal; origem: 'supabase' | 'local' }> {
  const { data, error } = await supabase
    .from('canais')
    .insert({ nome: nome.trim(), tipo })
    .select()
    .single();

  if (error) {
    if (isTabelaNaoExiste(error)) {
      const list = lerLocal();
      // Detecta duplicidade
      if (list.find(c => c.nome.toLowerCase() === nome.trim().toLowerCase())) {
        throw new Error('Já existe canal com esse nome');
      }
      const novo: Canal = {
        id: `local-${Date.now()}`,
        nome: nome.trim(),
        tipo,
        ativo: true,
        created_at: new Date().toISOString(),
      };
      salvarLocal([...list, novo]);
      return { canal: novo, origem: 'local' };
    }
    throw error;
  }

  return { canal: data as Canal, origem: 'supabase' };
}

export async function atualizarCanal(id: string, patch: Partial<Pick<Canal, 'nome' | 'tipo' | 'ativo'>>): Promise<{ origem: 'supabase' | 'local' }> {
  // ID local começa com 'local-' ou 'default-'
  const isLocal = id.startsWith('local-') || id.startsWith('default-');
  if (isLocal) {
    const list = lerLocal();
    const idx = list.findIndex(c => c.id === id);
    if (idx < 0) {
      // Pode ser canal padrão que ainda não foi salvo no local — clona e salva
      const padrao = CANAIS_PADRAO.find(c => c.id === id);
      if (padrao) {
        const novaLista = [...list, { ...padrao, ...patch }];
        salvarLocal(novaLista);
        return { origem: 'local' };
      }
      throw new Error('Canal não encontrado');
    }
    list[idx] = { ...list[idx], ...patch };
    salvarLocal(list);
    return { origem: 'local' };
  }

  const { error } = await supabase.from('canais').update(patch).eq('id', id);
  if (error) {
    if (isTabelaNaoExiste(error)) {
      // Não deveria chegar aqui (id seria local), mas seguro
      throw new Error('Tabela canais não existe');
    }
    throw error;
  }
  return { origem: 'supabase' };
}

// ============================================================
// Hooks React Query
// ============================================================
export function useCanais(somenteAtivos = false) {
  return useQuery({
    queryKey: ['canais', somenteAtivos ? 'ativos' : 'todos'],
    queryFn: () => lerCanais(somenteAtivos),
    retry: false,
    staleTime: 30_000,
  });
}

export function useCriarCanal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nome, tipo }: { nome: string; tipo: string }) => criarCanal(nome, tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canais'] });
    },
  });
}

export function useAtualizarCanal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Canal, 'nome' | 'tipo' | 'ativo'>> }) => atualizarCanal(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canais'] });
    },
  });
}
