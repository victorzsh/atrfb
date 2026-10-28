import type { Dados } from './model';
import type { Acesso, Cifra } from './seguranca';

// Cópia neste aparelho: funciona sem internet e abre na hora.
// O token do GitHub só fica aqui cifrado pela senha, nunca em texto puro.

export interface GithubLocal {
  dono: string;
  repo: string;
  token: Cifra;
}

const K_DADOS = 'atrfb:dados';
const K_PENDENTE = 'atrfb:pendente';
const K_GITHUB = 'atrfb:github';
const K_ACESSO = 'atrfb:acesso';
const K_TEMA = 'atrfb:tema';

function ler<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function gravar(k: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* armazenamento indisponível */
  }
}

export const local = {
  dados: () => ler<Dados>(K_DADOS),
  salvarDados: (d: Dados | null) => gravar(K_DADOS, d),
  pendente: () => ler<string[]>(K_PENDENTE) ?? [],
  salvarPendente: (msgs: string[]) => gravar(K_PENDENTE, msgs.length ? msgs : null),
  github: () => {
    const g = ler<GithubLocal>(K_GITHUB);
    // Configuração antiga, com token em texto puro: descarta e pede para conectar de novo.
    return g && typeof g.token === 'object' ? g : null;
  },
  salvarGithub: (c: GithubLocal | null) => gravar(K_GITHUB, c),
  acesso: () => ler<Acesso>(K_ACESSO),
  salvarAcesso: (a: Acesso | null) => gravar(K_ACESSO, a),
  tema: () => (ler<string>(K_TEMA) === 'escuro' ? 'escuro' : 'claro') as 'claro' | 'escuro',
  salvarTema: (t: 'claro' | 'escuro') => gravar(K_TEMA, t),
};

// IndexedDB: a planilha original (para exportar) e, se você pedir para lembrar,
// a chave desbloqueada por algumas horas. A chave é um CryptoKey não
// exportável: dá para usar neste navegador, mas não para copiar.
function db(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open('atrfb', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function idbLer<T>(k: string): Promise<T | null> {
  try {
    const d = await db();
    return await new Promise((ok) => {
      const r = d.transaction('arquivos').objectStore('arquivos').get(k);
      r.onsuccess = () => ok((r.result as T) ?? null);
      r.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

async function idbGravar(k: string, v: unknown): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((ok) => {
      const tx = d.transaction('arquivos', 'readwrite');
      if (v === null) tx.objectStore('arquivos').delete(k);
      else tx.objectStore('arquivos').put(v, k);
      tx.oncomplete = () => ok();
      tx.onerror = () => ok();
    });
  } catch {
    /* sem IndexedDB */
  }
}

export const lerPlanilhaLocal = () => idbLer<Uint8Array>('planilha');
export const salvarPlanilhaLocal = (bytes: Uint8Array) => idbGravar('planilha', bytes);

export async function chaveLembrada(): Promise<CryptoKey | null> {
  const r = await idbLer<{ chave: CryptoKey; expira: number }>('chave');
  if (!r) return null;
  if (r.expira < Date.now()) {
    await idbGravar('chave', null);
    return null;
  }
  return r.chave;
}

export const lembrarChave = (chave: CryptoKey | null, horas = 8) =>
  idbGravar('chave', chave ? { chave, expira: Date.now() + horas * 3600_000 } : null);

export async function apagarTudo(): Promise<void> {
  for (const k of [K_DADOS, K_PENDENTE, K_GITHUB, K_ACESSO]) gravar(k, null);
  await idbGravar('chave', null);
  await idbGravar('planilha', null);
}
