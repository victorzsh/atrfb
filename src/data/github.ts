// Acesso ao repositório privado do aluno pela API do GitHub.
// Cada salvamento vira um commit, então o histórico fica guardado lá.

export interface ConfigGitHub {
  dono: string;
  repo: string;
  token: string;
}

export const ARQ_DADOS = 'dados.json';
export const ARQ_PLANILHA = 'planilha.xlsx';

export class ErroGitHub extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

async function api(cfg: ConfigGitHub, caminho: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`https://api.github.com/repos/${cfg.dono}/${cfg.repo}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok && r.status !== 404) {
    let msg = `GitHub respondeu ${r.status}`;
    try {
      msg = (await r.clone().json()).message ?? msg;
    } catch {
      /* resposta sem JSON */
    }
    if (r.status === 401) msg = 'Token inválido ou expirado.';
    if (r.status === 403) msg = 'O token não tem permissão de escrita neste repositório.';
    throw new ErroGitHub(r.status, msg);
  }
  return r;
}

export function bytesParaBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verificar(cfg: ConfigGitHub): Promise<{ privado: boolean }> {
  const r = await fetch(`https://api.github.com/repos/${cfg.dono}/${cfg.repo}`, {
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' },
  });
  if (r.status === 404) throw new ErroGitHub(404, 'Repositório não encontrado (ou o token não tem acesso a ele).');
  if (r.status === 401) throw new ErroGitHub(401, 'Token inválido ou expirado.');
  if (!r.ok) throw new ErroGitHub(r.status, `GitHub respondeu ${r.status}`);
  const j = await r.json();
  if (j.permissions && !j.permissions.push) throw new ErroGitHub(403, 'O token não tem permissão de escrita neste repositório.');
  return { privado: !!j.private };
}

export async function lerJson<T>(cfg: ConfigGitHub, caminho: string, ref?: string): Promise<{ dados: T; sha: string } | null> {
  const r = await api(cfg, `/contents/${caminho}${ref ? `?ref=${ref}` : ''}`);
  if (r.status === 404) return null;
  const j = await r.json();
  const txt = new TextDecoder().decode(base64ParaBytes(j.content));
  return { dados: JSON.parse(txt) as T, sha: j.sha };
}

export async function lerBinario(cfg: ConfigGitHub, caminho: string): Promise<Uint8Array | null> {
  const r = await api(cfg, `/contents/${caminho}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (r.status === 404) return null;
  return new Uint8Array(await r.arrayBuffer());
}

export async function shaDe(cfg: ConfigGitHub, caminho: string): Promise<string | null> {
  const r = await api(cfg, `/contents/${caminho}`);
  if (r.status === 404) return null;
  return (await r.json()).sha;
}

export async function gravar(cfg: ConfigGitHub, caminho: string, bytes: Uint8Array, mensagem: string, sha: string | null): Promise<string> {
  const corpo = (s: string | null) => JSON.stringify({ message: mensagem, content: bytesParaBase64(bytes), ...(s ? { sha: s } : {}) });
  let r = await fetch(`https://api.github.com/repos/${cfg.dono}/${cfg.repo}/contents/${caminho}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: corpo(sha),
  });
  // O arquivo mudou em outro aparelho: pega o sha atual e grava por cima.
  if (r.status === 409 || r.status === 422) {
    const atual = await shaDe(cfg, caminho);
    r = await api(cfg, `/contents/${caminho}`, { method: 'PUT', body: corpo(atual) });
  }
  if (!r.ok) {
    const msg = r.status === 401 ? 'Token inválido ou expirado.' : r.status === 403 ? 'O token não tem permissão de escrita neste repositório.' : `GitHub respondeu ${r.status}`;
    throw new ErroGitHub(r.status, msg);
  }
  const j = await r.json();
  return j.content.sha;
}

export async function gravarJson(cfg: ConfigGitHub, caminho: string, dados: unknown, mensagem: string, sha: string | null): Promise<string> {
  return gravar(cfg, caminho, new TextEncoder().encode(JSON.stringify(dados, null, 1)), mensagem, sha);
}

export interface Versao {
  sha: string;
  mensagem: string;
  data: string;
}

export async function versoes(cfg: ConfigGitHub, caminho: string, porPagina = 30): Promise<Versao[]> {
  const r = await api(cfg, `/commits?path=${caminho}&per_page=${porPagina}`);
  if (r.status === 404) return [];
  const j = await r.json();
  return j.map((c: { sha: string; commit: { message: string; committer: { date: string } } }) => ({
    sha: c.sha,
    mensagem: c.commit.message,
    data: c.commit.committer.date,
  }));
}
