
-- Create produtos table
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  nome TEXT NOT NULL,
  marca TEXT,
  categoria TEXT,
  sabor TEXT,
  qtd_atual INTEGER DEFAULT 0,
  custo_unit DECIMAL(10,2),
  preco_venda DECIMAL(10,2),
  estoque_min INTEGER DEFAULT 5,
  pto_reposicao INTEGER DEFAULT 8,
  validade DATE,
  classe_abc TEXT DEFAULT 'B',
  fornecedor TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create clientes table
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  whatsapp TEXT,
  data_primeira_compra DATE,
  data_ultima_compra DATE,
  ultimo_produto_categoria TEXT,
  valor_ultima_compra DECIMAL(10,2),
  total_acumulado DECIMAL(10,2) DEFAULT 0,
  data_proximo_recontato DATE,
  status TEXT DEFAULT 'Novo',
  canal_aquisicao TEXT DEFAULT 'Loja física',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create vendas table
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id),
  produto_nome TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  cliente_nome TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_venda DECIMAL(10,2) NOT NULL,
  custo_unit DECIMAL(10,2) NOT NULL,
  margem_rs DECIMAL(10,2) GENERATED ALWAYS AS (preco_venda - custo_unit) STORED,
  forma_pgto TEXT,
  canal TEXT DEFAULT 'Loja física',
  vendedor TEXT DEFAULT 'Nicolas',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users full access (internal app, only 2 users)
CREATE POLICY "Authenticated users full access produtos" ON public.produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access vendas" ON public.vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon for development
CREATE POLICY "Anon access produtos" ON public.produtos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon access clientes" ON public.clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon access vendas" ON public.vendas FOR ALL TO anon USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_vendas_created_at ON public.vendas(created_at);
CREATE INDEX idx_vendas_produto_id ON public.vendas(produto_id);
CREATE INDEX idx_produtos_nome ON public.produtos(nome);
CREATE INDEX idx_clientes_nome ON public.clientes(nome);
CREATE INDEX idx_clientes_data_proximo_recontato ON public.clientes(data_proximo_recontato);
