import { useState } from 'react';
import type { Dados, Tarefa } from '../data/model';
import { useLoja } from '../data/store';
import {
  aPlanejar, atrasada, chaveBloco, colocar, dataCurta, diaCurto, ehFolga, encaixar, fmtMin, hhmm, horarios, intervalosDoDia, minDe,
  minutosDisponiveis, nomeDisciplina, pedacosNoDia, plano, type Posicao, restaurar, rotulo, simularFolgas, somarDias, type TarefaNoDia, temAgenda, ultimoDiaDe,
} from '../data/logica';
import { link } from './rota';

export type Vista = 'horario' | 'fila' | 'quatro';

// O que as três vistas recebem da página: seleção, arrastar e mover são os mesmos em todas.
export interface Ctx {
  d: Dados;
  h: string;
  inicio: string;
  sel: string | null;
  setSel: (k: string | null) => void;
  arrastandoKey: string | null;
  alvo: string | null;
  arrastavel: (t: Tarefa, dia: string | null) => Partial<React.ButtonHTMLAttributes<HTMLButtonElement>>;
  zona: (id: string, aceita: boolean, aoSoltar: (e: React.DragEvent) => void) => Record<string, unknown>;
  soltar: (e: React.DragEvent, dia: string | null, hora?: string | null) => void;
  pegadaY: () => number;
}

export function agoraMin(): number {
  const a = new Date();
  return a.getHours() * 60 + a.getMinutes();
}

const dur = (t: Tarefa) => (t.feita ? t.chEfetivaMin ?? t.chMin : t.chMin);
const diaNum = (iso: string) => dataCurta(iso).split(' ')[0];

// "T-91" ou, para um pedaço de tarefa dividida, "T-91 · 1/2".
function nomeBloco(t: TarefaNoDia) {
  return t.parte ? `${rotulo(t)} · ${t.parte.i + 1}/${t.parte.n}` : rotulo(t);
}

function classeBloco(c: Ctx, t: Tarefa, atual?: string) {
  return `bloco${t.feita ? ' feito' : ' movel'}${t.key === atual ? ' agora' : ''}${c.sel === t.key ? ' sel' : ''}${c.arrastandoKey === t.key ? ' fantasma' : ''}`;
}

// ---------- A · Horário ----------

const PX = 0.9; // pixels por minuto

