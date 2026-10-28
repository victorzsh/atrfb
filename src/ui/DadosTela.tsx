import { useEffect, useState } from 'react';
import { useLoja } from '../data/store';
import type { Dados } from '../data/model';
import type { Versao } from '../data/github';
import { fmtMin, lerMin } from '../data/logica';
import { exportarPlanilha } from '../xlsx/planilha';
import { Shell } from './Shell';
import { link } from './rota';

function baixar(nome: string, conteudo: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function quando(iso: string): string {
  const d = new Date(iso);
  const hojeStr = new Date().toDateString();
  const ontem = new Date(Date.now() - 86400000).toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hojeStr) return `hoje ${hora}`;
  if (d.toDateString() === ontem) return `ontem ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="lista-linha" style={{ gridTemplateColumns: '140px minmax(0, 1fr)', fontSize: 15, padding: '6px 0' }}>
      <span className="muted">{rotulo}</span>
      <span>{children}</span>
    </div>
  );
}

function Conectar() {
  const { conectar } = useLoja();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(repo.trim());
    if (!m) return setMsg({ ok: false, txt: 'Use o formato usuario/repositorio.' });
    setOcupado(true);
    setMsg(null);
    try {
      setMsg({ ok: true, txt: await conectar({ dono: m[1], repo: m[2], token: token.trim() }) });
      setToken('');
    } catch (err) {
      setMsg({ ok: false, txt: err instanceof Error ? err.message : String(err) });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 18, borderTop: '2px solid var(--ink)', paddingTop: 18 }}>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.6, color: 'var(--text2)' }}>
        <li>No GitHub, crie um repositório <strong>privado</strong> e vazio (ex.: <span className="mono" style={{ fontSize: 13 }}>atrfb-dados</span>).</li>
        <li>
          Crie um <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">token de acesso “fine-grained”</a> só
          para esse repositório, com a permissão <strong>Contents: Read and write</strong>.
        </li>
        <li>Cole os dois aqui. O token fica guardado só neste navegador.</li>
      </ol>
      <label className="campo-rotulo">
        REPOSITÓRIO
        <input className="campo" placeholder="seu-usuario/atrfb-dados" value={repo} onChange={(e) => setRepo(e.target.value)} required autoComplete="off" />
      </label>
      <label className="campo-rotulo">
        TOKEN
        <input className="campo" type="password" placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" />
      </label>
      <button type="submit" className="btn btn-ink" disabled={ocupado} style={{ alignSelf: 'flex-start' }}>{ocupado ? 'Conectando…' : 'Conectar'}</button>
      {msg && <p className={msg.ok ? 'ok-txt' : 'erro-txt'} style={{ margin: 0 }}>{msg.txt}</p>}
    </form>
  );
}

export function DadosTela() {
  const loja = useLoja();
  const { dados, github, sync } = loja;
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; txt: string } | null>(null);
  const [meta, setMeta] = useState(dados ? fmtMin(dados.minutosPorDia) : '4h30');

  useEffect(() => {
    if (!github) return setVersoes(null);
    loja.versoes().then(setVersoes, () => setVersoes([]));
    // Recarrega a lista quando um salvamento termina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [github, sync.em]);

  const exportarXlsx = async () => {
    if (!dados) return;
    setAviso(null);
    try {
      const original = await loja.planilha();
      if (!original) return setAviso({ ok: false, txt: 'Não achei a planilha original. Importe o .xlsx da Estratégia em Ciclo › Nova trilha.' });
      const bytes = await exportarPlanilha(original, dados.disciplinas, dados.tarefas);
      baixar(`ATRFB_Planilha_${new Date().toISOString().slice(0, 10)}.xlsx`, bytes as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e) {
      setAviso({ ok: false, txt: e instanceof Error ? e.message : String(e) });
    }
  };

  const importarJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const d = JSON.parse(await f.text()) as Dados;
      if (d.versao !== 1 || !Array.isArray(d.tarefas) || !Array.isArray(d.disciplinas)) throw new Error('Este .json não é um backup do app.');
      if (!confirm('Substituir os dados atuais por este backup? A versão atual continua no histórico do GitHub.')) return;
      loja.substituir(d, `Backup importado: ${f.name}`);
      setAviso({ ok: true, txt: 'Backup importado.' });
    } catch (e) {
      setAviso({ ok: false, txt: e instanceof Error ? e.message : String(e) });
    }
  };

  const restaurar = async (v: Versao) => {
    if (!confirm(`Voltar os dados para a versão de ${quando(v.data)}? A versão atual continua no histórico.`)) return;
    try {
      await loja.restaurar(v);
      setAviso({ ok: true, txt: 'Versão restaurada.' });
    } catch (e) {
      setAviso({ ok: false, txt: e instanceof Error ? e.message : String(e) });
    }
  };

  const estado = github
    ? { local: 'Só neste aparelho', carregando: 'Carregando…', salvando: 'Salvando…', salvo: sync.em ? `Salvo às ${new Date(sync.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Salvo', erro: `Erro: ${sync.erro}` }[sync.estado]
    : 'Só neste aparelho';

  return (
    <Shell secao="dados">
      <div className="miolo">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '48px 72px', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h1 className="titulo">Seus dados</h1>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, color: 'var(--text2)', maxWidth: 540 }}>
                Tudo fica num arquivo dentro de um repositório privado seu no GitHub. Cada salvamento vira uma versão, e qualquer uma pode ser restaurada.
              </p>
            </section>

            {github ? (
              <section style={{ display: 'flex', flexDirection: 'column', borderTop: '2px solid var(--ink)' }}>
                <Linha rotulo="Repositório"><span className="mono" style={{ fontSize: 13 }}>{github.dono}/{github.repo}</span></Linha>
                <Linha rotulo="Arquivos"><span className="mono" style={{ fontSize: 13 }}>dados.json · planilha.xlsx</span></Linha>
                <Linha rotulo="Estado"><span className={sync.estado === 'erro' ? 'erro-txt' : ''}>{estado}</span></Linha>
                <div style={{ display: 'flex', gap: 10, paddingTop: 14 }}>
                  <button type="button" className="btn btn-linha btn-peq" onClick={() => void loja.salvarAgora()}>Salvar agora</button>
                  <button
                    type="button"
                    className="btn btn-texto btn-peq"
                    onClick={() => confirm('Desconectar este aparelho do GitHub? Os dados continuam lá e aqui.') && loja.desconectar()}
                  >
                    Desconectar
                  </button>
                </div>
              </section>
            ) : (
              <Conectar />
            )}

            {dados && (
              <>
                <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label className="campo-rotulo" style={{ maxWidth: 280 }}>
                    META DIÁRIA
                    <input
                      className="campo"
                      value={meta}
                      onChange={(e) => setMeta(e.target.value)}
                      onBlur={() => {
                        const m = lerMin(meta);
                        if (m && m !== dados.minutosPorDia) loja.alterar(`Meta diária: ${fmtMin(m)}`, (x) => { x.minutosPorDia = m; });
                        setMeta(fmtMin(m ?? dados.minutosPorDia));
                      }}
                    />
                  </label>
                  <span className="muted" style={{ fontSize: 13 }}>Usada para montar o dia no Agora e a previsão da Semana.</span>
                </section>

                <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="rotulo">Levar para fora</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button type="button" className="btn btn-ink" onClick={() => void exportarXlsx()}>Baixar .xlsx no formato da Estratégia</button>
                    <button type="button" className="btn btn-linha" onClick={() => baixar(`atrfb-dados-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados, null, 1), 'application/json')}>
                      Baixar .json
                    </button>
                    <label className="btn btn-texto" style={{ cursor: 'pointer' }}>
                      Importar backup .json
                      <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => void importarJson(e.target.files?.[0])} />
                    </label>
                  </div>
                  <span className="muted" style={{ fontSize: 13, maxWidth: 560, lineHeight: 1.45 }}>
                    O .xlsx sai com as abas MAPA e CICLO preenchidas (T+R, questões e acertos por aula; data, CH efetiva, questões e acertos por tarefa), por cima da planilha original.
                  </span>
                  {aviso && <p className={aviso.ok ? 'ok-txt' : 'erro-txt'} style={{ margin: 0 }}>{aviso.txt}</p>}
                </section>
                <a href={link('analytics')} className="muted" style={{ fontSize: 14 }}>Abrir Analytics</a>
              </>
            )}
          </div>

          {github && (
            <section aria-label="Versões salvas" style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column' }}>
              <div className="rotulo" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '2px solid var(--ink)', color: 'var(--ink)' }}>
                <span>Versões</span>
                <span className="muted">últimas {versoes?.length ?? 0}</span>
              </div>
              {versoes === null && <span className="muted" style={{ padding: '14px 0' }}>Carregando…</span>}
              {versoes?.map((v, i) => (
                <div key={v.sha} className="lista-linha" style={{ gridTemplateColumns: '96px minmax(0, 1fr) auto', minHeight: 48 }}>
                  <span className="mono muted" style={{ fontSize: 12 }}>{quando(v.data)}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.mensagem.split('\n')[0]}</span>
                  {i === 0 ? <span className="mono muted" style={{ fontSize: 11 }}>atual</span> : (
                    <button type="button" className="btn-texto" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'underline' }} onClick={() => void restaurar(v)}>Restaurar</button>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </Shell>
  );
}
