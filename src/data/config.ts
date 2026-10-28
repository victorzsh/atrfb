import { normalizar } from './model';

// Estrutura da prova pelo último edital (MAPA_AT, colunas K a O).
// Disciplinas sem número de questões próprio entram no módulo, sem peso.
const PROVA: Record<string, { modulo: 1 | 2; questoes: number | null }> = {
  'PORTUGUES': { modulo: 1, questoes: 15 },
  'LINGUA INGLESA': { modulo: 1, questoes: 10 },
  'RACIOCINIO LOGICO MATEMATICO': { modulo: 1, questoes: 10 },
  'ESTATISTICA': { modulo: 1, questoes: null },
  'CONTABILIDADE GERAL E AVANCADA': { modulo: 1, questoes: 10 },
  'ADMINISTRACAO GERAL': { modulo: 1, questoes: 10 },
  'ADMINISTRACAO PUBLICA': { modulo: 1, questoes: null },
  'FLUENCIA EM DADOS': { modulo: 1, questoes: 15 },
  'DIREITO CONSTITUCIONAL': { modulo: 2, questoes: 14 },
  'DIREITO ADMINISTRATIVO': { modulo: 2, questoes: 12 },
  'DIREITO TRIBUTARIO': { modulo: 2, questoes: 16 },
  'D TRIBUTARIO JURISPRUDENCIAL': { modulo: 2, questoes: null },
  'DIREITO PREVIDENCIARIO': { modulo: 2, questoes: null },
  'LEGISLACAO TRIBUTARIA': { modulo: 2, questoes: 14 },
  'LEGISLACAO ADUANEIRA': { modulo: 2, questoes: 14 },
  'REFORMA TRIBUTARIA EC 132': { modulo: 2, questoes: null },
  'REFORMA TRIBUTARIA LC 227': { modulo: 2, questoes: null },
};

export function prova(nomeOriginal: string) {
  return PROVA[normalizar(nomeOriginal)] ?? { modulo: 0 as const, questoes: null };
}

export const MODULOS: Record<number, string> = {
  1: 'Módulo I — Conhecimentos gerais',
  2: 'Módulo II — Conhecimentos específicos',
  0: 'Complementares',
};

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']);

// "DIREITO CONSTITUCIONAL" -> "Direito Constitucional"; "(EC 132)" fica como está.
export function nomeBonito(s: string): string {
  return s
    .trim()
    .split(/(\([^)]*\))/)
    .map((parte) => {
      if (parte.startsWith('(')) return parte;
      return parte
        .toLowerCase()
        .replace(/[\p{L}]+/gu, (w, i: number) => (i > 0 && MINUSCULAS.has(w) ? w : w[0].toUpperCase() + w.slice(1)));
    })
    .join('');
}

const SIGLAS: Record<string, string> = {
  'ORIENTACOES DE ESTUDO': 'OR',
  'DIREITO CONSTITUCIONAL': 'DC',
  'DIREITO ADMINISTRATIVO': 'DA',
  'DIREITO TRIBUTARIO': 'DT',
  'CONTABILIDADE GERAL': 'CG',
  'PORTUGUES': 'PT',
  'LINGUA INGLESA': 'IN',
  'FLUENCIA EM DADOS': 'FD',
  'LEGISLACAO ADUANEIRA': 'LA',
  'LEGISLACAO TRIBUTARIA FEDERAL': 'LT',
  'LIMPE OS ERROS': 'LE',
};

export function sigla(disciplina: string): string {
  const n = normalizar(disciplina);
  if (SIGLAS[n]) return SIGLAS[n];
  const palavras = n.split(' ').filter((w) => w.length > 2);
  return (palavras.length > 1 ? palavras[0][0] + palavras[1][0] : n.slice(0, 2)) || '??';
}