export function VistaHorario({ c }: { c: Ctx }) {
  const { d, h } = c;
  const fim = somarDias(c.inicio, 6);
  const dias = [...plano(d, c.inicio, fim).entries()];
  const atual = d.sessao?.tarefaKey;
  const pos = new Map(dias.map(([dia, ts]) => [dia, horarios(d, dia, ts)]));

  let h0 = 7 * 60;
  let h1 = 18 * 60;
  for (const [dia] of dias) {
    for (const j of intervalosDoDia(d, dia)) { h0 = Math.min(h0, minDe(j.inicio)); h1 = Math.max(h1, minDe(j.fim)); }
    for (const p of pos.get(dia)!) { h0 = Math.min(h0, p.ini); h1 = Math.max(h1, p.fim); }
  }
  h0 = Math.floor(h0 / 60) * 60;
  h1 = Math.min(24 * 60, Math.ceil(h1 / 60) * 60);
  const altura = (h1 - h0) * PX;
  const horas = Array.from({ length: (h1 - h0) / 60 }, (_, i) => h0 + i * 60);
  const agora = agoraMin();

  const horaDoSolto = (e: React.DragEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const m = h0 + (e.clientY - r.top - c.pegadaY()) / PX;
    return hhmm(Math.max(0, Math.min(24 * 60 - 15, Math.round(m / 15) * 15)));
  };

  return (
    <div className="tab-rolagem">
      <div className="horario">
        <span />
        {dias.map(([dia, ts]) => {
          const disp = dia >= h ? minutosDisponiveis(d, dia) : 0;
          const total = ts.reduce((s, t) => s + (t.feita ? t.chEfetivaMin ?? 0 : t.chMin), 0);
          return (
            <div key={dia} className="horario-cab">
              <span style={{ fontSize: 18, fontWeight: dia === h ? 600 : 500, letterSpacing: '-.02em', textTransform: 'capitalize' }}>{diaCurto(dia)} {diaNum(dia)}</span>
              <span className="mono muted" style={{ fontSize: 10 }}>{disp ? `${fmtMin(total)}/${fmtMin(disp)}` : ehFolga(d, dia) ? 'imprevisto' : fmtMin(total)}</span>
            </div>
          );
        })}

        <div style={{ position: 'relative', height: altura }}>
          {horas.map((m) => <span key={m} className="mono horario-hora" style={{ top: (m - h0) * PX }}>{m / 60}h</span>)}
        </div>
        {dias.map(([dia]) => {
          const aberto = dia >= h;
          return (
            <div key={dia} className={`horario-col${c.alvo === dia ? ' alvo' : ''}`} style={{ height: altura }} {...c.zona(dia, aberto, (e) => c.soltar(e, dia, horaDoSolto(e)))}>
              {horas.map((m) => <span key={m} className="horario-linha" style={{ top: (m - h0) * PX }} />)}
              {intervalosDoDia(d, dia).map((j) => (
                <span key={j.inicio} className="horario-janela" style={{ top: (minDe(j.inicio) - h0) * PX, height: (minDe(j.fim) - minDe(j.inicio)) * PX }} />
              ))}
              {ehFolga(d, dia) && <span className="horario-aviso">imprevisto · sem estudo</span>}
              {pos.get(dia)!.map(({ t, ini, fim: f }) => {
                const estilo = { top: (ini - h0) * PX + 1, height: Math.max(26, (f - ini) * PX - 3) };
                const conteudo = (
                  <>
                    <span className="mono" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                      <span>{hhmm(ini)}–{hhmm(f)}</span>
                      <span style={{ fontWeight: atrasada(t, h) ? 600 : 400 }}>{atrasada(t, h) ? 'atrasada' : nomeBloco(t)}</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{nomeDisciplina(d, t)}</span>
                  </>
                );
                return t.feita ? (
                  <a key={chaveBloco(t)} href={link('ciclo/' + t.key)} className={`${classeBloco(c, t)} horario-bloco`} style={estilo} title={t.descricao}>{conteudo}</a>
                ) : (
                  <button
                    key={chaveBloco(t)}
                    type="button"
                    {...c.arrastavel(t, dia)}
                    className={`${classeBloco(c, t, atual)} horario-bloco`}
                    style={estilo}
                    aria-pressed={c.sel === t.key}
                    aria-label={`${nomeBloco(t)}, ${nomeDisciplina(d, t)}, ${hhmm(ini)}. Arraste para outro dia ou horário, ou clique para mover.`}
                    title={t.descricao}
                  >
                    {conteudo}
                  </button>
                );
              })}
              {dia === h && agora >= h0 && agora <= h1 && <span className="horario-agora" style={{ top: (agora - h0) * PX }}><i /></span>}
            </div>
          );
        })}
      </div>
      <div className="legenda-semana">
        <span><i className="q feito" />feita</span>
        <span><i className="q agora" />estudando agora</span>
        <span><i className="q" style={{ background: 'var(--janela)' }} />planejada</span>
        <span><i className="q hachura" />fora da sua agenda</span>
        <span className="muted" style={{ marginLeft: 'auto' }}>Arraste um bloco para outro dia ou horário. A altura é a carga horária.</span>
      </div>
    </div>
  );
}

// ---------- B · Fila ----------

