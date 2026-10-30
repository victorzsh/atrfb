import type { Dados, Tarefa } from './model';
import { aPlanejar, atrasada, colocar, encaixar, hoje, horarios, plano, replanejar, simularFolgas, somarDias } from './logica';

function tarefa(n: number, extra: Partial<Tarefa> = {}): Tarefa {
  return { key: `1:${n}`, trilha: 1, num: n, disciplina: 'PORTUGUÊS', descricao: '', chMin: 90, feita: false, data: null, chEfetivaMin: null, questoes: null, acertos: null, row: n, ...extra };
}

function dados(tarefas: Tarefa[]): Dados {
  return { versao: 1, atualizadoEm: '', minutosPorDia: 270, disciplinas: [], tarefas, sessao: null, notas: [] };
}

const nums = (m: Map<string, Tarefa[]>, dia: string) => (m.get(dia) ?? []).map((t) => t.num);

describe('plano da semana', () => {
  const h = hoje();
  const amanha = somarDias(h, 1);
  const ontem = somarDias(h, -1);

  it('só coloca nos dias o que foi planejado ou feito; nada é distribuído sozinho', () => {
    const d = dados([tarefa(1, { feita: true, data: ontem }), tarefa(2, { plano: amanha }), tarefa(3), tarefa(4)]);
    const p = plano(d, ontem, amanha);
    expect(nums(p, ontem)).toEqual([1]);
    expect(nums(p, h)).toEqual([]);
    expect(nums(p, amanha)).toEqual([2]);
    expect(aPlanejar(d).map((t) => t.num)).toEqual([3, 4]);
  });

  it('mover uma tarefa não mexe nas outras', () => {
    const d = dados([tarefa(1, { plano: h }), tarefa(2, { plano: h }), tarefa(3, { plano: h })]);
    d.tarefas[0].plano = amanha;
    const p = plano(d, h, amanha);
    expect(nums(p, h)).toEqual([2, 3]);
    expect(nums(p, amanha)).toEqual([1]);
  });

  it('a tarefa planejada para um dia que passou continua lá, atrasada', () => {
    const d = dados([tarefa(1, { plano: ontem })]);
    expect(nums(plano(d, ontem, h), ontem)).toEqual([1]);
    expect(atrasada(d.tarefas[0])).toBe(true);
    expect(aPlanejar(d)).toEqual([]);
  });
});

describe('encaixe na agenda', () => {
  const seg = '2026-11-02'; // uma segunda-feira no futuro
  const ter = '2026-11-03';
  const agenda = [[{ inicio: '08:00', fim: '11:00' }, { inicio: '14:00', fim: '17:00' }], [], [{ inicio: '19:00', fim: '20:00' }], [], [], [], []];
  const base = (ts: Tarefa[]) => ({ ...dados(ts), agenda });

  it('encaixa na ordem da trilha nos horários de cada dia e pula dias de folga', () => {
    const d = base([1, 2, 3, 4, 5].map((n) => tarefa(n)));
    const r = encaixar(d, d.tarefas.map((t) => t.key), seg, null, seg);
    expect(r.colocadas.map((c) => `${c.dia} ${c.hora}`)).toEqual([
      `${seg} 08:00`, `${seg} 09:30`, `${seg} 14:00`, `${seg} 15:30`, '2026-11-04 19:00',
    ]);
    // A 5ª tem 1h na quarta e continua na segunda seguinte.
    expect(r.colocadas[4].partes).toEqual([{ dia: '2026-11-04', hora: '19:00', min: 60 }, { dia: '2026-11-09', hora: '08:00', min: 30 }]);
    expect(r.colocadas.some((c) => c.dia === ter)).toBe(false);
  });

  it('a sobra da janela recebe o começo da próxima tarefa, que continua no próximo horário', () => {
    // Segunda 08:00–11:20 e 14:00–17:00: três de 1h30 → a terceira fica 20 min de manhã e 1h10 à tarde.
    const d = { ...dados([1, 2, 3].map((n) => tarefa(n))), agenda: [[{ inicio: '08:00', fim: '11:20' }, { inicio: '14:00', fim: '17:00' }], [], [], [], [], [], []] };
    const r = encaixar(d, d.tarefas.map((t) => t.key), seg, null, seg);
    expect(r.colocadas[2].partes).toEqual([{ dia: seg, hora: '11:00', min: 20 }, { dia: seg, hora: '14:00', min: 70 }]);
    for (const c of r.colocadas) colocar(d.tarefas.find((t) => t.key === c.key)!, c);
    const p = plano(d, seg, seg).get(seg)!;
    expect(p.map((t) => `${t.hora} ${t.num} ${t.chMin}`)).toEqual(['08:00 1 90', '09:30 2 90', '11:00 3 20', '14:00 3 70']);
    expect(p[3].parte).toEqual({ i: 1, n: 2 });
  });

  it('sobra menor que 15 min fica livre; tarefa já dividida ocupa os pedaços dela', () => {
    const d = { ...dados([tarefa(1, { chMin: 170 }), tarefa(2)]), agenda: [[{ inicio: '08:00', fim: '11:00' }], [{ inicio: '08:00', fim: '11:00' }], [], [], [], [], []] };
    const r = encaixar(d, ['1:1', '1:2'], seg, null, seg);
    expect(r.colocadas[1].partes).toEqual([{ dia: ter, hora: '08:00', min: 90 }]);
    colocar(d.tarefas[0], { dia: seg, hora: '08:00', partes: [{ dia: seg, hora: '08:00', min: 100 }, { dia: ter, hora: '08:00', min: 70 }] });
    expect(encaixar(d, ['1:2'], seg, null, seg).colocadas[0].partes).toEqual([{ dia: seg, hora: '09:40', min: 80 }, { dia: ter, hora: '09:10', min: 10 }]);
  });

  it('não usa horário já ocupado e nunca mexe nas tarefas que já têm dia', () => {
    const d = base([tarefa(1, { plano: seg, hora: '08:00' }), tarefa(2), tarefa(3)]);
    const r = encaixar(d, ['1:2', '1:3'], seg, null, seg);
    expect(r.colocadas.map((c) => c.hora)).toEqual(['09:30', '14:00']);
    expect(r.colocadas.some((c) => c.key === '1:1')).toBe(false);
  });

  it('hoje, só depois da hora atual', () => {
    const d = base([tarefa(1)]);
    const r = encaixar(d, ['1:1'], seg, 9 * 60, seg);
    expect(r.colocadas[0]).toMatchObject({ dia: seg, hora: '09:00' });
  });

  it('tarefa maior que qualquer janela é dividida; sem agenda nenhuma, avisa', () => {
    const d = base([tarefa(1, { chMin: 240 })]);
    expect(encaixar(d, ['1:1'], seg, null, seg).colocadas[0].partes).toEqual([{ dia: seg, hora: '08:00', min: 180 }, { dia: seg, hora: '14:00', min: 60 }]);
    expect(encaixar(dados([tarefa(1)]), ['1:1'], seg, null, seg).semEspaco).toEqual(['1:1']);
  });
});

