// Taxas de cartão e prazos de recebimento — persistência local (zero fricção).
// Vem com padrões do varejo BR já preenchidos; editável 1x em Configurações.
// Não depende de Supabase: é preferência de cálculo, não dado de venda.

import { useCallback, useState } from "react";
import { TAXAS_PGTO_DEFAULT, type TaxasPgto } from "./cfo";

const STORAGE_KEY = "peak-taxas-pgto-v1";

export function lerTaxas(): TaxasPgto {
  if (typeof window === "undefined") return TAXAS_PGTO_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return TAXAS_PGTO_DEFAULT;
    const parsed = JSON.parse(raw);
    // mescla com o default pra garantir todas as formas mesmo se o storage for antigo
    return { ...TAXAS_PGTO_DEFAULT, ...parsed };
  } catch {
    return TAXAS_PGTO_DEFAULT;
  }
}

export function salvarTaxas(t: TaxasPgto) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  }
}

export function useTaxasPgto() {
  const [taxas, setTaxas] = useState<TaxasPgto>(() => lerTaxas());
  const update = useCallback((t: TaxasPgto) => {
    salvarTaxas(t);
    setTaxas(t);
  }, []);
  return { taxas, update };
}
