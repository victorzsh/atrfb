import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Dados } from './model';
import { apagarTudo, chaveLembrada, lembrarChave, local, lerPlanilhaLocal, salvarPlanilhaLocal, type GithubLocal } from './local';
import * as gh from './github';
import { cifrar, conferir, criarAcesso, decifrar, type Acesso } from './seguranca';

export type EstadoSync = 'local' | 'carregando' | 'salvando' | 'salvo' | 'erro' | 'bloqueado';

const ARQ_ACESSO = 'acesso.json';

export interface Pedido {
  modo: 'desbloquear' | 'criar';
  motivo?: string;
}

interface Loja {
  dados: Dados | null;
  pronto: boolean;
  sync: { estado: EstadoSync; em: number | null; erro: string | null };
  github: { dono: string; repo: string } | null;
  tema: 'claro' | 'escuro';
  setTema: (t: 'claro' | 'escuro') => void;

  // Senha
  temSenha: boolean;
  desbloqueado: boolean;
  pedido: Pedido | null;
  desbloquear: (motivo?: string) => Promise<boolean>;
  responder: (senha: string, lembrar: boolean) => Promise<string | null>;
  cancelarPedido: () => void;
  criarSenha: (senha: string) => Promise<void>;
  trocarSenha: (atual: string, nova: string) => Promise<void>;
  bloquear: () => void;
  esquecerAparelho: () => Promise<void>;

  alterar: (mensagem: string, fn: (d: Dados) => void) => void;
  substituir: (d: Dados, mensagem: string) => void;
  conectar: (cfg: gh.ConfigGitHub, senha: string, redefinir: boolean) => Promise<string>;
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
  const [ghLocal, setGhLocal] = useState<GithubLocal | null>(() => local.github());
  const [acesso, setAcesso] = useState<Acesso | null>(() => local.acesso());
  const [chave, setChave] = useState<CryptoKey | null>(null);
  const [pronto, setPronto] = useState(false);
  const [sync, setSync] = useState<Loja['sync']>({ estado: 'local', em: null, erro: null });
  const [tema, setTemaState] = useState(local.tema());
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const dadosRef = useRef(dados);
  const githubRef = useRef<gh.ConfigGitHub | null>(null); // só existe desbloqueado
  const chaveRef = useRef<CryptoKey | null>(null);
  const shaRef = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const salvando = useRef(false);
  const esperando = useRef<((ok: boolean) => void)[]>([]);
  dadosRef.current = dados;
  chaveRef.current = chave;

