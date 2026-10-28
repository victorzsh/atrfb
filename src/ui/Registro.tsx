import { useState } from 'react';
import { useDados, useLoja } from '../data/store';
import { disciplinaDaTarefa, ehRevisao, fmtMin, hoje, lerMin, nomeDisciplina, pct, planoDeHoje, proximaAula, rotulo, tarefa, ordenadas } from '../data/logica';
import { decorrido } from './Agora';
import { Shell } from './Shell';
import { ir, link } from './rota';

export function Registro({ tarefaKey }: { tarefaKey: string }) {
  const d = useDados();
  const { alterar } = useLoja();
  const t = tarefa(d, tarefaKey);
  const daSessao = d.sessao?.tarefaKey === tarefaKey;
  const disc = t ? disciplinaDaTarefa(d, t) : undefined;

  const [tempo, setTempo] = useState(() =>
    fmtMin(daSessao ? Math.max(1, Math.round(decorrido(d) / 60000)) : t?.chEfetivaMin ?? t?.chMin ?? 90),
  );
  const [data, setData] = useState(t?.data ?? hoje());
  const [q, setQ] = useState(t?.questoes ?? 0);
  const [a, setA] = useState(t?.acertos ?? 0);
  const proxAula = disc ? proximaAula(disc) : null;
  const [marcar, setMarcar] = useState(!!t && !t.feita && ehRevisao(t) && proxAula !== null);
  const [aula, setAula] = useState<number | null>(proxAula ?? disc?.aulas[0]?.n ?? null);

  if (!t) {
    return (
      <Shell secao="agora" noite>
        <div className="miolo"><p>Tarefa não encontrada. <a href={link('')}>Voltar</a></p></div>
      </Shell>
    );
  }

  const minutos = lerMin(tempo);
  const p = pct(a, q);
  const proposta = t.chMin;
  const seguinte = ordenadas(d).find((x) => !x.feita && x.key !== t.key);
  const continuarHoje = seguinte && planoDeHoje(d).some((x) => x.key === seguinte.key);

  const salvar = (depois: 'seguir' | 'parar') => {
    if (minutos === null) return;
    const resumo = q > 0 ? ` · ${q} questões, ${a} acertos` : '';
    alterar(`${rotulo(t)} concluída · ${fmtMin(minutos)}${resumo}`, (x) => {
      const tt = x.tarefas.find((y) => y.key === t.key)!;
      Object.assign(tt, { feita: true, data, chEfetivaMin: minutos, questoes: q > 0 ? q : null, acertos: q > 0 ? a : null });
      if (x.sessao?.tarefaKey === t.key) x.sessao = null;
      if (marcar && disc && aula !== null) {
        const au = x.disciplinas.find((y) => y.key === disc.key)?.aulas.find((y) => y.n === aula);
        if (au) {
          au.tr = true;
          if (q > 0) {
            au.qtd = (au.qtd ?? 0) + q;
            au.acertos = (au.acertos ?? 0) + a;
          }
        }
      }
      if (depois === 'seguir' && seguinte) x.sessao = { tarefaKey: seguinte.key, acumuladoMs: 0, rodandoDesde: Date.now() };
    });
    ir('');
  };

  const desfazer = () =>
    alterar(`${rotulo(t)} marcada como não feita`, (x) => {
      Object.assign(x.tarefas.find((y) => y.key === t.key)!, { feita: false, data: null, chEfetivaMin: null, questoes: null, acertos: null });
    });

  const passo = (set: (n: number) => void, v: number, dv: number, max?: number) => () => set(Math.max(0, Math.min(max ?? Infinity, v + dv)));

  return (
    <Shell secao="agora" noite semTopo>
      <div className="tela-agora">
        <div className="miolo">
          <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <span className="rotulo">{rotulo(t)} · {nomeDisciplina(d, t)} · {t.feita ? 'editar registro' : daSessao ? 'concluída' : 'registrar'}</span>
            <a className="btn btn-texto btn-peq" style={{ marginLeft: 'auto' }} href={link(daSessao ? '' : 'ciclo')}>Voltar</a>
          </header>

          <main style={{ display: 'flex', flexWrap: 'wrap', gap: '48px 96px', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 440px', display: 'flex', flexDirection: 'column', gap: 36, maxWidth: 620 }}>
              <h1 style={{ fontSize: 44, lineHeight: 1.05 }}>Como foi?</h1>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 32 }}>
                <label className="campo-rotulo">
                  TEMPO EFETIVO
                  <input className="campo" style={{ fontSize: 32, height: 52, fontWeight: 300 }} value={tempo} onChange={(e) => setTempo(e.target.value)} aria-invalid={minutos === null} />
                  <span style={{ letterSpacing: 0 }}>
                    {minutos === null ? 'use 1h45, 1:45 ou 105' : minutos > proposta ? `+${minutos - proposta} min da proposta` : minutos < proposta ? `${proposta - minutos} min a menos que a proposta` : 'igual à proposta'}
                  </span>
                </label>
                <label className="campo-rotulo">
                  DATA
                  <input type="date" className="campo" style={{ fontSize: 18, height: 52 }} value={data} onChange={(e) => setData(e.target.value || hoje())} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 32 }}>
                {([['QUESTÕES FEITAS', q, (n: number) => { setQ(n); if (a > n) setA(n); }, undefined], ['ACERTOS', a, setA, q]] as const).map(([nome, v, set, max]) => (
                  <div key={nome} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="rotulo">{nome}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button type="button" className="passo" aria-label={`Menos ${nome.toLowerCase()}`} onClick={passo(set, v, -1, max)}>−</button>
                      <input
                        className="campo mono"
                        style={{ width: 80, fontSize: 36, height: 52, textAlign: 'center', fontWeight: 300 }}
                        inputMode="numeric"
                        aria-label={nome}
                        value={v}
                        onChange={(e) => set(Math.max(0, Math.min(max ?? Infinity, Number(e.target.value.replace(/\D/g, '')) || 0)))}
                      />
                      <button type="button" className="passo" aria-label={`Mais ${nome.toLowerCase()}`} onClick={passo(set, v, 1, max)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 520 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="relogio grande" style={{ fontSize: 152, color: q > 0 && p >= 70 ? 'var(--mark)' : q > 0 ? 'var(--ink)' : '#3A3833' }}>{q > 0 ? `${p}%` : '—'}</span>
                <span style={{ fontSize: 15, color: 'var(--muted)' }}>{q > 0 ? 'de acerto' : 'sem questões nesta tarefa'}</span>
              </div>
              {disc && (
                <div style={{ borderTop: '1px solid #2E2C28', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 16, lineHeight: 1.4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={marcar} onChange={(e) => setMarcar(e.target.checked)} style={{ width: 20, height: 20, margin: '2px 0 0', accentColor: 'var(--mark)' }} />
                    <span>
                      Marcar a aula{' '}
                      <select
                        value={aula ?? ''}
                        onChange={(e) => setAula(Number(e.target.value))}
                        style={{ background: 'transparent', border: 0, borderBottom: '1px solid var(--line)', fontFamily: 'var(--mono)' }}
                        aria-label="Aula"
                      >
                        {disc.aulas.map((x) => (
                          <option key={x.n} value={x.n} style={{ color: '#111' }}>{String(x.n).padStart(2, '0')}{x.tr ? ' (já feita)' : ''}</option>
                        ))}
                      </select>{' '}
                      de {disc.nome} como teoria + revisão no Mapa{q > 0 ? ', somando as questões a ela' : ''}
                    </span>
                  </label>
                  <div aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 32 }}>
                    {disc.aulas.map((x) => (
                      <span key={x.n} style={{ width: 16, height: 16, background: x.tr ? 'var(--done)' : marcar && x.n === aula ? 'var(--mark)' : 'transparent', border: `1px solid ${x.tr ? 'var(--done)' : marcar && x.n === aula ? 'var(--mark)' : '#3A3833'}` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>

          <footer style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {seguinte && continuarHoje && !t.feita ? (
              <>
                <button type="button" className="btn btn-mark" disabled={minutos === null} onClick={() => salvar('seguir')}>
                  Salvar e seguir para {nomeDisciplina(d, seguinte)}
                </button>
                <button type="button" className="btn btn-texto" disabled={minutos === null} onClick={() => salvar('parar')}>Salvar e parar por hoje</button>
              </>
            ) : (
              <button type="button" className="btn btn-mark" disabled={minutos === null} onClick={() => salvar('parar')}>Salvar</button>
            )}
            {t.feita && <button type="button" className="btn btn-texto" onClick={desfazer}>Marcar como não feita</button>}
          </footer>
        </div>
      </div>
    </Shell>
  );
}
