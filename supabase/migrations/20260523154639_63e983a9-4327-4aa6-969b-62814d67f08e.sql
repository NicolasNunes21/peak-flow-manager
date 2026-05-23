CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  produto_nome text,
  fornecedor_nome text,
  quantidade numeric NOT NULL DEFAULT 0,
  custo_unit numeric NOT NULL DEFAULT 0,
  custo_total numeric GENERATED ALWAYS AS (quantidade * custo_unit) STORED,
  data_compra date DEFAULT CURRENT_DATE,
  observacao text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_data ON public.compras(data_compra DESC);
CREATE INDEX IF NOT EXISTS idx_compras_produto ON public.compras(produto_id);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon access fornecedores" ON public.fornecedores FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon access compras" ON public.compras FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access compras" ON public.compras FOR ALL TO authenticated USING (true) WITH CHECK (true);