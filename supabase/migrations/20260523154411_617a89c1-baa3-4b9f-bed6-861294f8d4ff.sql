CREATE TABLE IF NOT EXISTS public.config_financeira (
  chave text PRIMARY KEY,
  valor numeric NOT NULL DEFAULT 0,
  valor_texto text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'organico',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.canais (nome, tipo) VALUES
  ('Loja física', 'loja'),
  ('Instagram', 'organico'),
  ('WhatsApp', 'organico'),
  ('Indicação', 'organico'),
  ('Anúncio Meta', 'pago'),
  ('Anúncio Google', 'pago')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.custos_fixos
  ADD COLUMN IF NOT EXISTS canal text,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Custo Fixo',
  ADD COLUMN IF NOT EXISTS data date,
  ADD COLUMN IF NOT EXISTS descricao text;

INSERT INTO public.config_financeira (chave, valor, valor_texto) VALUES
  ('pro_labore_socio1', 0, 'Você'),
  ('pro_labore_socio2', 0, 'Sócio'),
  ('das_mei_mensal', 80.90, 'DAS MEI Comércio 2026'),
  ('teto_mei_anual', 81000, 'Limite anual MEI'),
  ('reserva_caixa', 0, 'Reserva atual'),
  ('meta_lucro_mensal', 0, 'Meta de lucro mensal'),
  ('data_abertura_loja', 0, NULL)
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE public.config_financeira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon access config_financeira" ON public.config_financeira FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access config_financeira" ON public.config_financeira FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon access canais" ON public.canais FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access canais" ON public.canais FOR ALL TO authenticated USING (true) WITH CHECK (true);