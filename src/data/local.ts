import type { Dados } from './model';
import type { ConfigGitHub } from './github';

// Cópia neste aparelho: funciona sem internet e abre na hora.
// O token fica só aqui, nunca vai para o dados.json.

const K_DADOS = 'atrfb:dados';
const K_PENDENTE = 'atrfb:pendente';
const K_GITHUB = 'atrfb:github';
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
  github: () => ler<ConfigGitHub>(K_GITHUB),
  salvarGithub: (c: ConfigGitHub | null) => gravar(K_GITHUB, c),
  tema: () => (ler<string>(K_TEMA) === 'escuro' ? 'escuro' : 'claro') as 'claro' | 'escuro',
  salvarTema: (t: 'claro' | 'escuro') => gravar(K_TEMA, t),
};

// A planilha original (para exportar) fica no IndexedDB, que aguenta arquivos.
function db(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open('atrfb', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

export async function lerPlanilhaLocal(): Promise<Uint8Array | null> {
  try {
    const d = await db();
    return await new Promise((ok) => {
      const r = d.transaction('arquivos').objectStore('arquivos').get('planilha');
      r.onsuccess = () => ok((r.result as Uint8Array) ?? null);
      r.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

export async function salvarPlanilhaLocal(bytes: Uint8Array): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((ok) => {
      const tx = d.transaction('arquivos', 'readwrite');
      tx.objectStore('arquivos').put(bytes, 'planilha');
      tx.oncomplete = () => ok();
      tx.onerror = () => ok();
    });
  } catch {
    /* sem IndexedDB: a planilha continua no GitHub */
  }
}
