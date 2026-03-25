
CREATE TABLE public.marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon access marcas" ON public.marcas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access marcas" ON public.marcas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon access categorias" ON public.categorias FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access categorias" ON public.categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.marcas (nome) VALUES ('DUX'), ('Max Titanium'), ('Dr. Peanut'), ('Gummy'), ('Lauton');
INSERT INTO public.categorias (nome) VALUES ('Whey'), ('Creatina'), ('Pré-treino'), ('Sobremesa'), ('Vitamina'), ('Outro');
