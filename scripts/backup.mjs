// Backup READ-ONLY de todas as tabelas do Supabase.
// Não escreve nada no banco. Salva JSON + CSV fora do repositório.
//
// Uso: node scripts/backup.mjs
//
// Lê as credenciais do .env (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// --- carrega .env manualmente (script roda fora do Vite) ---
function loadEnv() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const TABELAS = [
  'produtos', 'vendas', 'clientes', 'custos_fixos', 'canais',
  'categorias', 'marcas', 'compras', 'fornecedores',
  'ajustes_estoque', 'config_financeira',
];

// busca todas as linhas paginando (limite default do Supabase é 1000)
async function fetchAll(tabela) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  for (;;) {
    const { data, error } = await supabase
      .from(tabela)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function toCSV(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

const stamp = process.argv[2] || 'latest';
const outDir = join(homedir(), 'peak-flow-backups', stamp);
mkdirSync(outDir, { recursive: true });

console.log(`Backup → ${outDir}\n`);
const resumo = {};
let total = 0;
for (const t of TABELAS) {
  try {
    const rows = await fetchAll(t);
    writeFileSync(join(outDir, `${t}.json`), JSON.stringify(rows, null, 2));
    writeFileSync(join(outDir, `${t}.csv`), toCSV(rows));
    resumo[t] = rows.length;
    total += rows.length;
    console.log(`  ✓ ${t.padEnd(18)} ${rows.length} linhas`);
  } catch (e) {
    resumo[t] = `ERRO: ${e.message}`;
    console.log(`  ✗ ${t.padEnd(18)} ${e.message}`);
  }
}
writeFileSync(join(outDir, '_resumo.json'), JSON.stringify({ data: new Date().toISOString(), resumo }, null, 2));
console.log(`\nTotal: ${total} linhas. Resumo em ${join(outDir, '_resumo.json')}`);
