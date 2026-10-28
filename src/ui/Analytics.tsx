import { useState } from 'react';
import { useDados } from '../data/store';
import { contagemMapa, dataCurta, deIso, fmtMin, hoje, nomeDisciplina, pct, segundaDaSemana, somarDias } from '../data/logica';
import { Shell } from './Shell';

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export function Analytics() {
  const d = useDados();
  const [janela, setJanela] = useState<4 | 8 | 0>(8);
  const h = hoje();
  const feitas = d.tarefas.filter((t) => t.feita && t.data);

  // Semanas com estudo, da primeira até a atual.
  const primeira = feitas.reduce((m, t) => (t.data! < m ? t.data! : m), h);
  const todasSemanas: string[] = [];
  for (let s = segundaDaSemana(primeira); s <= h; s = somarDias(s, 7)) todasSemanas.push(s);
  const semanas = janela ? todasSemanas.slice(-janela) : todasSemanas;
  const desde = semanas[0];
  const naJanela = feitas.filter((t) => t.data! >= desde);

  const porSemana = semanas.map((s) => {
    const ts = feitas.filter((t) => t.data! >= s && t.data! < somarDias(s, 7));
    const min = ts.reduce((x, t) => x + (t.chEfetivaMin ?? 0), 0);
    const q = ts.reduce((x, t) => x + (t.questoes ?? 0), 0);
    const a = ts.reduce((x, t) => x + (t.acertos ?? 0), 0);
    return { s, min, q, a };
  });
  const metaSemana = d.minutosPorDia * 7;
  const maxMin = Math.max(metaSemana * 1.2, ...porSemana.map((x) => x.min));

  const minTotal = naJanela.reduce((x, t) => x + (t.chEfetivaMin ?? 0), 0);
  const qTotal = naJanela.reduce((x, t) => x + (t.questoes ?? 0), 0);
  const aTotal = naJanela.reduce((x, t) => x + (t.acertos ?? 0), 0);
  const { feitas: aulasFeitas, total: aulasTotal } = contagemMapa(d);

  // Dias seguidos estudando, contando de hoje (ou ontem, se hoje ainda não teve estudo).
  const comEstudo = new Set(feitas.map((t) => t.data!));
  let seq = 0;
  for (let x = comEstudo.has(h) ? h : somarDias(h, -1); comEstudo.has(x); x = somarDias(x, -1)) seq++;

  // Acerto por disciplina, do pior para o melhor.
  const porDisc = new Map<string, { q: number; a: number }>();
  for (const t of naJanela) {
    if (!t.questoes) continue;
    const n = nomeDisciplina(d, t);
    const v = porDisc.get(n) ?? { q: 0, a: 0 };
    v.q += t.questoes;
    v.a += t.acertos ?? 0;
    porDisc.set(n, v);
  }
  const discs = [...porDisc.entries()].map(([nome, v]) => ({ nome, ...v, p: pct(v.a, v.q) })).sort((x, y) => x.p - y.p);

  const comQuestoes = porSemana.filter((x) => x.q > 0);
  const y = (p: number) => 220 - ((p - 30) / 70) * 220;

  // Constância: 12 semanas, um quadrado por dia.
  const minPorDia = new Map<string, number>();
  for (const t of feitas) minPorDia.set(t.data!, (minPorDia.get(t.data!) ?? 0) + (t.chEfetivaMin ?? 0));
  const ini = somarDias(segundaDaSemana(h), -77);
  const nivel = (m: number) => (m <= 0 ? 0 : m < 120 ? 1 : m < 240 ? 2 : 3);
  const cores = ['transparent', 'var(--mark-1)', 'var(--mark-2)', 'var(--mark)'];

  return (
    <Shell secao="analytics">
      <div className="miolo" style={{ gap: 40 }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <h1 className="titulo" style={{ fontSize: 44 }}>Analytics</h1>
          <div className="grupo-seg mono" role="group" aria-label="Período" style={{ marginLeft: 'auto' }}>
            {([[4, '4 SEM'], [8, '8 SEM'], [0, 'TUDO']] as const).map(([k, r]) => (
              <button key={k} type="button" className={janela === k ? 'on' : ''} onClick={() => setJanela(k)}>{r}</button>
            ))}
          </div>
        </header>

        <section className="resumo" aria-label="Resumo">
          <div><strong>{fmtMin(minTotal).replace(/h00$/, 'h')}</strong><span>estudadas {janela ? `em ${semanas.length} ${semanas.length === 1 ? 'semana' : 'semanas'}` : 'no total'}</span></div>
          <div><strong>{qTotal ? pct(aTotal, qTotal) : '—'}<small>{qTotal ? '%' : ''}</small></strong><span>{qTotal ? `de acerto em ${qTotal} questões` : 'nenhuma questão registrada'}</span></div>
          <div><strong>{aulasFeitas}<small>/{aulasTotal}</small></strong><span>aulas com teoria + revisão</span></div>
          <div><strong>{seq}<small> {seq === 1 ? 'dia' : 'dias'}</small></strong><span>seguidos estudando</span></div>
        </section>

        {feitas.length === 0 ? (
          <div className="vazio">Os gráficos aparecem quando você registrar as primeiras tarefas (data e tempo efetivo). Tudo aqui sai do que você registra no Agora ou no Ciclo.</div>
        ) : (
          <div className="duas">
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
                <h2 className="sub">Horas por semana</h2>
                <span className="muted" style={{ fontSize: 13 }}>meta de {fmtMin(metaSemana)} tracejada; amarelo bateu a meta</span>
              </div>
              <div className="grafico-barras">
                <div className="meta-linha" style={{ bottom: `${(metaSemana / maxMin) * 100}%` }} />
                {porSemana.map((x) => (
                  <div
                    key={x.s}
                    className="barra"
                    title={`Semana de ${dataCurta(x.s)}: ${fmtMin(x.min)}`}
                    style={{ height: `${(x.min / maxMin) * 100}%`, background: x.min >= metaSemana ? 'var(--mark)' : 'var(--chart)' }}
                  />
                ))}
              </div>
              <div className="eixo">{porSemana.map((x) => <span key={x.s}>{dataCurta(x.s)}</span>)}</div>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
                <h2 className="sub">Acerto ao longo do tempo</h2>
                <span className="muted" style={{ fontSize: 13 }}>média de cada semana; linha de 70%</span>
              </div>
              {comQuestoes.length === 0 ? (
                <div className="vazio">Sem questões registradas neste período.</div>
              ) : (
                <>
                  <div style={{ position: 'relative', height: 220, borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}>
                    <svg viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label="Acerto semanal" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                      <line x1="0" x2="600" y1={y(70)} y2={y(70)} stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                      {comQuestoes.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          strokeLinejoin="round"
                          points={comQuestoes.map((x) => `${(porSemana.indexOf(x) / Math.max(porSemana.length - 1, 1)) * 600},${y(Math.max(30, pct(x.a, x.q)))}`).join(' ')}
                        />
                      )}
                    </svg>
                    {comQuestoes.map((x) => {
                      const p = pct(x.a, x.q);
                      return (
                        <span
                          key={x.s}
                          className="ponto"
                          title={`Semana de ${dataCurta(x.s)}: ${p}% em ${x.q} questões`}
                          style={{ left: `${(porSemana.indexOf(x) / Math.max(porSemana.length - 1, 1)) * 100}%`, top: `${(y(Math.max(30, p)) / 220) * 100}%`, background: p >= 70 ? 'var(--mark)' : 'var(--chart)' }}
                        />
                      );
                    })}
                  </div>
                  <div className="eixo" style={{ justifyContent: 'space-between' }}>{porSemana.map((x) => <span key={x.s} style={{ flex: 'none' }}>{dataCurta(x.s)}</span>)}</div>
                </>
              )}
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
                <h2 className="sub">Acerto por disciplina</h2>
                <span className="muted" style={{ fontSize: 13 }}>do pior para o melhor</span>
              </div>
              {discs.length === 0 && <div className="vazio">Sem questões registradas neste período.</div>}
              {discs.map((x) => (
                <div key={x.nome} className="hit" title={`${x.nome}: ${x.p}% em ${x.q} questões`} style={{ display: 'grid', gridTemplateColumns: '190px minmax(0, 1fr) 44px 60px', gap: 12, alignItems: 'center', minHeight: 26 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.nome}</span>
                  <span style={{ position: 'relative', height: 12 }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${x.p}%`, background: x.p >= 70 ? 'var(--mark)' : 'var(--chart)', borderRadius: '0 4px 4px 0' }} />
                    <span style={{ position: 'absolute', left: '70%', top: -6, bottom: -6, borderLeft: '1px dashed var(--ink)' }} />
                  </span>
                  <span className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{x.p}%</span>
                  <span className="mono muted" style={{ textAlign: 'right', fontSize: 11 }}>{x.q} q</span>
                </div>
              ))}
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12 }}>
                <h2 className="sub">Constância</h2>
                <span className="muted" style={{ fontSize: 13 }}>um quadrado por dia, últimas 12 semanas</span>
              </div>
              <div className="calor">
                {DIAS.map((nome, r) => [
                  <span key={nome}>{nome}</span>,
                  ...Array.from({ length: 12 }, (_, w) => {
                    const dia = somarDias(ini, w * 7 + r);
                    const m = minPorDia.get(dia) ?? 0;
                    const n = nivel(m);
                    const futuro = dia > h;
                    return (
                      <span
                        key={dia}
                        className={futuro ? '' : 'hit'}
                        title={futuro ? undefined : `${dataCurta(dia)} ${deIso(dia).getFullYear()}: ${m ? fmtMin(m) : 'sem estudo'}`}
                        style={{ background: cores[n], borderColor: n || futuro ? 'transparent' : 'var(--line)' }}
                      />
                    );
                  }),
                ])}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text2)' }}>
                {['sem estudo', 'até 2 h', '2 a 4 h', '4 h ou mais'].map((t, i) => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, background: cores[i], border: `1px solid ${i ? 'transparent' : 'var(--line)'}` }} />
                    {t}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </Shell>
  );
}
