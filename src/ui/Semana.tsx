import { useState } from 'react';
import { useDados } from '../data/store';
import { dataCurta, diaCurto, fmtMin, hoje, nomeDisciplina, plano, rotulo, segundaDaSemana, somarDias } from '../data/logica';
import { Shell } from './Shell';
import { link } from './rota';

export function Semana() {
  const d = useDados();
  const [desloc, setDesloc] = useState(0);
  const h = hoje();
  const inicio = somarDias(segundaDaSemana(h), desloc * 7);
  const fim = somarDias(inicio, 6);
  const dias = plano(d, inicio, fim);
  const atual = d.sessao?.tarefaKey ?? [...dias.values()].flat().find((t) => !t.feita)?.key;

  let feitoMin = 0;
  let planejadoMin = 0;
  for (const ts of dias.values())
    for (const t of ts) {
      if (t.feita) feitoMin += t.chEfetivaMin ?? 0;
      planejadoMin += t.feita ? t.chEfetivaMin ?? t.chMin : t.chMin;
    }
  const ultimoPlanejado = [...dias.entries()].filter(([, ts]) => ts.some((t) => !t.feita)).pop();
  const restantes = d.tarefas.filter((t) => !t.feita).length - [...dias.values()].flat().filter((t) => !t.feita).length;

  return (
    <Shell secao="semana">
      <div className="miolo">
        <section className="cabeca">
          <span className="numerao">{fmtMin(feitoMin)}<small>/{fmtMin(planejadoMin)}</small></span>
          <p>
            de {dataCurta(inicio)} a {dataCurta(fim)}. Com {fmtMin(d.minutosPorDia)} por dia
            {ultimoPlanejado ? `, você chega à ${rotulo(ultimoPlanejado[1][ultimoPlanejado[1].length - 1])} na ${diaCurto(ultimoPlanejado[0])}` : ''}
            {restantes > 0 ? `; ficam ${restantes} tarefas para depois.` : '.'}
          </p>
          <div className="grupo-seg mono fim" role="group" aria-label="Semana">
            <button type="button" onClick={() => setDesloc(desloc - 1)} aria-label="Semana anterior">←</button>
            <button type="button" className={desloc === 0 ? 'on' : ''} onClick={() => setDesloc(0)}>ESTA SEMANA</button>
            <button type="button" onClick={() => setDesloc(desloc + 1)} aria-label="Próxima semana">→</button>
          </div>
        </section>

        <div className="tab-rolagem">
          <div className="semana">
            {[...dias.entries()].map(([dia, ts]) => {
              const min = ts.reduce((s, t) => s + (t.feita ? t.chEfetivaMin ?? 0 : 0), 0);
              const prev = ts.reduce((s, t) => s + (t.feita ? 0 : t.chMin), 0);
              return (
                <section key={dia} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--ink)', paddingBottom: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: dia === h ? 600 : 500, letterSpacing: '-.02em', textTransform: 'capitalize' }}>{diaCurto(dia)} {dataCurta(dia).split(' ')[0]}</span>
                    <span className="mono muted" style={{ fontSize: 11 }}>{dia < h ? fmtMin(min) : fmtMin(min + prev)}</span>
                  </div>
                  {ts.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{dia < h ? 'sem estudo' : ''}</span>}
                  {ts.map((t) => (
                    <a key={t.key} href={link('ciclo/' + t.key)} className={`bloco ${t.feita ? 'feito' : t.key === atual ? 'agora' : ''}`}>
                      <span className="mono" style={{ fontSize: 11 }}>{rotulo(t)} · {fmtMin(t.feita ? t.chEfetivaMin ?? t.chMin : t.chMin)}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>{nomeDisciplina(d, t)}</span>
                    </a>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
        <p className="mono muted" style={{ margin: 0, fontSize: 11 }}>
          Os dias futuros são uma previsão: a sequência da trilha distribuída pela sua meta diária (muda em Dados).
        </p>
      </div>
    </Shell>
  );
}
