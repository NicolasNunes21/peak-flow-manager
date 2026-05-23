-- Edição de venda, desconto/brinde e ajustes de estoque

-- 1) Desconto e brinde em vendas
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS desconto_rs numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brinde text;

-- 2) Histórico de ajustes de estoque (perda, furto, brinde, correção)
CREATE TABLE IF NOT EXISTS public.ajustes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  produto_nome text,
  qtd_anterior integer NOT NULL,
  qtd_nova integer NOT NULL,
  diferenca integer NOT NULL,
  motivo text NOT NULL,         -- 'brinde' | 'perda' | 'furto' | 'erro_recebimento' | 'correcao'
  observacao text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_produto ON public.ajustes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_created ON public.ajustes_estoque(created_at DESC);

-- RLS público (mesmo padrão das outras)
ALTER TABLE public.ajustes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ajustes_estoque_select" ON public.ajustes_estoque;
DROP POLICY IF EXISTS "ajustes_estoque_insert" ON public.ajustes_estoque;
DROP POLICY IF EXISTS "ajustes_estoque_update" ON public.ajustes_estoque;
DROP POLICY IF EXISTS "ajustes_estoque_delete" ON public.ajustes_estoque;

CREATE POLICY "ajustes_estoque_select" ON public.ajustes_estoque FOR SELECT USING (true);
CREATE POLICY "ajustes_estoque_insert" ON public.ajustes_estoque FOR INSERT WITH CHECK (true);
CREATE POLICY "ajustes_estoque_update" ON public.ajustes_estoque FOR UPDATE USING (true);
CREATE POLICY "ajustes_estoque_delete" ON public.ajustes_estoque FOR DELETE USING (true);
