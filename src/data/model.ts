// Formato do arquivo dados.json salvo no GitHub.

export interface Aula {
  n: number;
  tr: boolean; // teoria + revisão ("SIM" na coluna T+R)
  qtd: number | null;
  acertos: number | null;
  row: number; // linha na aba MAPA da planilha
}

export interface Disciplina {
  key: string; // nome normalizado, estável entre planilhas
  nome: string; // nome para exibir
  nomeOriginal: string; // como está na planilha
  modulo: 0 | 1 | 2; // 0 = complementar
  questoes: number | null; // questões na prova (último edital)
  trCol: string; // coluna T+R do bloco na aba MAPA
  aulas: Aula[];
}

export interface Tarefa {
  key: string; // "1:24" ou "1:EXTRA"
  trilha: number;
  num: number | null; // null = EXTRA (limpe os erros)
  disciplina: string; // como está na aba CICLO
  descricao: string;
  chMin: number; // carga horária proposta, em minutos
  feita: boolean;
  data: string | null; // AAAA-MM-DD
  chEfetivaMin: number | null;
  questoes: number | null;
  acertos: number | null;
  row: number; // linha na aba CICLO
  plano?: string | null; // dia em que você colocou a tarefa na Semana (AAAA-MM-DD)
  hora?: string | null; // início no dia ("08:00"), quando encaixada na agenda
}

// Horários de estudo de um dia da semana, ex.: [{ inicio: '08:00', fim: '11:00' }].
export interface Intervalo {
  inicio: string;
  fim: string;
}

export interface Sessao {
  tarefaKey: string;
  acumuladoMs: number;
  rodandoDesde: number | null;
}

export interface Nota {
  tarefaKey: string;
  texto: string;
  em: string;
}

export interface Dados {
  versao: 1;
  atualizadoEm: string;
  minutosPorDia: number; // não usado mais; mantido para dados antigos
  agenda?: Intervalo[][]; // 7 dias, 0 = segunda
  disciplinas: Disciplina[];
  tarefas: Tarefa[];
  sessao: Sessao | null;
  notas: Nota[];
}

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}
