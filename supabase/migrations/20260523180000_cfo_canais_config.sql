-- CFO Peak: canais de venda gerenciáveis e configurações financeiras

-- Canais de venda (loja, Instagram, parcerias, ads, etc.)
CREATE TABLE IF NOT EXISTS public.canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'organico', -- loja | organico | pago | parceria
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed de canais iniciais
INSERT INTO public.canais (nome, tipo) VALUES
  ('Loja física', 'loja'),
  ('Instagram', 'organico'),
  ('WhatsApp', 'organico'),
  ('Indicação', 'organico'),
  ('Anúncio Meta', 'pago'),
  ('Anúncio Google', 'pago')
ON CONFLICT (nome) DO NOTHING;

-- Vínculo gasto → canal (pra calcular ROAS)
-- Ex: gasto "Meta Ads campanha março" categoria Anúncios, canal "Anúncio Meta"
ALTER TABLE public.custos_fixos
  ADD COLUMN IF NOT EXISTS canal text;

-- Configurações financeiras chave→valor (pró-labore, reserva, DAS, teto)
CREATE TABLE IF NOT EXISTS public.config_financeira (
  chave text PRIMARY KEY,
  valor numeric NOT NULL DEFAULT 0,
  valor_texto text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.config_financeira (chave, valor, valor_texto) VALUES
  ('pro_labore_socio1', 0, 'Você'),
  ('pro_labore_socio2', 0, 'Sócio'),
  ('das_mei_mensal', 80.90, 'DAS MEI Comércio 2026'),
  ('teto_mei_anual', 81000, 'Limite anual MEI'),
  ('reserva_caixa', 0, 'Reserva atual'),
  ('meta_lucro_mensal', 0, 'Meta de lucro mensal')
ON CONFLICT (chave) DO NOTHING;
