import { useRef, useState } from 'react';
import { useDados, useLoja } from '../data/store';
import type { Tarefa } from '../data/model';
import { aPlanejar, atrasada, dataCurta, diaCurto, fmtMin, hhmm, hoje, minDe, nomeDisciplina, plano, rotulo, segundaDaSemana, somarDias, trilhas } from '../data/logica';
import { EditorAgenda, PainelEncaixe, PainelReplanejar } from './Agenda';
import { Shell } from './Shell';
import { type Ctx, type Vista, VistaFila, VistaHorario, VistaQuatro } from './SemanaVistas';
import { link } from './rota';

const FORA = 'a-planejar';
const VISTAS: [Vista, string][] = [['horario', 'HORÁRIO'], ['fila', 'FILA'], ['quatro', '4 SEMANAS']];

function vistaSalva(): Vista {
  try {
    const v = localStorage.getItem('semana.vista');
    if (v === 'horario' || v === 'fila' || v === 'quatro') return v;
  } catch { /* sem armazenamento: usa o padrão */ }
  return 'horario';
}

export function Semana() {
  const d = useDados();
  const { alterar } = useLoja();
  const [desloc, setDesloc] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<{ key: string; dia: string | null } | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [vista, setVistaEstado] = useState<Vista>(vistaSalva);
  const pegada = useRef(0);
  const [painel, setPainel] = useState<'agenda' | 'encaixe' | 'replanejar' | 'replanejar-aviso' | null>(null);

  const h = hoje();
  const inicio = somarDias(segundaDaSemana(h), desloc * 7);
  const fim = somarDias(inicio, 6);
  const dias = plano(d, inicio, fim);
  const soltas = aPlanejar(d);
  const selecionada = sel ? d.tarefas.find((t) => t.key === sel && !t.feita) : undefined;
  const atual = d.sessao?.tarefaKey;

  let feitoMin = 0;
  let planejadoMin = 0;
  let planejadas = 0;
  for (const ts of dias.values())
    for (const t of ts) {
      if (t.feita) feitoMin += t.chEfetivaMin ?? 0;
      else planejadas++;
      planejadoMin += t.feita ? t.chEfetivaMin ?? t.chMin : t.chMin;
    }
  const atrasadas = d.tarefas.filter((t) => atrasada(t, h)).length;
  const pendentesNaSemana = [...dias.values()].flat().filter((t) => !t.feita);

  const setVista = (v: Vista) => {
    setVistaEstado(v);
    try { localStorage.setItem('semana.vista', v); } catch { /* fica só nesta visita */ }
  };

  const mover = (t: Tarefa, dia: string | null, hora: string | null = null) => {
    // O bloco arrastado muda de coluna e o navegador nem sempre avisa o fim do arrasto.
    setArrastando(null);
    setAlvo(null);
    if (dia !== null && dia < h) return;
    if ((t.plano ?? null) === dia && (t.hora ?? null) === hora) return setSel(null);
    alterar(dia ? `${rotulo(t)} planejada para ${diaCurto(dia)} ${dataCurta(dia)}${hora ? ' às ' + hora : ''}` : `${rotulo(t)} sem dia`, (x) => {
      Object.assign(x.tarefas.find((y) => y.key === t.key)!, { plano: dia, hora: dia ? hora : null });
    });
    setSel(null);
  };

  const soltar = (e: React.DragEvent, dia: string | null, hora: string | null = null) => {
    e.preventDefault();
    setAlvo(null);
    const t = d.tarefas.find((x) => x.key === e.dataTransfer.getData('text/plain'));
    if (t) mover(t, dia, hora);
  };
  const soltarEm = (dia: string | null) => (e: React.DragEvent) => soltar(e, dia);

  const soltarSemana = (delta: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setAlvo(null);
    const t = arrastando ? d.tarefas.find((x) => x.key === arrastando.key) : undefined;
    if (!t || !arrastando) return;
    const dia = somarDias(arrastando.dia && arrastando.dia >= h ? arrastando.dia : h, delta * 7);
    mover(t, dia < h ? h : dia);
    setDesloc(desloc + delta);
  };

  const zona = (id: string, aceita: boolean, aoSoltar: (e: React.DragEvent) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!aceita || !arrastando) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (alvo !== id) setAlvo(id);
    },
    onDragLeave: () => setAlvo((a) => (a === id ? null : a)),
    onDrop: aoSoltar,
  });

  const limparSemana = () => {
    if (!confirm(`Tirar as ${pendentesNaSemana.length} tarefas pendentes desta semana? Elas voltam para “A planejar”.`)) return;
    const keys = new Set(pendentesNaSemana.map((t) => t.key));
    alterar(`Semana de ${dataCurta(inicio)} limpa`, (x) => {
      for (const t of x.tarefas) if (keys.has(t.key)) Object.assign(t, { plano: null, hora: null });
    });
  };

  const arrastavel = (t: Tarefa, dia: string | null) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent<HTMLButtonElement>) => {
      e.dataTransfer.setData('text/plain', t.key);
      e.dataTransfer.effectAllowed = 'move';
      pegada.current = e.clientY - e.currentTarget.getBoundingClientRect().top;
      setArrastando({ key: t.key, dia });
      setSel(null);
    },
    onDragEnd: () => {
      setArrastando(null);
      setAlvo(null);
    },
    onClick: () => setSel(sel === t.key ? null : t.key),
  });

  const ctx: Ctx = {
    d, h, inicio, sel, setSel, arrastandoKey: arrastando?.key ?? null, alvo, arrastavel, zona, soltar, pegadaY: () => pegada.current,
  };

  const bloco = (t: Tarefa, dia: string | null, compacto?: boolean) => (
    <button
      key={t.key}
      type="button"
      {...arrastavel(t, dia)}
      className={`bloco movel${compacto ? ' compacto' : ''}${t.key === atual ? ' agora' : ''}${sel === t.key ? ' sel' : ''}${arrastando?.key === t.key ? ' fantasma' : ''}`}
      aria-pressed={sel === t.key}
      aria-label={`${rotulo(t)}, ${nomeDisciplina(d, t)}. Arraste para um dia ou clique para mover.`}
      title={t.descricao}
    >
      <span className="mono" style={{ fontSize: 11, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 6px' }}>
        <span style={{ whiteSpace: 'nowrap' }}>{t.hora && dia ? `${t.hora}–${hhmm(minDe(t.hora) + t.chMin)}` : `${rotulo(t)} · ${fmtMin(t.chMin)}`}</span>
        {t.hora && dia && <span style={{ whiteSpace: 'nowrap' }}>{rotulo(t)}</span>}
        {atrasada(t, h) && <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>atrasada</span>}
      </span>
      <span style={{ fontSize: compacto ? 13 : 14, fontWeight: 500, lineHeight: 1.2 }}>{nomeDisciplina(d, t)}</span>
    </button>
  );

  return (
    <Shell secao="semana">
      <div className="miolo" style={{ paddingBottom: selecionada ? 160 : undefined }}>
        <section className="cabeca">
          <span className="numerao">{fmtMin(feitoMin)}<small>/{fmtMin(planejadoMin)}</small></span>
          <p>
            de {dataCurta(inicio)} a {dataCurta(fim)}: {planejadas} {planejadas === 1 ? 'tarefa planejada' : 'tarefas planejadas'}
            {atrasadas > 0 ? `, ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'} no total` : ''}. {soltas.length} ainda sem dia.
          </p>
          <div className="fim" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            <div className="grupo-seg mono" role="group" aria-label="Modo de ver">
              {VISTAS.map(([v, nome]) => (
                <button key={v} type="button" className={vista === v ? 'on' : ''} onClick={() => setVista(v)} aria-pressed={vista === v}>{nome}</button>
              ))}
            </div>
            <div className="grupo-seg mono" role="group" aria-label="Semana">
              <button type="button" className={alvo === 'antes' ? 'on' : ''} onClick={() => setDesloc(desloc - 1)} aria-label="Semana anterior" {...zona('antes', true, soltarSemana(-1))}>←</button>
              <button type="button" className={desloc === 0 ? 'on' : ''} onClick={() => setDesloc(0)}>ESTA SEMANA</button>
              <button type="button" className={alvo === 'depois' ? 'on' : ''} onClick={() => setDesloc(desloc + 1)} aria-label="Próxima semana" {...zona('depois', true, soltarSemana(1))}>→</button>
            </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className={`btn btn-peq ${painel === 'agenda' ? 'btn-ink' : 'btn-linha'}`} onClick={() => setPainel(painel === 'agenda' ? null : 'agenda')}>Minha agenda</button>
              <button type="button" className={`btn btn-peq ${painel === 'encaixe' ? 'btn-ink' : 'btn-linha'}`} onClick={() => setPainel(painel === 'encaixe' ? null : 'encaixe')}>Encaixar na agenda</button>
              <button type="button" className={`btn btn-peq ${painel?.startsWith('replanejar') ? 'btn-ink' : 'btn-linha'}`} onClick={() => setPainel(painel?.startsWith('replanejar') ? null : 'replanejar')}>Replanejar</button>
            </div>
            {pendentesNaSemana.length > 0 && <button type="button" className="btn btn-texto btn-peq" onClick={limparSemana}>Tirar tudo desta semana</button>}
          </div>
        </section>

        {painel === 'agenda' && <EditorAgenda fechar={() => setPainel(null)} salva={() => setPainel('replanejar-aviso')} />}
        {painel?.startsWith('replanejar') && <PainelReplanejar aviso={painel === 'replanejar-aviso'} abrirAgenda={() => setPainel('agenda')} />}
        {painel === 'encaixe' && <PainelEncaixe desdeSugerido={inicio > h ? inicio : h} abrirAgenda={() => setPainel('agenda')} />}

        {vista === 'horario' && <VistaHorario c={ctx} />}
        {vista === 'fila' && <VistaFila c={ctx} />}
        {vista === 'quatro' && <VistaQuatro c={ctx} irPara={(n) => setDesloc(desloc + n)} />}

        <section aria-label="A planejar" className={`a-planejar${alvo === FORA ? ' alvo' : ''}`} {...zona(FORA, true, soltarEm(null))}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 20px', borderBottom: '2px solid var(--ink)', paddingBottom: 12 }}>
            <h2 className="sub" style={{ fontSize: 24 }}>A planejar</h2>
            <span className="muted" style={{ fontSize: 14 }}>
              {soltas.length ? 'Arraste para um dia acima (no celular: toque na tarefa e depois no dia). Solte aqui para tirar uma tarefa do dia.' : 'Todas as tarefas pendentes já têm dia.'}
            </span>
            {selecionada?.plano && (
              <button type="button" className="btn btn-linha btn-peq" style={{ marginLeft: 'auto' }} onClick={() => mover(selecionada, null)}>
                Tirar {rotulo(selecionada)} do dia
              </button>
            )}
          </div>
          {trilhas(d).map((n) => {
            const ts = soltas.filter((t) => t.trilha === n);
            if (!ts.length) return null;
            return (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="rotulo">Trilha {n} · {ts.length} {ts.length === 1 ? 'tarefa' : 'tarefas'}</span>
                <div className="soltas">{ts.map((t) => bloco(t, null, true))}</div>
              </div>
            );
          })}
        </section>
      </div>

      {selecionada && (
        <div className="barra-mover" role="region" aria-label="Mover tarefa">
          <span style={{ fontWeight: 600 }}>{rotulo(selecionada)} · {nomeDisciplina(d, selecionada)}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} role="group" aria-label="Mover para o dia">
            {[...dias.keys()].filter((dia) => dia >= h).map((dia) => (
              <button key={dia} type="button" className={`btn btn-peq ${selecionada.plano === dia ? 'btn-ink' : 'btn-linha'}`} style={{ padding: '0 10px', textTransform: 'capitalize' }} onClick={() => mover(selecionada, dia)}>
                {diaCurto(dia)} {dataCurta(dia).split(' ')[0]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="btn btn-linha btn-peq" onClick={() => setDesloc(desloc - 1)} aria-label="Semana anterior">← semana</button>
            <button type="button" className="btn btn-linha btn-peq" onClick={() => setDesloc(desloc + 1)} aria-label="Próxima semana">semana →</button>
            {selecionada.plano && <button type="button" className="btn btn-linha btn-peq" onClick={() => mover(selecionada, null)}>Tirar do dia</button>}
            <a className="btn btn-texto btn-peq" href={link('ciclo/' + selecionada.key)}>Abrir</a>
            <button type="button" className="btn btn-texto btn-peq" onClick={() => setSel(null)}>Fechar</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
