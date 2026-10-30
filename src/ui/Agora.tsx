import { useEffect, useState } from 'react';
import { useDados, useLoja } from '../data/store';
import type { Dados, Tarefa } from '../data/model';
import { atrasada, chaveBloco, fmtMin, fmtRelogio, hoje, nomeDisciplina, ordenadas, pct, planoDeHoje, rotulo, somarDias, tarefa, diaCurto, dataCurta } from '../data/logica';
import { Shell } from './Shell';
import { ir, link } from './rota';

export function decorrido(d: Dados): number {
  const s = d.sessao;
  if (!s) return 0;
  return s.acumuladoMs + (s.rodandoDesde ? Date.now() - s.rodandoDesde : 0);
}

export function comecar(alterar: ReturnType<typeof useLoja>['alterar'], t: Tarefa) {
  alterar(`${rotulo(t)} iniciada`, (d) => {
    d.sessao = { tarefaKey: t.key, acumuladoMs: 0, rodandoDesde: Date.now() };
  });
  ir('');
}

export function Agora() {
  const d = useDados();
  const t = d.sessao ? tarefa(d, d.sessao.tarefaKey) : undefined;
  return t ? <Sessao t={t} /> : <Inicio />;
}

function Trilho({ d, atual }: { d: Dados; atual: Tarefa }) {
  const daTrilha = ordenadas(d).filter((t) => t.trilha === atual.trilha);
  return (
    <div className="trilho" aria-hidden="true">
      {daTrilha.map((t) => (
        <i key={t.key} className={t.key === atual.key ? 'agora' : t.feita ? 'feito' : ''} />
      ))}
    </div>
  );
}

