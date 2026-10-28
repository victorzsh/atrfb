import { useState } from 'react';
import { useDados, useLoja } from '../data/store';
import type { Tarefa } from '../data/model';
import { dataCurta, diaCurto, fixada, fmtMin, hoje, nomeDisciplina, plano, rotulo, segundaDaSemana, somarDias } from '../data/logica';
import { Shell } from './Shell';
import { link } from './rota';

export function Semana() {
  const d = useDados();
  const { alterar } = useLoja();
  const [desloc, setDesloc] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<{ key: string; dia: string } | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  const h = hoje();
  const inicio = somarDias(segundaDaSemana(h), desloc * 7);
  const fim = somarDias(inicio, 6);
  const dias = plano(d, inicio, fim);
  const atual = d.sessao?.tarefaKey ?? [...plano(d, h, h).values()].flat().find((t) => !t.feita)?.key;
  const selecionada = sel ? d.tarefas.find((t) => t.key === sel && !t.feita) : undefined;
  const temFixadas = d.tarefas.some((t) => fixada(t, h));

  let feitoMin = 0;
  let planejadoMin = 0;
  for (const ts of dias.values())
    for (const t of ts) {
      if (t.feita) feitoMin += t.chEfetivaMin ?? 0;
      planejadoMin += t.feita ? t.chEfetivaMin ?? t.chMin : t.chMin;
    }
  const ultimo = [...dias.entries()].filter(([, ts]) => ts.some((t) => !t.feita)).pop();
  const restantes = d.tarefas.filter((t) => !t.feita).length - [...dias.values()].flat().filter((t) => !t.feita).length;

  const mover = (t: Tarefa, dia: string | null) => {
    if (dia !== null && dia < h) return;
    alterar(dia ? `${rotulo(t)} planejada para ${diaCurto(dia)} ${dataCurta(dia)}` : `${rotulo(t)} volta ao automático`, (x) => {
      x.tarefas.find((y) => y.key === t.key)!.plano = dia;
    });
    setSel(null);
  };

  const soltar = (dia: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setAlvo(null);
    const key = e.dataTransfer.getData('text/plain');
    const t = d.tarefas.find((x) => x.key === key);
    if (t) mover(t, dia);
  };

  const soltarSemana = (delta: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setAlvo(null);
    const t = arrastando ? d.tarefas.find((x) => x.key === arrastando.key) : undefined;
    if (!t || !arrastando) return;
    const dia = somarDias(arrastando.dia, delta * 7);
    mover(t, dia < h ? h : dia);
    setDesloc(desloc + delta);
  };

  const limpar = () => {
    if (!confirm('Tirar todas as tarefas dos dias em que você as colocou? Elas voltam a seguir a ordem da trilha.')) return;
    alterar('Planejamento da semana limpo', (x) => {
      for (const t of x.tarefas) t.plano = null;
    });
  };

  const arrastavel = (dia: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (dia < h || !arrastando) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (alvo !== dia) setAlvo(dia);
    },
    onDragLeave: () => setAlvo((a) => (a === dia ? null : a)),
    onDrop: soltar(dia),
  });

  return (
    <Shell secao="semana">
      <div className="miolo" style={{ paddingBottom: selecionada ? 140 : undefined }}>
        <section className="cabeca">
          <span className="numerao">{fmtMin(feitoMin)}<small>/{fmtMin(planejadoMin)}</small></span>
          <p>
            de {dataCurta(inicio)} a {dataCurta(fim)}. Com {fmtMin(d.minutosPorDia)} por dia
            {ultimo ? `, você chega à ${rotulo(ultimo[1][ultimo[1].length - 1])} na ${diaCurto(ultimo[0])}` : ''}
            {restantes > 0 ? `; ficam ${restantes} tarefas para depois.` : '.'}
          </p>
          <div className="fim" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <div className="grupo-seg mono" role="group" aria-label="Semana">
              <button type="button" className={alvo === 'antes' ? 'on' : ''} onClick={() => setDesloc(desloc - 1)} aria-label="Semana anterior"
                onDragOver={(e) => { if (arrastando) { e.preventDefault(); setAlvo('antes'); } }} onDragLeave={() => setAlvo(null)} onDrop={soltarSemana(-1)}>←</button>
              <button type="button" className={desloc === 0 ? 'on' : ''} onClick={() => setDesloc(0)}>ESTA SEMANA</button>
              <button type="button" className={alvo === 'depois' ? 'on' : ''} onClick={() => setDesloc(desloc + 1)} aria-label="Próxima semana"
                onDragOver={(e) => { if (arrastando) { e.preventDefault(); setAlvo('depois'); } }} onDragLeave={() => setAlvo(null)} onDrop={soltarSemana(1)}>→</button>
            </div>
            {temFixadas && <button type="button" className="btn btn-texto btn-peq" onClick={limpar}>Voltar tudo ao automático</button>}
          </div>
        </section>

        <div className="tab-rolagem">
          <div className="semana">
            {[...dias.entries()].map(([dia, ts]) => {
              const feito = ts.reduce((s, t) => s + (t.feita ? t.chEfetivaMin ?? 0 : 0), 0);
              const previsto = ts.reduce((s, t) => s + (t.feita ? 0 : t.chMin), 0);
              const total = dia < h ? feito : feito + previsto;
              const acima = dia >= h && total > d.minutosPorDia + 15;
              const aberto = dia >= h;
              return (
                <section key={dia} className={`dia${alvo === dia ? ' alvo' : ''}${aberto ? '' : ' passado'}`} {...arrastavel(dia)}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid var(--ink)', paddingBottom: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: dia === h ? 600 : 500, letterSpacing: '-.02em', textTransform: 'capitalize' }}>{diaCurto(dia)} {dataCurta(dia).split(' ')[0]}</span>
                    <span className="mono" style={{ fontSize: 11, color: acima ? 'var(--ink)' : 'var(--muted)', fontWeight: acima ? 600 : 400 }} title={acima ? `Acima da meta de ${fmtMin(d.minutosPorDia)}` : undefined}>
                      {fmtMin(total)}{acima ? ' · acima' : ''}
                    </span>
                  </div>
                  {ts.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{aberto ? 'livre' : 'sem estudo'}</span>}
                  {ts.map((t) =>
                    t.feita ? (
                      <a key={t.key} href={link('ciclo/' + t.key)} className="bloco feito">
                        <span className="mono" style={{ fontSize: 11 }}>{rotulo(t)} · {fmtMin(t.chEfetivaMin ?? t.chMin)}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>{nomeDisciplina(d, t)}</span>
                      </a>
                    ) : (
                      <button
                        key={t.key}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.key);
                          e.dataTransfer.effectAllowed = 'move';
                          setArrastando({ key: t.key, dia });
                          setSel(null);
                        }}
                        onDragEnd={() => {
                          setArrastando(null);
                          setAlvo(null);
                        }}
                        onClick={() => setSel(sel === t.key ? null : t.key)}
                        className={`bloco movel${t.key === atual ? ' agora' : ''}${sel === t.key ? ' sel' : ''}${arrastando?.key === t.key ? ' fantasma' : ''}`}
                        aria-pressed={sel === t.key}
                        aria-label={`${rotulo(t)}, ${nomeDisciplina(d, t)}. Arraste para outro dia ou clique para mover.`}
                      >
                        <span className="mono" style={{ fontSize: 11, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 6px' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>{rotulo(t)} · {fmtMin(t.chMin)}</span>
                          {fixada(t, h) && <span style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }} title="Você colocou esta tarefa neste dia">fixada</span>}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2, textAlign: 'left' }}>{nomeDisciplina(d, t)}</span>
                      </button>
                    ),
                  )}
                  {selecionada && aberto && !ts.some((t) => t.key === selecionada.key) && (
                    <button type="button" className="bloco destino" onClick={() => mover(selecionada, dia)}>
                      Mover {rotulo(selecionada)} para cá
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </div>
        <p className="mono muted" style={{ margin: 0, fontSize: 11, lineHeight: 1.7 }}>
          Arraste uma tarefa para outro dia (ou para ← → para mudar de semana). No celular, toque na tarefa e depois no dia.
          O que você não mexer segue a ordem da trilha pela meta diária, que muda em Dados.
        </p>
      </div>

      {selecionada && (
        <div className="barra-mover" role="region" aria-label="Mover tarefa">
          <span style={{ fontWeight: 600 }}>{rotulo(selecionada)} · {nomeDisciplina(d, selecionada)}</span>
          <span className="muted" style={{ fontSize: 13 }}>Toque no dia de destino; use ← → para outras semanas.</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="btn btn-linha btn-peq" onClick={() => setDesloc(desloc - 1)} aria-label="Semana anterior">←</button>
            <button type="button" className="btn btn-linha btn-peq" onClick={() => setDesloc(desloc + 1)} aria-label="Próxima semana">→</button>
            {fixada(selecionada, h) && <button type="button" className="btn btn-linha btn-peq" onClick={() => mover(selecionada, null)}>Voltar ao automático</button>}
            <a className="btn btn-texto btn-peq" href={link('ciclo/' + selecionada.key)}>Abrir</a>
            <button type="button" className="btn btn-texto btn-peq" onClick={() => setSel(null)}>Fechar</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
