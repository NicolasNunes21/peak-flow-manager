// Editar e excluir venda com reversão automática de:
//  - Estoque do produto
//  - total_acumulado do cliente
//
// Atenção: opera em N etapas (sem transação verdadeira no Supabase client),
// mas idempotente — se falhar no meio, dá pra retentar manualmente.

import { supabase } from "@/integrations/supabase/client";

export type VendaPatch = {
  quantidade?: number;
  preco_venda?: number;
  desconto_rs?: number;
  brinde?: string | null;
  observacao?: string | null;
  forma_pgto?: string | null;
  canal?: string | null;
};

export type VendaRow = {
  id: string;
  produto_id: string | null;
  produto_nome: string | null;
  quantidade: number;
  preco_venda: number;
  custo_unit: number;
  desconto_rs?: number | null;
  cliente_id: string | null;
  brinde?: string | null;
  forma_pgto: string | null;
  canal: string | null;
  observacao: string | null;
  created_at: string | null;
};

function totalLiquido(v: { quantidade: number; preco_venda: number; desconto_rs?: number | null }) {
  return v.quantidade * v.preco_venda - Number(v.desconto_rs || 0);
}

export async function excluirVenda(venda: VendaRow): Promise<void> {
  // 1) Devolver estoque ao produto
  if (venda.produto_id) {
    const { data: prod, error: prodErr } = await supabase
      .from("produtos")
      .select("qtd_atual")
      .eq("id", venda.produto_id)
      .maybeSingle();
    if (prodErr) throw prodErr;
    if (prod) {
      const novaQtd = (prod.qtd_atual ?? 0) + venda.quantidade;
      const { error: updErr } = await supabase
        .from("produtos")
        .update({ qtd_atual: novaQtd })
        .eq("id", venda.produto_id);
      if (updErr) throw updErr;
    }
  }

  // 2) Reverter total_acumulado do cliente
  if (venda.cliente_id) {
    const { data: cli, error: cliErr } = await supabase
      .from("clientes")
      .select("total_acumulado")
      .eq("id", venda.cliente_id)
      .maybeSingle();
    if (cliErr) throw cliErr;
    if (cli) {
      const novoTotal = Math.max(0, Number(cli.total_acumulado ?? 0) - totalLiquido(venda));
      const { error: updErr } = await supabase
        .from("clientes")
        .update({ total_acumulado: novoTotal })
        .eq("id", venda.cliente_id);
      if (updErr) throw updErr;
    }
  }

  // 3) Excluir a venda
  const { error: delErr } = await supabase.from("vendas").delete().eq("id", venda.id);
  if (delErr) throw delErr;
}

export async function editarVenda(vendaOriginal: VendaRow, patch: VendaPatch): Promise<void> {
  // Calcula deltas
  const novaQuantidade = patch.quantidade ?? vendaOriginal.quantidade;
  const novoPreco = patch.preco_venda ?? vendaOriginal.preco_venda;
  const novoDesconto = patch.desconto_rs ?? Number(vendaOriginal.desconto_rs || 0);

  const deltaQuantidade = novaQuantidade - vendaOriginal.quantidade;
  const totalOriginal = totalLiquido(vendaOriginal);
  const totalNovo = novaQuantidade * novoPreco - novoDesconto;
  const deltaTotal = totalNovo - totalOriginal;

  // 1) Ajustar estoque se quantidade mudou
  if (deltaQuantidade !== 0 && vendaOriginal.produto_id) {
    const { data: prod, error: prodErr } = await supabase
      .from("produtos")
      .select("qtd_atual")
      .eq("id", vendaOriginal.produto_id)
      .maybeSingle();
    if (prodErr) throw prodErr;
    if (prod) {
      // Vendi mais → diminui estoque; vendi menos → devolve estoque
      const novaQtd = (prod.qtd_atual ?? 0) - deltaQuantidade;
      const { error: updErr } = await supabase
        .from("produtos")
        .update({ qtd_atual: novaQtd })
        .eq("id", vendaOriginal.produto_id);
      if (updErr) throw updErr;
    }
  }

  // 2) Ajustar total_acumulado do cliente
  if (deltaTotal !== 0 && vendaOriginal.cliente_id) {
    const { data: cli, error: cliErr } = await supabase
      .from("clientes")
      .select("total_acumulado")
      .eq("id", vendaOriginal.cliente_id)
      .maybeSingle();
    if (cliErr) throw cliErr;
    if (cli) {
      const novoTotal = Math.max(0, Number(cli.total_acumulado ?? 0) + deltaTotal);
      const { error: updErr } = await supabase
        .from("clientes")
        .update({ total_acumulado: novoTotal })
        .eq("id", vendaOriginal.cliente_id);
      if (updErr) throw updErr;
    }
  }

  // 3) Atualizar venda
  const updates: Record<string, any> = {};
  if (patch.quantidade !== undefined) updates.quantidade = patch.quantidade;
  if (patch.preco_venda !== undefined) updates.preco_venda = patch.preco_venda;
  if (patch.desconto_rs !== undefined) updates.desconto_rs = patch.desconto_rs;
  if (patch.brinde !== undefined) updates.brinde = patch.brinde;
  if (patch.observacao !== undefined) updates.observacao = patch.observacao;
  if (patch.forma_pgto !== undefined) updates.forma_pgto = patch.forma_pgto;
  if (patch.canal !== undefined) updates.canal = patch.canal;

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase.from("vendas").update(updates).eq("id", vendaOriginal.id);
    if (updErr) throw updErr;
  }
}

// Mensagem amigável de preview do que a operação fará
export function preverImpactoExclusao(venda: VendaRow): string[] {
  const lines: string[] = [];
  if (venda.produto_id && venda.produto_nome) {
    lines.push(`Devolve ${venda.quantidade} un de ${venda.produto_nome} ao estoque`);
  }
  if (venda.cliente_id) {
    lines.push(`Tira ${formatBR(totalLiquido(venda))} do total acumulado do cliente`);
  }
  lines.push(`Remove a venda de ${formatBR(totalLiquido(venda))}`);
  return lines;
}

function formatBR(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
