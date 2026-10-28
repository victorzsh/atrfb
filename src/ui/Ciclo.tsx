import { useState } from 'react';
import { useDados, useLoja } from '../data/store';
import { sigla } from '../data/config';
import { dataCurta, deIso, fmtMin, nomeDisciplina, ordenadas, pct, rotulo, tarefa, trilhas } from '../data/logica';
import { comecar } from './Agora';
import { Shell } from './Shell';
import { link } from './rota';

export function Ciclo({ sel }: { sel?: string }) {
  const d = useDados();
  const { alterar } = useLoja();
  const todas = ordenadas(d);
  const atual = d.sessao?.tarefaKey ?? todas.find((t) => !t.feita)?.key;
  const [escolhida, setEscolhida] = useState(sel ?? atual ?? todas[0]?.key);
  const t = escolhida ? tarefa(d, escolhida) : undefined;

  const feitas = todas.filter((x) => x.feita);
  const proposta = todas.reduce((s, x) => s + x.chMin, 0);
  const realizada = feitas.reduce((s, x) => s + (x.chEfetivaMin ?? 0), 0);
  const notas = t ? (t.num === null ? d.notas.filter((n) => tarefa(d, n.tarefaKey)?.trilha === t.trilha) : d.notas.filter((n) => n.tarefaKey === t.key)) : [];

  return (
    <Shell secao="ciclo">
      <div className="miolo">
        <section className="cabeca">
          <span className="numerao">{feitas.length}<small>/{todas.length}</small></span>
          <p>tarefas feitas no ciclo. Cada linha é uma trilha, na ordem da Estratégia.</p>
          <div className="fim" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
            <a className="btn btn-linha btn-peq" href={link('nova-trilha')}>+ Nova trilha da semana</a>
            <span className="mono muted" style={{ fontSize: 12, textAlign: 'right' }}>{fmtMin(realizada)} de {fmtMin(proposta)} propostas</span>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {trilhas(d).map((n) => {
            const ts = todas.filter((x) => x.trilha === n);
            const normais = ts.filter((x) => x.num !== null).length;
            return (
              <div key={n} className="ciclo-linha">
                <span style={{ fontSize: 15, fontWeight: 500 }}>Trilha {n}</span>
                <span className="ciclo-tiles" style={{ ['--n' as string]: normais + (ts.length > normais ? 2 : 0) }}>
                  {ts.map((x) => {
                    const cls = [x.feita ? 'feito' : x.key === atual ? 'agora' : '', x.key === escolhida ? 'sel' : '', x.num === null ? 'extra' : ''].join(' ');
                    return (
                      <button key={x.key} type="button" className={`tile ${cls}`} title={`${rotulo(x)} · ${nomeDisciplina(d, x)}`} aria-label={`${rotulo(x)}, ${nomeDisciplina(d, x)}${x.feita ? ', feita' : ''}`} onClick={() => setEscolhida(x.key)}>
                        {sigla(x.disciplina)}
                      </button>
                    );
                  })}
                </span>
                <span className="mono" style={{ textAlign: 'right', fontSize: 12 }}>{ts.filter((x) => x.feita).length}/{ts.length}</span>
              </div>
            );
          })}
        </div>

        {t && (
          <section aria-label="Tarefa selecionada" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 48px', alignItems: 'flex-start', borderTop: '2px solid var(--ink)', paddingTop: 20 }}>
            <span className="mono" style={{ fontSize: 13, width: 120 }}>{rotulo(t)}<br /><span className="muted">Trilha {t.trilha}</span></span>
            <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>{nomeDisciplina(d, t)}</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text2)', maxWidth: 760 }}>{t.descricao}</span>
              {t.feita && (
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  feita{t.data ? ` em ${dataCurta(t.data)} ${deIso(t.data).getFullYear()}` : ''}
                  {t.chEfetivaMin !== null ? ` · ${fmtMin(t.chEfetivaMin)}` : ''}
                  {t.questoes ? ` · ${t.acertos ?? 0}/${t.questoes} questões (${pct(t.acertos ?? 0, t.questoes)}%)` : ''}
                </span>
              )}
              {notas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  <span className="rotulo">{t.num === null ? 'Anotações da trilha para revisar' : 'Anotações'}</span>
                  {notas.map((n, i) => (
                    <span key={i} style={{ fontSize: 14, lineHeight: 1.4 }}>
                      <span className="mono muted" style={{ fontSize: 11 }}>{rotulo(tarefa(d, n.tarefaKey)!)} · </span>{n.texto}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <span className="mono muted" style={{ fontSize: 12 }}>proposta {fmtMin(t.chMin)}</span>
              {!t.feita && !d.sessao && (
                <button type="button" className="btn btn-ink btn-peq" onClick={() => comecar(alterar, t)}>Começar agora</button>
              )}
              {d.sessao?.tarefaKey === t.key && <a className="btn btn-ink btn-peq" href={link('')}>Abrir sessão</a>}
              <a className="btn btn-linha btn-peq" href={link('registro/' + t.key)}>{t.feita ? 'Editar registro' : 'Registrar sem cronômetro'}</a>
            </div>
          </section>
        )}
        <p className="mono muted" style={{ margin: 0, fontSize: 11, lineHeight: 1.7 }}>
          {[...new Map(todas.map((x) => [sigla(x.disciplina), nomeDisciplina(d, x)])).entries()].map(([s, n]) => `${s} ${n.toLowerCase()}`).join(' · ')}
        </p>
      </div>
    </Shell>
  );
}
