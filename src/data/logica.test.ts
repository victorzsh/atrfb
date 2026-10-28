import type { Dados, Tarefa } from './model';
import { hoje, plano, somarDias } from './logica';

function tarefa(n: number, extra: Partial<Tarefa> = {}): Tarefa {
  return { key: `1:${n}`, trilha: 1, num: n, disciplina: 'PORTUGUÊS', descricao: '', chMin: 90, feita: false, data: null, chEfetivaMin: null, questoes: null, acertos: null, row: n, ...extra };
}

function dados(tarefas: Tarefa[]): Dados {
  return { versao: 1, atualizadoEm: '', minutosPorDia: 270, disciplinas: [], tarefas, sessao: null, notas: [] };
}

const chaves = (m: Map<string, Tarefa[]>, dia: string) => (m.get(dia) ?? []).map((t) => t.num);

describe('plano da semana', () => {
  const h = hoje();
  const amanha = somarDias(h, 1);
  const depois = somarDias(h, 2);

  it('distribui pela meta diária, na ordem da trilha', () => {
    const p = plano(dados([1, 2, 3, 4, 5, 6, 7].map((n) => tarefa(n))), h, depois);
    expect(chaves(p, h)).toEqual([1, 2, 3]);
    expect(chaves(p, amanha)).toEqual([4, 5, 6]);
    expect(chaves(p, depois)).toEqual([7]);
  });

  it('mantém a tarefa no dia em que foi fixada e o resto ocupa o espaço que sobra', () => {
    const p = plano(dados([tarefa(1), tarefa(2), tarefa(3), tarefa(4), tarefa(5, { plano: h }), tarefa(6)]), h, depois);
    expect(chaves(p, h)).toEqual([1, 2, 5]);
    expect(chaves(p, amanha)).toEqual([3, 4, 6]);
  });

  it('ignora o dia fixado que já passou', () => {
    const p = plano(dados([tarefa(1, { plano: somarDias(h, -3) }), tarefa(2)]), h, h);
    expect(chaves(p, h)).toEqual([1, 2]);
  });

  it('um dia cheio de fixadas empurra as automáticas para frente', () => {
    const p = plano(dados([tarefa(1), tarefa(2, { plano: h }), tarefa(3, { plano: h }), tarefa(4, { plano: h })]), h, amanha);
    expect(chaves(p, h)).toEqual([2, 3, 4]);
    expect(chaves(p, amanha)).toEqual([1]);
  });
});