describe('replanejar depois de um imprevisto', () => {
  const seg = '2026-11-02';
  const qua = '2026-11-04';
  const manha = [{ inicio: '08:00', fim: '11:00' }];
  const tarde = [{ inicio: '14:00', fim: '15:30' }];
  const semana = (dia: typeof manha) => [dia, dia, dia, dia, dia, [], []];

  it('concluídas e o que vem antes da data não mudam; o resto vai para os horários novos, na mesma ordem', () => {
    const d = { ...dados([
      tarefa(1, { feita: true, data: seg }),
      tarefa(2, { plano: seg, hora: '09:30' }),
      tarefa(3, { plano: qua, hora: '08:00' }),
      tarefa(4, { plano: qua, hora: '09:30' }),
      tarefa(5, { plano: '2026-11-05', hora: '08:00' }),
      tarefa(6),
    ]), agenda: semana(tarde) };
    const r = replanejar(d, qua, false, null, seg);
    expect(r.colocadas.map((c) => `${c.key} ${c.dia} ${c.hora}`)).toEqual([
      `1:3 ${qua} 14:00`, '1:4 2026-11-05 14:00', '1:5 2026-11-06 14:00',
    ]);
    expect(r.antes.map((a) => a.key)).toEqual(['1:3', '1:4', '1:5']);
  });

  it('respeita a ordem que você arrumou, mesmo fora da ordem da trilha', () => {
    const d = { ...dados([tarefa(1, { plano: qua, hora: '09:30' }), tarefa(2, { plano: qua, hora: '08:00' })]), agenda: semana(tarde) };
    expect(replanejar(d, qua, false, null, seg).colocadas.map((c) => c.key)).toEqual(['1:2', '1:1']);
  });

  it('dia de imprevisto fica vazio e as atrasadas entram se você pedir', () => {
    const d = { ...dados([tarefa(1, { plano: seg, hora: '08:00' }), tarefa(2, { plano: qua, hora: '08:00' })]), agenda: semana(manha), folgas: [qua] };
    const sem = replanejar(d, qua, false, null, '2026-11-03');
    expect(sem.colocadas.map((c) => `${c.key} ${c.dia}`)).toEqual(['1:2 2026-11-05']);
    const com = replanejar(d, qua, true, null, '2026-11-03');
    expect(com.colocadas.map((c) => `${c.key} ${c.dia} ${c.hora}`)).toEqual(['1:1 2026-11-05 08:00', '1:2 2026-11-05 09:30']);
  });
});

describe('vistas da semana', () => {
  const seg = '2026-11-02';
  const ter = '2026-11-03';
  const qua = '2026-11-04';
  const agenda = [[{ inicio: '08:00', fim: '11:00' }, { inicio: '14:00', fim: '17:00' }], [{ inicio: '08:00', fim: '11:00' }], [{ inicio: '08:00', fim: '11:00' }], [], [], [], []];

  it('horário: quem tem hora fica nela; o resto ocupa os vãos a partir do começo da agenda', () => {
    const d = { ...dados([tarefa(1, { feita: true, data: seg, chEfetivaMin: 60 }), tarefa(2, { plano: seg, hora: '08:30' }), tarefa(3, { plano: seg })]), agenda };
    const p = horarios(d, seg, plano(d, seg, seg).get(seg)!);
    expect(p.map((x) => `${x.t.num} ${x.ini}-${x.fim}`)).toEqual(['2 510-600', '1 600-660', '3 660-750']);
  });

  it('simular imprevisto não altera os dados e mostra o novo fim do plano', () => {
    const d = { ...dados([tarefa(1, { plano: seg, hora: '08:00' }), tarefa(2, { plano: ter, hora: '08:00' }), tarefa(3, { plano: qua, hora: '08:00' })]), agenda };
    const s = simularFolgas(d, [ter], null, seg)!;
    expect(s.folgas).toEqual([ter]);
    expect(s.colocadas.map((c) => `${c.key} ${c.dia}`)).toEqual([`1:2 ${qua}`, `1:3 ${qua}`]);
    expect(s.fimAntes).toBe(qua);
    expect(s.fimDepois).toBe(qua);
    expect(d.folgas).toBeUndefined();
    expect(d.tarefas[1].plano).toBe(ter);
    expect(simularFolgas(d, ['2026-11-01'], null, seg)).toBeNull();
  });
});
