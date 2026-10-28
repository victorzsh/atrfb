import { useState } from 'react';
import { useDados, useLoja } from '../data/store';
import type { Aula, Dados, Disciplina } from '../data/model';
import { MODULOS } from '../data/config';
import { contagemMapa, disciplinaDaTarefa, proximaAula, tarefa } from '../data/logica';
import { Shell } from './Shell';
import { link } from './rota';

export function nivel(a: Aula): string {
  if (a.qtd === null || a.qtd === 0) return a.tr ? 'l0' : '';
  const p = (a.acertos ?? 0) / a.qtd;
  return p >= 0.7 ? 'l3' : p >= 0.5 ? 'l2' : 'l1';
}

// A aula que está sendo estudada agora (sessão aberta), para piscar no tabuleiro.
export function aulaAgora(d: Dados): { disc: string; n: number } | null {
  const t = d.sessao ? tarefa(d, d.sessao.tarefaKey) : undefined;
  const disc = t ? disciplinaDaTarefa(d, t) : undefined;
  const n = disc ? proximaAula(disc) : null;
  return disc && n !== null ? { disc: disc.key, n } : null;
}

export function alternarAula(alterar: ReturnType<typeof useLoja>['alterar'], disc: Disciplina, a: Aula) {
  alterar(`Mapa: ${disc.nome}, aula ${String(a.n).padStart(2, '0')} ${a.tr ? 'desmarcada' : 'marcada'}`, (x) => {
    const au = x.disciplinas.find((y) => y.key === disc.key)!.aulas.find((y) => y.n === a.n)!;
    au.tr = !au.tr;
  });
}

export function Mapa() {
  const d = useDados();
  const { alterar } = useLoja();
  const [modo, setModo] = useState<'tr' | 'ac'>('tr');
  const { feitas, total } = contagemMapa(d);
  const agora = aulaAgora(d);
  const maxAulas = Math.max(...d.disciplinas.map((x) => x.aulas.length));
  const tr = modo === 'tr';

  return (
    <Shell secao="mapa">
      <div className="miolo">
        <section className="cabeca">
          <span className="numerao">{feitas}<small>/{total}</small></span>
          <p>{tr ? 'aulas com teoria e revisão feitas. Cada quadrado é uma aula do PDF.' : 'As mesmas aulas, pintadas pelo seu acerto nas questões. Aula feita sem questões fica só com contorno.'}</p>
          <div className="grupo-seg fim" role="group" aria-label="Modo do tabuleiro">
            <button type="button" className={tr ? 'on' : ''} onClick={() => setModo('tr')}>Teoria + revisão</button>
            <button type="button" className={!tr ? 'on' : ''} onClick={() => setModo('ac')}>Acertos</button>
          </div>
        </section>

        <div className="tab-rolagem">
          <div className="tab">
            <div className="tab-linha tab-regua">
              <span />
              <span className="quadros" style={{ flexWrap: 'nowrap' }}>
                {Array.from({ length: maxAulas }, (_, i) => (
                  <span key={i} style={{ width: 20, flex: 'none', textAlign: 'center' }}>{i === 0 || (i + 1) % 5 === 0 ? i + 1 : ''}</span>
                ))}
              </span>
              <span className="num">FEITAS</span>
              <span className="num">PROVA</span>
            </div>
            {[1, 2, 0].map((m) => {
              const discs = d.disciplinas.filter((x) => x.modulo === m);
              if (!discs.length) return null;
              return (
                <section key={m} className="tab-grupo">
                  <h3>{MODULOS[m]}</h3>
                  {discs.map((disc) => (
                    <div key={disc.key} className="tab-linha">
                      <a className="nome" href={link('mapa/' + encodeURIComponent(disc.key))}>{disc.nome}</a>
                      <span className="quadros">
                        {disc.aulas.map((a) => {
                          const pisca = agora?.disc === disc.key && agora.n === a.n;
                          const cls = pisca ? 'agora' : tr ? (a.tr ? 'feito' : '') : nivel(a);
                          const rot = `${disc.nome}, aula ${a.n}${a.tr ? ', feita' : ''}${a.qtd ? `, ${a.acertos ?? 0} de ${a.qtd} questões` : ''}`;
                          return tr ? (
                            <button key={a.n} type="button" className={`q ${cls}`} aria-label={rot} title={rot} onClick={() => alternarAula(alterar, disc, a)} />
                          ) : (
                            <span key={a.n} className={`q ${cls}`} title={rot} />
                          );
                        })}
                      </span>
                      <span className="num">{disc.aulas.filter((a) => a.tr).length}/{disc.aulas.length}</span>
                      <span className="num prova muted">{disc.questoes ?? '—'}</span>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        </div>

        <footer className="legenda">
          {tr ? (
            <>
              <span><i className="q" />pendente</span>
              <span><i className="q feito" />teoria + revisão</span>
              {agora && <span><i className="q agora" />estudando agora</span>}
            </>
          ) : (
            <>
              <span><i className="q l0" />sem questões</span>
              <span><i className="q l1" />abaixo de 50%</span>
              <span><i className="q l2" />50 a 69%</span>
              <span><i className="q l3" />70% ou mais</span>
            </>
          )}
          <span className="mono muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{tr ? 'clique num quadrado para marcar · o nome abre a disciplina' : 'passe o mouse num quadrado para ver o número'}</span>
        </footer>
      </div>
    </Shell>
  );
}
