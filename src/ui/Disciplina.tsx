import { useDados, useLoja } from '../data/store';
import type { Aula } from '../data/model';
import { MODULOS } from '../data/config';
import { disciplinaDaTarefa, ordenadas, pct, rotulo } from '../data/logica';
import { alternarAula, nivel } from './Mapa';
import { Shell } from './Shell';
import { link } from './rota';

function Numero({ valor, rotulo: r, salvar }: { valor: number | null; rotulo: string; salvar: (n: number | null) => void }) {
  return (
    <input
      className="campo"
      inputMode="numeric"
      aria-label={r}
      defaultValue={valor ?? ''}
      key={valor ?? 'vazio'}
      onBlur={(e) => {
        const t = e.target.value.replace(/\D/g, '');
        const n = t === '' ? null : Number(t);
        if (n !== valor) salvar(n);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Disciplina({ chave }: { chave: string }) {
  const d = useDados();
  const { alterar } = useLoja();
  const disc = d.disciplinas.find((x) => x.key === chave);
  if (!disc) {
    return (
      <Shell secao="mapa">
        <div className="miolo"><p>Disciplina não encontrada. <a href={link('mapa')}>Voltar ao Mapa</a></p></div>
      </Shell>
    );
  }
  const feitas = disc.aulas.filter((a) => a.tr).length;
  const q = disc.aulas.reduce((s, a) => s + (a.qtd ?? 0), 0);
  const ac = disc.aulas.reduce((s, a) => s + (a.acertos ?? 0), 0);
  const tarefas = ordenadas(d).filter((t) => disciplinaDaTarefa(d, t)?.key === disc.key);

  const mudar = (a: Aula, campo: 'qtd' | 'acertos', n: number | null) =>
    alterar(`${disc.nome}, aula ${String(a.n).padStart(2, '0')}: ${campo === 'qtd' ? 'questões' : 'acertos'} = ${n ?? 'vazio'}`, (x) => {
      x.disciplinas.find((y) => y.key === disc.key)!.aulas.find((y) => y.n === a.n)![campo] = n;
    });

  return (
    <Shell secao="mapa">
      <div className="miolo">
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', alignItems: 'center', fontSize: 14 }}>
          <a href={link('mapa')} style={{ textDecoration: 'none', color: 'var(--muted)' }}>← Mapa</a>
          <span className="rotulo">{MODULOS[disc.modulo]}{disc.questoes ? ` · ${disc.questoes} questões na prova` : ''}</span>
        </header>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 20, borderBottom: '2px solid var(--ink)', paddingBottom: 28 }}>
          <h1 className="titulo" style={{ fontSize: 72 }}>{disc.nome}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {disc.aulas.map((a) => {
              const n = nivel(a);
              const bom = n === 'l3';
              return (
                <button
                  key={a.n}
                  type="button"
                  onClick={() => alternarAula(alterar, disc, a)}
                  title={a.tr ? 'Desmarcar teoria + revisão' : 'Marcar teoria + revisão'}
                  style={{
                    width: 64, height: 64, display: 'flex', alignItems: 'flex-end', padding: 6, fontFamily: 'var(--mono)', fontSize: 11,
                    background: bom ? 'var(--mark)' : a.tr ? 'var(--done)' : 'transparent',
                    color: bom ? '#141414' : a.tr ? 'var(--onDone)' : 'var(--muted)',
                    border: `1px solid ${bom ? '#141414' : a.tr ? 'var(--done)' : 'var(--line)'}`,
                  }}
                >
                  {String(a.n).padStart(2, '0')}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 40px', fontSize: 15 }}>
            <span><strong>{feitas} de {disc.aulas.length}</strong> aulas com teoria + revisão</span>
            <span><strong>{q}</strong> questões, <strong>{ac}</strong> acertos</span>
            {q > 0 && <span><strong>{pct(ac, q)}%</strong> de desempenho</span>}
          </div>
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
          <section aria-label="Controle de desempenho" style={{ flex: '999 1 560px', minWidth: 0, overflowX: 'auto' }}>
            <div className="lista-linha rotulo" style={{ gridTemplateColumns: '70px 90px 90px 90px minmax(100px, 1fr)', minWidth: 520, minHeight: 0, paddingBottom: 8, borderBottom: '1px solid var(--ink)' }}>
              <span>AULA</span><span>T+R</span><span style={{ textAlign: 'right' }}>QUESTÕES</span><span style={{ textAlign: 'right' }}>ACERTOS</span><span style={{ textAlign: 'right' }}>DESEMPENHO</span>
            </div>
            {disc.aulas.map((a) => {
              const p = a.qtd ? pct(a.acertos ?? 0, a.qtd) : null;
              return (
                <div key={a.n} className="lista-linha" style={{ gridTemplateColumns: '70px 90px 90px 90px minmax(100px, 1fr)', minWidth: 520 }}>
                  <span className="mono">{String(a.n).padStart(2, '0')}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={a.tr} onChange={() => alternarAula(alterar, disc, a)} style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--ink)' }} />
                    {a.tr ? 'sim' : ''}
                  </label>
                  <span style={{ textAlign: 'right' }}><Numero valor={a.qtd} rotulo={`Questões da aula ${a.n}`} salvar={(n) => mudar(a, 'qtd', n)} /></span>
                  <span style={{ textAlign: 'right' }}><Numero valor={a.acertos} rotulo={`Acertos da aula ${a.n}`} salvar={(n) => mudar(a, 'acertos', n)} /></span>
                  <span className="mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, fontSize: 13 }}>
                    <span style={{ width: 80, height: 8, background: 'var(--track)' }}>
                      <span style={{ display: 'block', height: 8, width: `${p ?? 0}%`, background: p !== null && p >= 70 ? 'var(--mark)' : 'var(--chart)' }} />
                    </span>
                    <span style={{ width: 40, textAlign: 'right' }}>{p === null ? '—' : `${p}%`}</span>
                  </span>
                </div>
              );
            })}
          </section>

          <aside aria-label="No ciclo" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="rotulo" style={{ paddingBottom: 8, borderBottom: '1px solid var(--ink)', color: 'var(--ink)' }}>No ciclo</span>
            {tarefas.length === 0 && <span className="muted" style={{ fontSize: 14 }}>Nenhuma tarefa desta disciplina nas trilhas importadas.</span>}
            {tarefas.map((t) => (
              <a key={t.key} href={link('ciclo/' + t.key)} style={{ display: 'grid', gridTemplateColumns: '64px 48px minmax(0, 1fr)', gap: 10, fontSize: 13, textDecoration: 'none', color: t.feita ? 'var(--ink)' : 'var(--muted)' }}>
                <span className="mono">{rotulo(t)}</span>
                <span className="mono muted">TR {t.trilha}</span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</span>
              </a>
            ))}
          </aside>
        </div>
      </div>
    </Shell>
  );
}
