
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon access fornecedores" ON public.fornecedores FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access fornecedores" ON public.fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default suppliers
INSERT INTO public.fornecedores (nome) VALUES
  ('NewShape'),
  ('RamboFit'),
  ('Mercado Livre'),
  ('Site oficial da marca');

CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id),
  produto_nome text,
  fornecedor_nome text,
  quantidade integer NOT NULL DEFAULT 1,
  custo_unit numeric NOT NULL DEFAULT 0,
  custo_total numeric GENERATED ALWAYS AS (quantidade * custo_unit) STORED,
  observacao text,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon access compras" ON public.compras FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access compras" ON public.compras FOR ALL TO authenticated USING (true) WITH CHECK (true);
