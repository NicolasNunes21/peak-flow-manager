-- Expand custos_fixos to support multiple expense categories (Marketing, Anúncios, Investimento, Parceria, etc.)
-- and one-off expenses (not only monthly recurring).

ALTER TABLE public.custos_fixos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Custo Fixo',
  ADD COLUMN IF NOT EXISTS data date,
  ADD COLUMN IF NOT EXISTS descricao text;

CREATE INDEX IF NOT EXISTS idx_custos_fixos_categoria ON public.custos_fixos(categoria);
CREATE INDEX IF NOT EXISTS idx_custos_fixos_data ON public.custos_fixos(data);
