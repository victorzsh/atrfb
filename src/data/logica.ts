import type { Dados, Disciplina, Tarefa } from './model';
import { normalizar } from './model';
import type { Leitura } from '../xlsx/planilha';

// ---------- datas ----------

export function hoje(): string {
  return isoLocal(new Date());
}

export function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deIso(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function somarDias(iso: string, n: number): string {
  const d = deIso(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

export function segundaDaSemana(iso: string): string {
  const d = deIso(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  return somarDias(iso, -dow);
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function diaCurto(iso: string): string {
  return DIAS[deIso(iso).getDay()];
}

export function dataCurta(iso: string): string {
  const d = deIso(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

// ---------- horas ----------

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function fmtRelogio(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

// "1h45", "1:45", "105", "1h" -> minutos
export function lerMin(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\s/g, '');
  if (!t) return null;
  let m = /^(\d+)h(\d{1,2})?m?(in)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+)(m|min)?$/.exec(t);
  if (m) return Number(m[1]);
  return null;
}

export function pct(acertos: number, total: number): number {
  return total > 0 ? Math.round((acertos / total) * 100) : 0;
}

// ---------- tarefas ----------

export function rotulo(t: Tarefa): string {
  return t.num === null ? 'EXTRA' : `T-${t.num}`;
}

export function ordenadas(d: Dados): Tarefa[] {
  return [...d.tarefas].sort((a, b) => a.trilha - b.trilha || a.row - b.row);
}

export function pendentes(d: Dados): Tarefa[] {
  return ordenadas(d).filter((t) => !t.feita);
}

export function trilhas(d: Dados): number[] {
  return [...new Set(d.tarefas.map((t) => t.trilha))].sort((a, b) => a - b);
}

export function tarefa(d: Dados, key: string): Tarefa | undefined {
  return d.tarefas.find((t) => t.key === key);
}

// A disciplina da aba MAPA que corresponde à disciplina de uma tarefa do CICLO
// ("CONTABILIDADE GERAL" -> "CONTABILIDADE GERAL E AVANÇADA").
export function disciplinaDaTarefa(d: Dados, t: Tarefa): Disciplina | undefined {
  const n = normalizar(t.disciplina);
  let melhor: Disciplina | undefined;
  for (const disc of d.disciplinas) {
    if (disc.key === n) return disc;
    if (disc.key.startsWith(n) || n.startsWith(disc.key)) {
      if (!melhor || disc.key.length > melhor.key.length) melhor = disc;
    }
  }
  return melhor;
}

export function nomeDisciplina(d: Dados, t: Tarefa): string {
  if (normalizar(t.disciplina) === 'LIMPE OS ERROS') return 'Limpe os erros';
  return disciplinaDaTarefa(d, t)?.nome ?? t.disciplina.charAt(0) + t.disciplina.slice(1).toLowerCase();
}

export function ehRevisao(t: Tarefa): boolean {
  return /revis/i.test(t.descricao);
}

export function proximaAula(disc: Disciplina): number | null {
  return disc.aulas.find((a) => !a.tr)?.n ?? null;
}

// Plano: tarefas feitas em cada dia e as pendentes distribuídas pela meta diária,
// a partir de hoje.
export function plano(d: Dados, desde: string, ate: string): Map<string, Tarefa[]> {
  const dias = new Map<string, Tarefa[]>();
  for (let x = desde; x <= ate; x = somarDias(x, 1)) dias.set(x, []);
  for (const t of ordenadas(d)) if (t.feita && t.data && dias.has(t.data)) dias.get(t.data)!.push(t);

  const h = hoje();
  let dia = h;
  let usado = (dias.get(h) ?? []).reduce((s, t) => s + (t.chEfetivaMin ?? t.chMin), 0);
  for (const t of pendentes(d)) {
    while (usado > 0 && usado + t.chMin > d.minutosPorDia + 15) {
      dia = somarDias(dia, 1);
      usado = 0;
    }
    if (dia > ate) break;
    if (dias.has(dia)) dias.get(dia)!.push(t);
    usado += t.chMin;
  }
  return dias;
}

export function planoDeHoje(d: Dados): Tarefa[] {
  const h = hoje();
  return plano(d, h, h).get(h) ?? [];
}

// ---------- mapa ----------

export function contagemMapa(d: Dados) {
  let feitas = 0;
  let total = 0;
  for (const disc of d.disciplinas) {
    total += disc.aulas.length;
    feitas += disc.aulas.filter((a) => a.tr).length;
  }
  return { feitas, total };
}

// ---------- importação ----------

// Junta uma planilha lida com os dados que já existem: o que o aluno já
// registrou no app vence; o que é novo na planilha entra.
export function juntar(atual: Dados | null, lida: Leitura): Dados {
  const base: Dados = atual ?? {
    versao: 1,
    atualizadoEm: new Date().toISOString(),
    minutosPorDia: 270,
    disciplinas: [],
    tarefas: [],
    sessao: null,
    notas: [],
  };
  const discAtuais = new Map(base.disciplinas.map((x) => [x.key, x]));
  const disciplinas = lida.disciplinas.map((nova) => {
    const velha = discAtuais.get(nova.key);
    if (!velha) return nova;
    const aulasVelhas = new Map(velha.aulas.map((a) => [a.n, a]));
    return { ...nova, aulas: nova.aulas.map((a) => ({ ...(aulasVelhas.get(a.n) ?? a), row: a.row })) };
  });
  const tarefasAtuais = new Map(base.tarefas.map((t) => [t.key, t]));
  const tarefas = lida.tarefas.map((nova) => {
    const velha = tarefasAtuais.get(nova.key);
    return velha ? { ...nova, feita: velha.feita, data: velha.data, chEfetivaMin: velha.chEfetivaMin, questoes: velha.questoes, acertos: velha.acertos } : nova;
  });
  // Tarefas que só existem no app (planilha antiga) continuam.
  for (const t of base.tarefas) if (!tarefas.some((x) => x.key === t.key)) tarefas.push(t);
  return { ...base, disciplinas, tarefas };
}

export function trilhasNovas(atual: Dados | null, lida: Leitura): number[] {
  const tem = new Set(atual?.tarefas.map((t) => t.trilha) ?? []);
  return [...new Set(lida.tarefas.map((t) => t.trilha))].filter((n) => !tem.has(n)).sort((a, b) => a - b);
}