function Inicio() {
  const d = useDados();
  const { alterar } = useLoja();
  const plano = planoDeHoje(d);
  const planejada = plano.find((t) => !t.feita);
  const proxima = planejada ?? ordenadas(d).find((t) => !t.feita);
  const atrasadas = d.tarefas.filter((t) => atrasada(t)).length;
  const minutos = plano.reduce((s, t) => s + (t.feita ? t.chEfetivaMin ?? t.chMin : t.chMin), 0);
  const ontem = somarDias(hoje(), -1);
  const deOntem = d.tarefas.filter((t) => t.feita && t.data === ontem);
  const qOntem = deOntem.reduce((s, t) => s + (t.questoes ?? 0), 0);
  const aOntem = deOntem.reduce((s, t) => s + (t.acertos ?? 0), 0);
  const daTrilha = proxima ? d.tarefas.filter((t) => t.trilha === proxima.trilha) : [];

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && proxima && !(e.target instanceof HTMLInputElement)) comecar(alterar, proxima);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [proxima, alterar]);

  return (
    <Shell secao="agora" noite>
      <div className="tela-agora">
        <div className="miolo">
          <span className="rotulo">
            {diaCurto(hoje())} {dataCurta(hoje())} · {plano.length ? `${plano.length} ${plano.length === 1 ? 'tarefa planejada' : 'tarefas planejadas'} · ${fmtMin(minutos)}` : 'nada planejado'}
          </span>
          {proxima ? (
            <main style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1000 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 20, color: 'var(--muted)' }}>
                  {planejada ? 'A próxima é' : plano.length ? 'O que você planejou para hoje está feito. Pela ordem da trilha, a próxima é' : 'Nada planejado para hoje. Pela ordem da trilha, a próxima é'}
                </span>
                <h1 style={{ fontSize: 64, lineHeight: 1 }}>{nomeDisciplina(d, proxima)}</h1>
                <p style={{ margin: 0, fontSize: 20, lineHeight: 1.45, color: 'var(--text2)', maxWidth: 760, textWrap: 'pretty' }}>{proxima.descricao}</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <button type="button" className="btn btn-mark" onClick={() => comecar(alterar, proxima)}>
                  Começar <span className="tecla">ENTER</span>
                </button>
                {!planejada && <a className="btn btn-linha" href={link('semana')}>Planejar a semana</a>}
                <a className="btn btn-texto" href={link('ciclo')}>Escolher outra tarefa</a>
              </div>
            </main>
          ) : (
            <main style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
              <h1 style={{ fontSize: 56, lineHeight: 1 }}>Ciclo em dia.</h1>
              <p style={{ margin: 0, fontSize: 18, color: 'var(--text2)' }}>Todas as tarefas das trilhas foram feitas. Quando sair a trilha da semana, importe a planilha nova.</p>
              <a className="btn btn-mark" href={link('nova-trilha')} style={{ alignSelf: 'flex-start' }}>Nova trilha da semana</a>
            </main>
          )}

          {plano.length > 0 && (
            <section aria-label="Plano do dia" className="plano-dia" style={{ ['--cols' as string]: Math.min(plano.length, 4) }}>
              {plano.slice(0, 4).map((t) => (
                <div key={chaveBloco(t)} style={{ borderTop: `3px solid ${t === proxima ? 'var(--mark)' : t.feita ? 'var(--ink)' : '#2E2C28'}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="rotulo">{!t.feita && t.hora ? `${t.hora} · ` : ''}{rotulo(t)}{t.parte ? ` (parte ${t.parte.i + 1}/${t.parte.n})` : ''} · {fmtMin(t.feita ? t.chEfetivaMin ?? t.chMin : t.chMin)}{t.feita ? ' · feita' : ''}</span>
                  <span style={{ fontSize: 15, color: t === proxima ? 'var(--ink)' : 'var(--text2)' }}>{nomeDisciplina(d, t)}</span>
                </div>
              ))}
            </section>
          )}

          <footer style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {proxima && <Trilho d={d} atual={proxima} />}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 32px', fontSize: 14, color: 'var(--muted)' }}>
              {proxima && <span style={{ color: 'var(--ink)' }}>Trilha {proxima.trilha} · {daTrilha.filter((t) => t.feita).length} de {daTrilha.length}</span>}
              {atrasadas > 0 && <a href={link('semana')} style={{ color: 'var(--ink)' }}>{atrasadas} {atrasadas === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} na Semana</a>}
              {deOntem.length > 0 && (
                <span>
                  Ontem: {deOntem.length} {deOntem.length === 1 ? 'tarefa' : 'tarefas'}, {fmtMin(deOntem.reduce((s, t) => s + (t.chEfetivaMin ?? 0), 0))}
                  {qOntem > 0 ? `, ${pct(aOntem, qOntem)}% em ${qOntem} questões` : ''}
                </span>
              )}
            </div>
          </footer>
        </div>
      </div>
    </Shell>
  );
}

function Sessao({ t }: { t: Tarefa }) {
  const d = useDados();
  const { alterar } = useLoja();
  const [, tic] = useState(0);
  const [nota, setNota] = useState('');
  const rodando = !!d.sessao?.rodandoDesde;
  const ms = decorrido(d);
  const notasDaTrilha = d.notas.filter((n) => tarefa(d, n.tarefaKey)?.trilha === t.trilha).length;

  useEffect(() => {
    const i = window.setInterval(() => tic((x) => x + 1), 1000);
    return () => window.clearInterval(i);
  }, []);

  const alternar = () =>
    alterar(rodando ? `${rotulo(t)} pausada` : `${rotulo(t)} retomada`, (x) => {
      const s = x.sessao!;
      if (s.rodandoDesde) {
        s.acumuladoMs += Date.now() - s.rodandoDesde;
        s.rodandoDesde = null;
      } else s.rodandoDesde = Date.now();
    });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        alternar();
      } else if (e.key === 'Enter') ir('registro/' + t.key);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const anotar = () => {
    const texto = nota.trim();
    if (!texto) return;
    alterar(`Anotação em ${rotulo(t)}`, (x) => {
      x.notas.push({ tarefaKey: t.key, texto, em: new Date().toISOString() });
    });
    setNota('');
  };

  const cancelar = () => {
    if (!confirm('Descartar esta sessão? O tempo marcado não será registrado.')) return;
    alterar(`${rotulo(t)}: sessão descartada`, (x) => {
      x.sessao = null;
    });
  };

  return (
    <Shell secao="agora" noite semTopo>
      <div className="tela-agora">
        <div className="barra-topo"><i style={{ width: `${Math.min((ms / 60000 / t.chMin) * 100, 100)}%` }} /></div>
        <div className="miolo" style={{ paddingTop: 24 }}>
          <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 32px' }}>
            <span className="rotulo" style={{ color: 'var(--mark)' }}>{rotulo(t)} · {nomeDisciplina(d, t)} · Trilha {t.trilha}</span>
            <span className="rotulo" style={{ marginLeft: 'auto' }}>ESPAÇO pausar · ENTER concluir</span>
          </header>
          <main style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1060 }}>
            <h1 style={{ fontSize: 40, lineHeight: 1.12, textWrap: 'balance' }}>{t.descricao}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px 28px' }}>
              <span className="relogio grande" style={{ fontSize: 168, color: rodando ? 'var(--ink)' : '#6E6A61' }}>{fmtRelogio(ms)}</span>
              <span className="mono" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <span>proposta {fmtRelogio(t.chMin * 60000)}</span>
                <span>{rodando ? 'contando' : 'pausado'}</span>
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" className="btn btn-mark" style={{ minWidth: 160 }} onClick={alternar}>{rodando ? 'Pausar' : 'Retomar'}</button>
              <a className="btn btn-linha" href={link('registro/' + t.key)}>Concluir</a>
              <button type="button" className="btn btn-texto" onClick={cancelar}>Descartar sessão</button>
            </div>
          </main>
          <section style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 1060 }}>
            <label htmlFor="nota" className="rotulo">Anotar para o “limpe os erros”</label>
            <input
              id="nota"
              className="campo campo-largo"
              placeholder="Ex.: confundi jurisdição aduaneira com zona secundária"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && anotar()}
            />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{notasDaTrilha} {notasDaTrilha === 1 ? 'anotação' : 'anotações'} nesta trilha · Enter para salvar</span>
          </section>
        </div>
      </div>
    </Shell>
  );
}