export function VistaFila({ c, inicio = c.inicio, comPrevia = true }: { c: Ctx; inicio?: string; comPrevia?: boolean }) {
  const { d, h } = c;
  const { alterar } = useLoja();
  const [previa, setPrevia] = useState(false);
  const [feito, setFeito] = useState<{ keys: string[]; msg: string } | null>(null);
  const fim = somarDias(inicio, 6);
  const dias = [...plano(d, inicio, fim).entries()];
  const atual = d.sessao?.tarefaKey;
  const agenda = temAgenda(d);

  const soltas = aPlanejar(d);
  const desde = inicio > h ? inicio : h;
  const enc = comPrevia && agenda && soltas.length ? encaixar(d, soltas.map((t) => t.key), desde, desde === h ? agoraMin() : null, h) : null;
  const fantasmas = new Map<string, TarefaNoDia[]>();
  if (previa && enc)
    for (const x of enc.colocadas)
      for (const p of pedacosNoDia(d.tarefas.find((t) => t.key === x.key)!, x.partes))
        if (p.plano! >= inicio && p.plano! <= fim) fantasmas.set(p.plano!, [...(fantasmas.get(p.plano!) ?? []), p]);
  const nestaSemana = [...fantasmas.values()].flat().length;

  let escala = 8 * 60;
  for (const [dia, ts] of dias) {
    const soma = ts.reduce((s, t) => s + dur(t), 0) + (fantasmas.get(dia) ?? []).reduce((s, t) => s + t.chMin, 0);
    escala = Math.max(escala, minutosDisponiveis(d, dia), soma);
  }
  escala = Math.ceil(escala / 60) * 60;
  const pct = (m: number) => `${(m / escala) * 100}%`;

  const confirmar = () => {
    if (!enc?.colocadas.length) return;
    alterar(`Tarefas sem dia encaixadas na agenda (${enc.colocadas.length})`, (x) => {
      for (const p of enc.colocadas) colocar(x.tarefas.find((t) => t.key === p.key)!, p);
    });
    const u = enc.colocadas[enc.colocadas.length - 1].partes.at(-1)!.dia;
    setFeito({ keys: enc.colocadas.map((p) => p.key), msg: `${enc.colocadas.length} encaixadas, até ${diaCurto(u)} ${dataCurta(u)}.` });
    setPrevia(false);
  };
  const desfazer = () => {
    if (!feito) return;
    const keys = new Set(feito.keys);
    alterar('Encaixe desfeito', (x) => {
      for (const t of x.tarefas) if (keys.has(t.key) && !t.feita) colocar(t, null);
    });
    setFeito(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {comPrevia && (enc || feito) && (
        <div className="fila-previa">
          {feito ? (
            <>
              <span>{feito.msg}</span>
              <button type="button" className="btn btn-linha btn-peq" onClick={desfazer}>Desfazer</button>
            </>
          ) : (
            <>
              <button type="button" className={`chave${previa ? ' on' : ''}`} onClick={() => setPrevia(!previa)} aria-pressed={previa}><i /></button>
              <span>Prévia do encaixe: {soltas.length} sem dia{previa
                ? nestaSemana
                  ? ` · ${nestaSemana} entram nesta semana, em amarelo tracejado`
                  : enc!.colocadas.length
                    ? ` · nenhuma cabe nesta semana; a primeira entra ${diaCurto(enc!.colocadas[0].dia)} ${dataCurta(enc!.colocadas[0].dia)}`
                    : ' · nenhuma cabe nos horários da sua agenda'
                : ''}.</span>
              {previa && enc!.colocadas.length > 0 && <button type="button" className="btn btn-ink btn-peq" onClick={confirmar}>Encaixar {enc!.colocadas.length}</button>}
            </>
          )}
        </div>
      )}
      <div className="fila">
        <span />
        <div className="fila-regua">
          {Array.from({ length: escala / 60 + 1 }, (_, i) => <span key={i} className="mono" style={{ left: pct(i * 60) }}>{i}h</span>)}
        </div>
        <span className="rotulo" style={{ textAlign: 'right' }}>feito / agenda</span>
        {dias.map(([dia, ts]) => {
          const aberto = dia >= h;
          const disp = minutosDisponiveis(d, dia);
          const fts = fantasmas.get(dia) ?? [];
          const feitoMin = ts.reduce((s, t) => s + (t.feita ? t.chEfetivaMin ?? 0 : 0), 0);
          const planMin = ts.reduce((s, t) => s + dur(t), 0) + fts.reduce((s, t) => s + t.chMin, 0);
          const excesso = agenda && aberto && planMin > disp ? planMin - disp : 0;
          let x = 0;
          return (
            <div key={dia} style={{ display: 'contents' }}>
              <div className="fila-dia">
                <span style={{ fontSize: 17, fontWeight: dia === h ? 600 : 500, letterSpacing: '-.02em', textTransform: 'capitalize' }}>{diaCurto(dia)} {diaNum(dia)}{dia === h ? ' · hoje' : ''}</span>
                <span className="mono muted" style={{ fontSize: 10 }}>{ts.length ? `${ts.filter((t) => t.feita).length} de ${new Set(ts.map((t) => t.key)).size} feitas` : ''}</span>
              </div>
              <div className={`fila-barra${c.alvo === dia ? ' alvo' : ''}`} {...c.zona(dia, aberto, (e) => c.soltar(e, dia))}>
                <span className="fila-agenda" style={{ width: pct(disp) }} />
                {ts.map((t) => {
                  const w = dur(t);
                  const fora = agenda && aberto && !t.feita && x + w > disp;
                  const props = {
                    className: `${classeBloco(c, t, atual)} fila-peca${fora ? ' fora' : ''}${atrasada(t, h) ? ' atrasada' : ''}`,
                    style: { left: `calc(${pct(x)} + 2px)`, width: `calc(${pct(w)} - 4px)` },
                    title: `${nomeBloco(t)} · ${nomeDisciplina(d, t)} · ${fmtMin(w)}${t.hora ? ' · ' + t.hora : ''}`,
                  };
                  const miolo = (
                    <>
                      <span className="mono" style={{ fontSize: 9.5 }}>{atrasada(t, h) ? `${nomeBloco(t)} · atrasada` : nomeBloco(t)}</span>
                      <span className="fila-nome">{nomeDisciplina(d, t)}</span>
                    </>
                  );
                  const el = t.feita
                    ? <a key={chaveBloco(t)} href={link('ciclo/' + t.key)} {...props}>{miolo}</a>
                    : <button key={chaveBloco(t)} type="button" {...c.arrastavel(t, dia)} {...props} aria-pressed={c.sel === t.key}>{miolo}</button>;
                  x += w;
                  return el;
                })}
                {fts.map((t) => {
                  const el = (
                    <span key={chaveBloco(t)} className="bloco fila-peca previa" style={{ left: `calc(${pct(x)} + 2px)`, width: `calc(${pct(t.chMin)} - 4px)` }}>
                      <span className="mono" style={{ fontSize: 9.5 }}>{nomeBloco(t)}</span>
                      <span className="fila-nome">{nomeDisciplina(d, t)}</span>
                    </span>
                  );
                  x += t.chMin;
                  return el;
                })}
                {!ts.length && !fts.length && <span className="fila-vazio">{!aberto ? 'sem estudo' : ehFolga(d, dia) ? 'imprevisto · sem estudo' : disp ? `${fmtMin(disp)} livres na sua agenda` : 'fora da agenda'}</span>}
                {excesso > 0 && <span className="fila-limite" style={{ left: pct(disp) }} />}
              </div>
              <div className="fila-num">
                <span className="mono" style={{ fontSize: 13 }}>{disp ? `${fmtMin(dia <= h ? feitoMin : planMin)}/${fmtMin(disp)}` : fmtMin(planMin)}</span>
                <span style={{ fontSize: 11.5, color: excesso ? 'var(--erro)' : 'var(--muted)' }}>
                  {excesso ? `+${fmtMin(excesso)} além` : aberto && disp > planMin ? `${fmtMin(disp - planMin)} livres` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- F · Quatro semanas ----------

export function VistaQuatro({ c, irPara }: { c: Ctx; irPara: (semanas: number) => void }) {
  const { d, h } = c;
  const { alterar } = useLoja();
  const [aberta, setAberta] = useState(0);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [aplicado, setAplicado] = useState<{ antes: Posicao[]; folgas: string[]; msg: string } | null>(null);
  const fim = somarDias(c.inicio, 27);
  const mapa = plano(d, c.inicio, fim);
  const atual = d.sessao?.tarefaKey;
  const sim = marcados.length ? simularFolgas(d, marcados, agoraMin(), h) : null;
  const novo = new Map(sim?.colocadas.map((x) => [x.key, x.dia]));
  const chegando = new Map<string, TarefaNoDia[]>();
  for (const x of sim?.colocadas ?? [])
    for (const p of pedacosNoDia(d.tarefas.find((t) => t.key === x.key)!, x.partes)) chegando.set(p.plano!, [...(chegando.get(p.plano!) ?? []), p]);
  const mexidas = new Set(sim?.antes.map((a) => a.key));

  // Com simulação, cada tarefa mexida aparece no dia novo (ou some, se não couber).
  const doDia = (dia: string): TarefaNoDia[] => {
    if (!sim) return mapa.get(dia) ?? [];
    const ficam = (mapa.get(dia) ?? []).filter((t) => !mexidas.has(t.key));
    return [...ficam, ...(chegando.get(dia) ?? [])];
  };
  const mudou = (t: Tarefa) => !!sim && mexidas.has(t.key) && novo.get(t.key) !== t.plano;
  const nMudam = sim ? sim.antes.filter((a) => novo.get(a.key) !== a.plano).length : 0;

  const alternar = (dia: string) => {
    if (dia < h || ehFolga(d, dia) || !minutosDisponiveis(d, dia)) return;
    setAplicado(null);
    setMarcados(marcados.includes(dia) ? marcados.filter((x) => x !== dia) : [...marcados, dia]);
  };

  const aplicar = () => {
    if (!sim) return;
    alterar(`Sem estudo em ${sim.folgas.map((x) => dataCurta(x)).join(', ')}; ${sim.colocadas.length} tarefas replanejadas`, (x) => {
      x.folgas = [...new Set([...(x.folgas ?? []), ...sim.folgas])].sort();
      const pos = new Map(sim.colocadas.map((p) => [p.key, p]));
      for (const a of sim.antes) {
        const p = pos.get(a.key);
        colocar(x.tarefas.find((t) => t.key === a.key)!, p ?? null);
      }
    });
    setAplicado({ antes: sim.antes, folgas: sim.folgas, msg: `${nMudam} tarefas mudaram de dia. O plano agora vai até ${sim.fimDepois ? `${diaCurto(sim.fimDepois)} ${dataCurta(sim.fimDepois)}` : '—'}.` });
    setMarcados([]);
  };
  const desfazer = () => {
    if (!aplicado) return;
    const fs = new Set(aplicado.folgas);
    alterar('Imprevisto desfeito', (x) => {
      x.folgas = (x.folgas ?? []).filter((y) => !fs.has(y));
      for (const a of aplicado.antes) {
        const t = x.tarefas.find((y) => y.key === a.key);
        if (t && !t.feita) restaurar(t, a);
      }
    });
    setAplicado(null);
  };

  const semanas = [0, 1, 2, 3].map((w) => Array.from({ length: 7 }, (_, k) => somarDias(c.inicio, w * 7 + k)));
  const ultimoDia = (() => {
    let m: string | null = null;
    for (const t of d.tarefas) {
      const u = ultimoDiaDe(t);
      if (u && (!m || u > m)) m = u;
    }
    return m;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="quatro-imprevisto">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 320px' }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>Imprevisto</span>
          <span className="muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
            {aplicado ? aplicado.msg : sim
              ? `${sim.folgas.length} ${sim.folgas.length === 1 ? 'dia' : 'dias'} sem estudo: ${nMudam} tarefas andam para a frente, na mesma ordem (em amarelo tracejado). Feitas não mudam.`
              : 'Clique nos dias em que não vai estudar e veja o plano andar antes de confirmar.'}
          </span>
        </div>
        {sim && (
          <span className="mono" style={{ fontSize: 12 }}>
            fim: <s className="muted">{sim.fimAntes ? `${diaCurto(sim.fimAntes)} ${dataCurta(sim.fimAntes)}` : '—'}</s> → <b>{sim.fimDepois ? `${diaCurto(sim.fimDepois)} ${dataCurta(sim.fimDepois)}` : '—'}</b>
            {sim.semEspaco.length > 0 && ` · ${sim.semEspaco.length} sem horário`}
          </span>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {aplicado && <button type="button" className="btn btn-linha btn-peq" onClick={desfazer}>Desfazer</button>}
          {sim && <button type="button" className="btn btn-ink btn-peq" onClick={aplicar}>Replanejar {nMudam} tarefas</button>}
          {sim && <button type="button" className="btn btn-linha btn-peq" onClick={() => setMarcados([])}>Limpar</button>}
        </div>
      </section>

      <div className="quatro">
        <span />
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((x) => <span key={x} className="rotulo" style={{ padding: '0 4px 4px' }}>{x}</span>)}
        {semanas.map((ds, w) => {
          const horas = ds.reduce((s, dia) => s + doDia(dia).reduce((a, t) => a + dur(t), 0), 0);
          return (
            <div key={w} style={{ display: 'contents' }}>
              <button type="button" className={`quatro-semana${aberta === w ? ' on' : ''}`} onClick={() => setAberta(w)}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{w === 0 ? `${dataCurta(ds[0])}` : dataCurta(ds[0])}</span>
                <span className="mono muted" style={{ fontSize: 10 }}>{fmtMin(horas)}</span>
              </button>
              {ds.map((dia) => {
                const ts = doDia(dia);
                const folga = ehFolga(d, dia) || marcados.includes(dia);
                const disp = minutosDisponiveis(d, dia);
                const fimTrilha = ts.find((t) => (!t.parte || t.parte.i === t.parte.n - 1) && !d.tarefas.some((o) => o.trilha === t.trilha && o.key !== t.key && (o.num ?? 0) > (t.num ?? 0)));
                return (
                  <div
                    key={dia}
                    className={`quatro-dia${dia === h ? ' hoje' : ''}${folga ? ' folga' : ''}${dia < h ? ' passado' : !disp && !folga ? ' sem-agenda' : ''}${c.alvo === dia ? ' alvo' : ''}`}
                    onClick={() => alternar(dia)}
                    title={dia >= h && disp ? 'Clique para marcar ou desmarcar como sem estudo' : undefined}
                    {...c.zona(dia, dia >= h, (e) => c.soltar(e, dia))}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: dia === h ? 700 : 500, fontSize: 14 }}>{diaNum(dia)}{diaNum(dia) === '1' ? ' ' + dataCurta(dia).split(' ')[1] : ''}</span>
                      <span className="mono muted" style={{ fontSize: 9.5 }}>{folga ? 'imprevisto' : ts.length ? fmtMin(ts.reduce((s, t) => s + dur(t), 0)) : ''}</span>
                    </span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {ts.map((t) => (
                        <button
                          key={chaveBloco(t)}
                          type="button"
                          {...(t.feita ? {} : c.arrastavel(t, dia))}
                          onClick={(e) => { e.stopPropagation(); if (!t.feita) c.setSel(c.sel === t.key ? null : t.key); }}
                          className={`q quatro-q${t.feita ? ' feito' : ''}${t.key === atual ? ' agora' : ''}${mudou(t) ? ' mudou' : ''}${c.sel === t.key ? ' sel' : ''}${atrasada(t, h) ? ' atrasada' : ''}`}
                          style={{ background: !t.feita && t.key !== atual && !mudou(t) && t.trilha % 2 === 0 ? 'var(--mark-1)' : undefined }}
                          title={`${nomeBloco(t)} · ${nomeDisciplina(d, t)}${atrasada(t, h) ? ' · atrasada' : ''}`}
                          aria-label={`${rotulo(t)}, ${nomeDisciplina(d, t)}`}
                        />
                      ))}
                    </span>
                    {fimTrilha && <span className="muted" style={{ fontSize: 11 }}>fim da trilha {fimTrilha.trilha}</span>}
                    {ultimoDia === dia && !sim && <span style={{ fontSize: 11 }}>fim do plano</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="legenda-semana">
        <span><i className="q feito" />feita</span>
        <span><i className="q agora" />agora</span>
        <span><i className="q" />trilha ímpar</span>
        <span><i className="q" style={{ background: 'var(--mark-1)' }} />trilha par</span>
        <span><i className="q mudou" />muda de dia</span>
        <span><i className="q hachura" />sem estudo</span>
        <span className="muted" style={{ marginLeft: 'auto' }}>Clique num quadrado para mover a tarefa; arraste para outro dia.</span>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 16px' }}>
          <h2 className="sub" style={{ fontSize: 20 }}>Semana de {dataCurta(semanas[aberta][0])}</h2>
          <span className="muted" style={{ fontSize: 13 }}>dia a dia; arraste entre os dias ou para “A planejar”.</span>
          {aberta > 0 && <button type="button" className="btn btn-texto btn-peq" style={{ marginLeft: 'auto' }} onClick={() => irPara(aberta)}>Ir para esta semana →</button>}
        </div>
        <VistaFila c={c} inicio={semanas[aberta][0]} comPrevia={false} />
      </section>
    </div>
  );
}