  const enviar = useCallback(async () => {
    const cfg = githubRef.current;
    const d = dadosRef.current;
    const msgs = local.pendente();
    if (!cfg || !d || msgs.length === 0) return;
    if (salvando.current) {
      agendar(2000);
      return;
    }
    salvando.current = true;
    setSync((s) => ({ ...s, estado: 'salvando', erro: null }));
    try {
      const mensagem = msgs.length === 1 ? msgs[0] : `${msgs[msgs.length - 1]} (+${msgs.length - 1})\n\n${msgs.join('\n')}`;
      shaRef.current = await gh.gravarJson(cfg, gh.ARQ_DADOS, d, mensagem, shaRef.current);
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
      if (local.github()) {
        local.salvarPendente([...local.pendente(), mensagem]);
        agendar();
      }
    },
    [agendar],
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

  // Com a chave em mãos: decifra o token e liga a sincronização.
  const abrirCom = useCallback(
    async (k: CryptoKey) => {
      chaveRef.current = k;
      setChave(k);
      const g = local.github();
      if (!g) return;
      try {
        githubRef.current = { dono: g.dono, repo: g.repo, token: await decifrar(k, g.token) };
        setSync((s) => ({ ...s, estado: 'carregando' }));
        await puxar();
      } catch (e) {
        setSync({ estado: 'erro', em: null, erro: e instanceof Error ? e.message : String(e) });
      }
    },
    [puxar],
  );

  const bloquear = useCallback(() => {
    chaveRef.current = null;
    githubRef.current = null;
    setChave(null);
    void lembrarChave(null);
    if (local.github()) setSync((s) => ({ ...s, estado: 'bloqueado' }));
  }, []);

  useEffect(() => {
    (async () => {
      const k = local.acesso() ? await chaveLembrada() : null;
      if (k) await abrirCom(k);
      else if (local.github()) setSync({ estado: 'bloqueado', em: null, erro: null });
      // Dados antigos sem senha: pede para criar uma antes de qualquer coisa.
      if (local.dados() && !local.acesso()) setPedido({ modo: 'criar' });
      setPronto(true);
    })();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible' && githubRef.current) void puxar().catch(() => undefined);
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
  }, [puxar, abrirCom]);

  const desbloquear = useCallback((motivo?: string): Promise<boolean> => {
    if (chaveRef.current) return Promise.resolve(true);
    return new Promise((ok) => {
      esperando.current.push(ok);
      setPedido({ modo: local.acesso() ? 'desbloquear' : 'criar', motivo });
    });
  }, []);

  const resolverPedido = (ok: boolean) => {
    const fila = esperando.current;
    esperando.current = [];
    setPedido(null);
    fila.forEach((f) => f(ok));
  };

  const criarSenha = useCallback(
    async (senha: string) => {
      const { acesso: a, chave: k } = await criarAcesso(senha);
      local.salvarAcesso(a);
      setAcesso(a);
      // Se já havia GitHub (com o token decifrado em memória), recifra e atualiza o verificador lá.
      const cfg = githubRef.current;
      if (cfg) {
        const g = { dono: cfg.dono, repo: cfg.repo, token: await cifrar(k, cfg.token) };
        local.salvarGithub(g);
        setGhLocal(g);
        await gh.gravarJson(cfg, ARQ_ACESSO, a, 'Senha do app definida', await gh.shaDe(cfg, ARQ_ACESSO));
      }
      await lembrarChave(k);
      await abrirCom(k);
    },
    [abrirCom],
  );

  const alterar = useCallback(
    (mensagem: string, fn: (d: Dados) => void) => {
      if (!chaveRef.current) {
        void desbloquear().then((ok) => ok && alterar(mensagem, fn));
        return;
      }
      const atual = dadosRef.current;
      if (!atual) return;
      const novo = structuredClone(atual);
      fn(novo);
      aplicar(novo, mensagem);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aplicar, desbloquear],
  );

  const loja: Loja = useMemo(
    () => ({
      dados,
      pronto,
      sync,
      github: ghLocal ? { dono: ghLocal.dono, repo: ghLocal.repo } : null,
      tema,
      setTema: (t) => {
        local.salvarTema(t);
        setTemaState(t);
      },

      temSenha: !!acesso,
      desbloqueado: !!chave,
      pedido,
      desbloquear,
      responder: async (senha, lembrar) => {
        const a = local.acesso();
        if (!a) return 'Nenhuma senha definida.';
        const k = await conferir(senha, a);
        if (!k) return 'Senha incorreta.';
        if (lembrar) await lembrarChave(k);
        chaveRef.current = k;
        setChave(k);
        resolverPedido(true);
        await abrirCom(k);
        return null;
      },
      cancelarPedido: () => resolverPedido(false),
      criarSenha: async (senha) => {
        await criarSenha(senha);
        resolverPedido(true);
      },
      trocarSenha: async (atual, nova) => {
        const a = local.acesso();
        const k0 = a ? await conferir(atual, a) : null;
        if (!k0) throw new Error('A senha atual não confere.');
        // O token precisa estar decifrado para ser recifrado com a senha nova.
        const g = local.github();
        if (g && !githubRef.current) githubRef.current = { dono: g.dono, repo: g.repo, token: await decifrar(k0, g.token) };
        await criarSenha(nova);
      },
      bloquear,
      esquecerAparelho: async () => {
        await apagarTudo();
        chaveRef.current = null;
        githubRef.current = null;
        dadosRef.current = null;
        setChave(null);
        setAcesso(null);
        setGhLocal(null);
        setDados(null);
        setPedido(null);
        setSync({ estado: 'local', em: null, erro: null });
      },

      alterar,
      substituir: (d, mensagem) => {
        if (!chaveRef.current) return void desbloquear().then((ok) => ok && aplicar(structuredClone(d), mensagem));
        aplicar(structuredClone(d), mensagem);
      },

      conectar: async (cfg, senha, redefinir) => {
        const { privado } = await gh.verificar(cfg);
        const remoto = await gh.lerJson<Acesso>(cfg, ARQ_ACESSO);
        const daqui = local.acesso();
        let a: Acesso;
        let k: CryptoKey;
        if (redefinir) {
          ({ acesso: a, chave: k } = await criarAcesso(senha));
        } else if (remoto) {
          const kr = await conferir(senha, remoto.dados);
          if (!kr) throw new Error('A senha não é a mesma usada neste repositório. Se esqueceu, marque “Esqueci a senha”.');
          a = remoto.dados;
          k = kr;
        } else if (daqui) {
          const kl = await conferir(senha, daqui);
          if (!kl) throw new Error('A senha não confere com a deste aparelho.');
          a = daqui;
          k = kl;
        } else {
          ({ acesso: a, chave: k } = await criarAcesso(senha));
        }
        if (redefinir || !remoto) await gh.gravarJson(cfg, ARQ_ACESSO, a, redefinir ? 'Senha do app redefinida' : 'Senha do app definida', remoto?.sha ?? null);

        const g: GithubLocal = { dono: cfg.dono, repo: cfg.repo, token: await cifrar(k, cfg.token) };
        local.salvarAcesso(a);
        local.salvarGithub(g);
        setAcesso(a);
        setGhLocal(g);
        githubRef.current = cfg;
        chaveRef.current = k;
        setChave(k);
        await lembrarChave(k);
        shaRef.current = null;

        const dadosRemotos = await gh.lerJson<Dados>(cfg, gh.ARQ_DADOS);
        const atual = dadosRef.current;
        let resultado: string;
        if (dadosRemotos && (!atual || dadosRemotos.dados.atualizadoEm >= atual.atualizadoEm)) {
          shaRef.current = dadosRemotos.sha;
          dadosRef.current = dadosRemotos.dados;
          setDados(dadosRemotos.dados);
          local.salvarDados(dadosRemotos.dados);
          local.salvarPendente([]);
          resultado = 'Dados carregados do GitHub.';
        } else if (atual) {
          shaRef.current = dadosRemotos?.sha ?? null;
          local.salvarPendente(['Dados enviados deste aparelho']);
          await enviar();
          resultado = 'Dados deste aparelho enviados para o GitHub.';
        } else {
          resultado = 'Conectado. Importe a planilha para começar.';
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
        setGhLocal(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, pronto, sync, ghLocal, tema, acesso, chave, pedido, alterar, aplicar, enviar, abrirCom, bloquear, desbloquear, criarSenha],
  );

  return <Ctx.Provider value={loja}>{children}</Ctx.Provider>;
}
