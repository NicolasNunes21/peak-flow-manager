
CREATE TABLE public.custos_fixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  recorrencia text NOT NULL DEFAULT 'mensal',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custos_fixos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon access custos_fixos" ON public.custos_fixos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access custos_fixos" ON public.custos_fixos FOR ALL TO authenticated USING (true) WITH CHECK (true);
