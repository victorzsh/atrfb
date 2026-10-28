import type { Aula, Disciplina, Tarefa } from '../data/model';
import { normalizar } from '../data/model';
import { nomeBonito, prova } from '../data/config';
import { abrir, acharAba, colParaNum, escrever, gerar, linhas, numParaCol, numero, texto, type Aba } from './sheet';

// Converte a planilha de controle da Estratégia (abas MAPA e CICLO)
// no modelo do app, e de volta.

export interface Leitura {
  disciplinas: Disciplina[];
  tarefas: Tarefa[];
}

const DIA_MIN = 24 * 60;

export function serialParaData(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function dataParaSerial(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

function lerMapa(aba: Aba): Disciplina[] {
  const rows = linhas(aba);
  const titulo = rows.find((r) => texto(aba, 'B' + r).toUpperCase().startsWith('MATÉRIAS TRABALHADAS'));
  if (titulo === undefined) throw new Error('Não achei a lista de matérias na aba MAPA.');

  const out: Disciplina[] = [];
  for (const r of rows.filter((x) => x > titulo)) {
    const nome = texto(aba, 'B' + r);
    if (!nome) continue;
    if (nome.toUpperCase().startsWith('TOTAL')) break;
    // A coluna F aponta para a célula "MÉDIA" do bloco da disciplina (ex.: =B67).
    const m = /^\s*\$?([A-Z]+)\$?(\d+)\s*$/.exec(aba.celulas.get('F' + r)?.formula ?? '');
    if (!m) continue;
    const trCol = m[1];
    const qtdAulas = numero(aba, 'E' + r);
    const mediaRow = Number(m[2]);
    const capCol = numParaCol(colParaNum(trCol) - 1);
    const qtdCol = numParaCol(colParaNum(trCol) + 1);
    const acCol = numParaCol(colParaNum(trCol) + 2);

    let cabecalho = mediaRow - 1;
    while (cabecalho > titulo && !texto(aba, capCol + cabecalho).toUpperCase().startsWith('CAPÍTULOS')) cabecalho--;

    const aulas: Aula[] = [];
    for (let row = cabecalho + 1; row < mediaRow; row++) {
      const n = numero(aba, capCol + row);
      if (n === null || (qtdAulas !== null && n > qtdAulas)) continue;
      aulas.push({
        n,
        row,
        tr: texto(aba, trCol + row).toUpperCase() === 'SIM',
        qtd: numero(aba, qtdCol + row),
        acertos: numero(aba, acCol + row),
      });
    }
    const p = prova(nome);
    out.push({ key: normalizar(nome), nome: nomeBonito(nome), nomeOriginal: nome.trim(), modulo: p.modulo, questoes: p.questoes, trCol, aulas });
  }
  return out;
}

function lerCiclo(aba: Aba): Tarefa[] {
  const out: Tarefa[] = [];
  let trilha: number | null = null;
  for (const r of linhas(aba)) {
    const a = texto(aba, 'A' + r);
    const mt = /^TRILHA\s*(\d+)/i.exec(a);
    if (mt) trilha = Number(mt[1]);
    if (trilha === null) continue;
    const c = texto(aba, 'C' + r);
    const disciplina = texto(aba, 'D' + r);
    if (!c || !disciplina || c.toUpperCase() === 'TAREFA') continue;
    const extra = c.toUpperCase() === 'EXTRA';
    const num = extra ? null : numero(aba, 'C' + r);
    if (!extra && num === null) continue;
    const ch = numero(aba, 'E' + r);
    const efetiva = numero(aba, 'F' + r);
    const serial = numero(aba, 'B' + r);
    const questoes = numero(aba, 'I' + r);
    const acertos = numero(aba, 'J' + r);
    const data = serial !== null && serial > 30000 ? serialParaData(serial) : null;
    const chEfetivaMin = efetiva !== null && efetiva > 0 ? Math.round(efetiva * DIA_MIN) : null;
    out.push({
      key: `${trilha}:${extra ? 'EXTRA' : num}`,
      trilha,
      num,
      disciplina,
      descricao: texto(aba, 'H' + r),
      chMin: ch !== null ? Math.round(ch * DIA_MIN) : 90,
      feita: data !== null || chEfetivaMin !== null || questoes !== null,
      data,
      chEfetivaMin,
      questoes,
      acertos,
      row: r,
    });
  }
  return out;
}

export async function lerPlanilha(buf: ArrayBuffer | Uint8Array): Promise<Leitura> {
  const p = await abrir(buf);
  return { disciplinas: lerMapa(acharAba(p, 'MAPA')), tarefas: lerCiclo(acharAba(p, 'CICLO')) };
}

// Escreve o progresso do app na planilha original e devolve o arquivo novo.
// Só toca nas colunas de preenchimento do aluno; o resto fica intacto.
export async function exportarPlanilha(original: ArrayBuffer | Uint8Array, disciplinas: Disciplina[], tarefas: Tarefa[]): Promise<Uint8Array> {
  const p = await abrir(original);
  const mapa = acharAba(p, 'MAPA');
  const ciclo = acharAba(p, 'CICLO');
  const layout = await lerPlanilha(original);

  const discs = new Map(layout.disciplinas.map((d) => [d.key, d]));
  for (const d of disciplinas) {
    const alvo = discs.get(d.key);
    if (!alvo) continue;
    const linhaDa = new Map(alvo.aulas.map((a) => [a.n, a.row]));
    const qtdCol = numParaCol(colParaNum(alvo.trCol) + 1);
    const acCol = numParaCol(colParaNum(alvo.trCol) + 2);
    for (const a of d.aulas) {
      const row = linhaDa.get(a.n);
      if (!row) continue;
      escrever(mapa, alvo.trCol + row, a.tr ? 'SIM' : null);
      escrever(mapa, qtdCol + row, a.qtd);
      escrever(mapa, acCol + row, a.acertos);
    }
  }

  const linhaDaTarefa = new Map(layout.tarefas.map((t) => [t.key, t.row]));
  for (const t of tarefas) {
    const row = linhaDaTarefa.get(t.key);
    if (!row) continue;
    escrever(ciclo, 'B' + row, t.data ? dataParaSerial(t.data) : null);
    escrever(ciclo, 'F' + row, t.chEfetivaMin !== null ? t.chEfetivaMin / DIA_MIN : null);
    escrever(ciclo, 'I' + row, t.questoes);
    escrever(ciclo, 'J' + row, t.acertos);
  }
  return gerar(p);
}
