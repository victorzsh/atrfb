import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Dados } from './model';
import { local, lerPlanilhaLocal, salvarPlanilhaLocal } from './local';
import * as gh from './github';

export type EstadoSync = 'local' | 'carregando' | 'salvando' | 'salvo' | 'erro';

interface Loja {
  dados: Dados | null;
  pronto: boolean;
  sync: { estado: EstadoSync; em: number | null; erro: string | null };
  github: gh.ConfigGitHub | null;
  tema: 'claro' | 'escuro';
  setTema: (t: 'claro' | 'escuro') => void;
  alterar: (mensagem: string, fn: (d: Dados) => void) => void;
  substituir: (d: Dados, mensagem: string) => void;
  conectar: (cfg: gh.ConfigGitHub) => Promise<string>;
  desconectar: () => void;
  salvarPlanilha: (bytes: Uint8Array, mensagem: string) => Promise<void>;
  planilha: () => Promise<Uint8Array | null>;
  versoes: () => Promise<gh.Versao[]>;
  restaurar: (v: gh.Versao) => Promise<void>;
  salvarAgora: () => Promise<void>;
}

const Ctx = createContext<Loja | null>(null);

export function useLoja(): Loja {
  const l = useContext(Ctx);
  if (!l) throw new Error('useLoja fora do Provedor');
  return l;
}

export function useDados(): Dados {
  const { dados } = useLoja();
  if (!dados) throw new Error('Sem dados');
  return dados;
}

