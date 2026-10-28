import { useState } from 'react';
import { useDados, useLoja } from '../data/store';
import type { Intervalo } from '../data/model';
import { aPlanejar, dataCurta, deIso, diaCurto, DIAS_SEMANA, encaixar, fmtMin, hhmm, hoje, minDe, rotulo, temAgenda, trilhas } from '../data/logica';

const vazia = (): Intervalo[][] => Array.from({ length: 7 }, () => []);

// Os horários de estudo de cada dia da semana. Dia sem horário é folga.
export function EditorAgenda({ fechar }: { fechar: () => void }) {
  const d = useDados();
  const { alterar } = useLoja();
  const [agenda, setAgenda] = useState<Intervalo[][]>(() => structuredClone(d.agenda ?? vazia()));
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (dia: number, fn: (xs: Intervalo[]) => Intervalo[]) => setAgenda(agenda.map((xs, i) => (i === dia ? fn([...xs]) : xs)));
  const minutos = (xs: Intervalo[]) => xs.reduce((s, i) => s + Math.max(0, minDe(i.fim) - minDe(i.inicio)), 0);
  const total = agenda.reduce((s, xs) => s + minutos(xs), 0);

  const salvar = () => {
    for (const [i, xs] of agenda.entries()) {
      const ord = [...xs].sort((a, b) => minDe(a.inicio) - minDe(b.inicio));
      for (const [j, x] of ord.entries()) {
        if (minDe(x.fim) <= minDe(x.inicio)) return setErro(`${DIAS_SEMANA[i]}: o horário ${x.inicio}–${x.fim} termina antes de começar.`);
        if (j > 0 && minDe(x.inicio) < minDe(ord[j - 1].fim)) return setErro(`${DIAS_SEMANA[i]}: dois horários se sobrepõem.`);
      }
    }
    alterar('Agenda de estudo atualizada', (x) => {
      x.agenda = agenda.map((xs) => [...xs].sort((a, b) => minDe(a.inicio) - minDe(b.inicio)));
    });
    fechar();
  };

  return (
    <section aria-label="Minha agenda" style={{ display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--ink)', padding: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 20px' }}>
        <h2 className="sub" style={{ fontSize: 24 }}>Minha agenda</h2>
        <span className="muted" style={{ fontSize: 14 }}>Os horários em que você estuda em cada dia. Dia sem horário é folga. Total: {fmtMin(total)} por semana.</span>
      </div>
      {agenda.map((xs, dia) => (
        <div key={dia} className="lista-linha" style={{ gridTemplateColumns: '110px minmax(0, 1fr) 70px', alignItems: 'start', padding: '10px 0' }}>
          <span style={{ fontWeight: 500, paddingTop: 8 }}>{DIAS_SEMANA[dia]}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
            {xs.length === 0 && <span className="muted" style={{ fontSize: 14 }}>folga</span>}
            {xs.map((x, j) => (
              <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="time" className="campo" style={{ width: 96, textAlign: 'left' }} aria-label={`${DIAS_SEMANA[dia]}, início`} value={x.inicio}
                  onChange={(e) => mudar(dia, (a) => a.map((y, k) => (k === j ? { ...y, inicio: e.target.value } : y)))} />
                <span className="muted">–</span>
                <input type="time" className="campo" style={{ width: 96, textAlign: 'left' }} aria-label={`${DIAS_SEMANA[dia]}, fim`} value={x.fim}
                  onChange={(e) => mudar(dia, (a) => a.map((y, k) => (k === j ? { ...y, fim: e.target.value } : y)))} />
                <button type="button" className="btn-texto" aria-label="Remover horário" onClick={() => mudar(dia, (a) => a.filter((_, k) => k !== j))} style={{ fontSize: 18, color: 'var(--muted)' }}>×</button>
              </span>
            ))}
            <button type="button" className="btn btn-linha btn-peq" onClick={() => mudar(dia, (a) => {
              const ultimo = a.length ? minDe(a[a.length - 1].fim) : null;
              const ini = ultimo === null ? 8 * 60 : Math.min(ultimo + 60, 21 * 60);
              return [...a, { inicio: hhmm(ini), fim: hhmm(Math.min(ini + 180, 23 * 60 + 59)) }];
            })}>+ horário</button>
            {dia > 0 && agenda[dia - 1].length > 0 && (
              <button type="button" className="btn btn-texto btn-peq" onClick={() => mudar(dia, () => structuredClone(agenda[dia - 1]))}>igual a {DIAS_SEMANA[dia - 1].toLowerCase()}</button>
            )}
          </div>
          <span className="mono muted" style={{ fontSize: 12, textAlign: 'right', paddingTop: 10 }}>{xs.length ? fmtMin(minutos(xs)) : ''}</span>
        </div>
      ))}
      {erro && <p className="erro-txt" style={{ margin: 0 }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-ink" onClick={salvar}>Salvar agenda</button>
        <button type="button" className="btn btn-texto" onClick={fechar}>Cancelar</button>
      </div>
    </section>
  );
}

// Encaixa as tarefas sem dia nos horários livres da agenda, só quando você pede.
export function PainelEncaixe({ desdeSugerido, abrirAgenda }: { desdeSugerido: string; abrirAgenda: () => void }) {
  const d = useDados();
  const { alterar } = useLoja();
  const soltas = aPlanejar(d);
  const opcoes = trilhas(d).map((n) => ({ n, qtd: soltas.filter((t) => t.trilha === n).length })).filter((o) => o.qtd > 0);
  const [qual, setQual] = useState<string>(opcoes[0] ? String(opcoes[0].n) : 'todas');
  const [desde, setDesde] = useState(desdeSugerido);
  const [ultimo, setUltimo] = useState<{ keys: string[]; msg: string } | null>(null);

  if (!temAgenda(d)) {
    return (
      <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, border: '1px solid var(--ink)', padding: 24 }}>
        <span style={{ fontSize: 15 }}>Para encaixar as tarefas, defina primeiro os horários em que você estuda em cada dia.</span>
        <button type="button" className="btn btn-ink btn-peq" onClick={abrirAgenda}>Definir minha agenda</button>
      </section>
    );
  }

  const fazer = () => {
    const alvo = qual === 'todas' ? soltas : soltas.filter((t) => String(t.trilha) === qual);
    if (!alvo.length) return;
    const agora = new Date();
    const r = encaixar(d, alvo.map((t) => t.key), desde, desde <= hoje() ? agora.getHours() * 60 + agora.getMinutes() : null);
    if (!r.colocadas.length) {
      setUltimo({ keys: [], msg: 'Nenhuma tarefa coube nos horários livres.' });
      return;
    }
    const nome = qual === 'todas' ? 'Tarefas sem dia' : `Trilha ${qual}`;
    alterar(`${nome} encaixada na agenda (${r.colocadas.length} tarefas)`, (x) => {
      for (const c of r.colocadas) Object.assign(x.tarefas.find((t) => t.key === c.key)!, { plano: c.dia, hora: c.hora });
    });
    const p = r.colocadas[0].dia;
    const u = r.colocadas[r.colocadas.length - 1].dia;
    const fora = r.semEspaco.map((k) => rotulo(d.tarefas.find((t) => t.key === k)!));
    setUltimo({
      keys: r.colocadas.map((c) => c.key),
      msg: `${r.colocadas.length} ${r.colocadas.length === 1 ? 'tarefa encaixada' : 'tarefas encaixadas'}, de ${diaCurto(p)} ${dataCurta(p)} a ${diaCurto(u)} ${dataCurta(u)} ${deIso(u).getFullYear()}.` +
        (fora.length ? ` Não couberam em nenhum horário: ${fora.join(', ')}.` : ''),
    });
  };

  const desfazer = () => {
    if (!ultimo) return;
    const keys = new Set(ultimo.keys);
    alterar('Encaixe desfeito', (x) => {
      for (const t of x.tarefas) if (keys.has(t.key) && !t.feita) Object.assign(t, { plano: null, hora: null });
    });
    setUltimo(null);
  };

  return (
    <section aria-label="Encaixar na agenda" style={{ display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--ink)', padding: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 20px' }}>
        <h2 className="sub" style={{ fontSize: 24 }}>Encaixar na agenda</h2>
        <span className="muted" style={{ fontSize: 14 }}>Coloca as tarefas sem dia nos seus horários livres, na ordem da trilha. O que já tem dia não muda.</span>
      </div>
      {opcoes.length === 0 ? (
        <span style={{ fontSize: 15 }}>Todas as tarefas pendentes já têm dia.</span>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', alignItems: 'flex-end' }}>
          <label className="campo-rotulo">
            O QUE
            <select className="campo" style={{ width: 'auto', minWidth: 220, textAlign: 'left', fontFamily: 'var(--sans)' }} value={qual} onChange={(e) => setQual(e.target.value)}>
              {opcoes.map((o) => <option key={o.n} value={o.n}>Trilha {o.n} ({o.qtd} sem dia)</option>)}
              {opcoes.length > 1 && <option value="todas">Todas sem dia ({soltas.length})</option>}
            </select>
          </label>
          <label className="campo-rotulo">
            A PARTIR DE
            <input type="date" className="campo" style={{ width: 'auto', textAlign: 'left' }} value={desde} min={hoje()} onChange={(e) => setDesde(e.target.value < hoje() ? hoje() : e.target.value)} />
          </label>
          <button type="button" className="btn btn-ink" onClick={fazer}>Encaixar</button>
          <button type="button" className="btn btn-texto btn-peq" onClick={abrirAgenda}>Ver minha agenda</button>
        </div>
      )}
      {ultimo && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <span className="ok-txt">{ultimo.msg}</span>
          {ultimo.keys.length > 0 && <button type="button" className="btn btn-linha btn-peq" onClick={desfazer}>Desfazer</button>}
        </div>
      )}
    </section>
  );
}