export function Provedor({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados | null>(() => local.dados());
  const [github, setGithub] = useState<gh.ConfigGitHub | null>(() => local.github());
  const [pronto, setPronto] = useState(false);
  const [sync, setSync] = useState<Loja['sync']>({ estado: 'local', em: null, erro: null });
  const [tema, setTemaState] = useState(local.tema());

  const dadosRef = useRef(dados);
  const githubRef = useRef(github);
  const shaRef = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const salvando = useRef(false);
  dadosRef.current = dados;
  githubRef.current = github;

  const enviar = useCallback(async () => {
    const cfg = githubRef.current;
    const d = dadosRef.current;
    const msgs = local.pendente();
    if (!cfg || !d || msgs.length === 0) {
      if (!cfg) setSync((s) => ({ ...s, estado: 'local' }));
      return;
    }
    if (salvando.current) {
      agendar(2000);
      return;
    }
    salvando.current = true;
    setSync((s) => ({ ...s, estado: 'salvando', erro: null }));
    try {
      const mensagem = msgs.length === 1 ? msgs[0] : `${msgs[msgs.length - 1]} (+${msgs.length - 1})\n\n${msgs.join('\n')}`;
      shaRef.current = await gh.gravarJson(cfg, gh.ARQ_DADOS, d, mensagem, shaRef.current);
      // Se algo mudou enquanto salvava, fica pendente para o próximo envio.
      const depois = local.pendente();
      local.salvarPendente(depois.slice(msgs.length));
      setSync({ estado: depois.length > msgs.length ? 'salvando' : 'salvo', em: Date.now(), erro: null });
      if (depois.length > msgs.length) agendar(1500);
    } catch (e) {
      setSync((s) => ({ ...s, estado: 'erro', erro: e instanceof Error ? e.message : String(e) }));
      agendar(30000);
    } finally {
      salvando.current = false;
    }
  }, []);

  const agendar = useCallback(
    (ms = 1500) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void enviar(), ms);
    },
    [enviar],
  );

  const aplicar = useCallback(
    (d: Dados, mensagem: string) => {
      d.atualizadoEm = new Date().toISOString();
      dadosRef.current = d;
      setDados(d);
      local.salvarDados(d);
      // Sem GitHub não há para onde enviar; ao conectar, os dados daqui sobem de uma vez.
      if (githubRef.current) {
        local.salvarPendente([...local.pendente(), mensagem]);
        agendar();
      }
    },
    [agendar],
  );

  const alterar = useCallback(
    (mensagem: string, fn: (d: Dados) => void) => {
      const atual = dadosRef.current;
      if (!atual) return;
      const novo = structuredClone(atual);
      fn(novo);
      aplicar(novo, mensagem);
    },
    [aplicar],
  );

  // Busca a versão do GitHub; se este aparelho tem mudanças não enviadas, elas vencem.
  const puxar = useCallback(async () => {
    const cfg = githubRef.current;
    if (!cfg) return;
    if (local.pendente().length > 0) {
      shaRef.current = await gh.shaDe(cfg, gh.ARQ_DADOS).catch(() => shaRef.current);
      return enviar();
    }
    const r = await gh.lerJson<Dados>(cfg, gh.ARQ_DADOS);
    if (r) {
      shaRef.current = r.sha;
      const atual = dadosRef.current;
      if (!atual || r.dados.atualizadoEm >= atual.atualizadoEm) {
        dadosRef.current = r.dados;
        setDados(r.dados);
        local.salvarDados(r.dados);
      }
      setSync({ estado: 'salvo', em: Date.now(), erro: null });
    } else if (dadosRef.current) {
      local.salvarPendente(['Primeira cópia dos dados']);
      await enviar();
    }
  }, [enviar]);

  useEffect(() => {
    (async () => {
      if (githubRef.current) {
        setSync((s) => ({ ...s, estado: 'carregando' }));
        try {
          await puxar();
        } catch (e) {
          setSync({ estado: 'erro', em: null, erro: e instanceof Error ? e.message : String(e) });
        }
      }
      setPronto(true);
    })();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void puxar().catch(() => undefined);
    };
    const aoSair = (e: BeforeUnloadEvent) => {
      if (githubRef.current && local.pendente().length > 0) e.preventDefault();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('beforeunload', aoSair);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('beforeunload', aoSair);
    };
  }, [puxar]);

  const loja: Loja = useMemo(
    () => ({
      dados,
      pronto,
      sync,
      github,
      tema,
      setTema: (t) => {
        local.salvarTema(t);
        setTemaState(t);
      },
      alterar,
      substituir: (d, mensagem) => aplicar(structuredClone(d), mensagem),
      conectar: async (cfg) => {
        const { privado } = await gh.verificar(cfg);
        local.salvarGithub(cfg);
        githubRef.current = cfg;
        setGithub(cfg);
        shaRef.current = null;
        const remoto = await gh.lerJson<Dados>(cfg, gh.ARQ_DADOS);
        const atual = dadosRef.current;
        let resultado: string;
        if (remoto && (!atual || remoto.dados.atualizadoEm >= atual.atualizadoEm)) {
          shaRef.current = remoto.sha;
          dadosRef.current = remoto.dados;
          setDados(remoto.dados);
          local.salvarDados(remoto.dados);
          local.salvarPendente([]);
          resultado = 'Dados carregados do GitHub.';
        } else {
          shaRef.current = remoto?.sha ?? null;
          local.salvarPendente(['Dados enviados deste aparelho']);
          await enviar();
          resultado = 'Dados deste aparelho enviados para o GitHub.';
        }
        const planilhaLocal = await lerPlanilhaLocal();
        if (planilhaLocal && !(await gh.shaDe(cfg, gh.ARQ_PLANILHA))) {
          await gh.gravar(cfg, gh.ARQ_PLANILHA, planilhaLocal, 'Planilha original da Estratégia', null);
        }
        setSync({ estado: 'salvo', em: Date.now(), erro: null });
        return privado ? resultado : resultado + ' Atenção: o repositório é público.';
      },
      desconectar: () => {
        local.salvarGithub(null);
        githubRef.current = null;
        setGithub(null);
        setSync({ estado: 'local', em: null, erro: null });
      },
      salvarPlanilha: async (bytes, mensagem) => {
        await salvarPlanilhaLocal(bytes);
        const cfg = githubRef.current;
        if (cfg) await gh.gravar(cfg, gh.ARQ_PLANILHA, bytes, mensagem, await gh.shaDe(cfg, gh.ARQ_PLANILHA));
      },
      planilha: async () => {
        const l = await lerPlanilhaLocal();
        if (l) return l;
        const cfg = githubRef.current;
        if (!cfg) return null;
        const r = await gh.lerBinario(cfg, gh.ARQ_PLANILHA);
        if (r) await salvarPlanilhaLocal(r);
        return r;
      },
      versoes: async () => (githubRef.current ? gh.versoes(githubRef.current, gh.ARQ_DADOS) : []),
      restaurar: async (v) => {
        const cfg = githubRef.current;
        if (!cfg) return;
        const r = await gh.lerJson<Dados>(cfg, gh.ARQ_DADOS, v.sha);
        if (!r) throw new Error('Versão não encontrada.');
        aplicar(r.dados, `Restaurada a versão de ${new Date(v.data).toLocaleString('pt-BR')}`);
      },
      salvarAgora: () => enviar(),
    }),
    [dados, pronto, sync, github, tema, alterar, aplicar, enviar],
  );

  return <Ctx.Provider value={loja}>{children}</Ctx.Provider>;
}
