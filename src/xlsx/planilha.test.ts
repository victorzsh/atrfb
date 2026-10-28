import { existsSync, readFileSync } from 'node:fs';
import { exportarPlanilha, lerPlanilha } from './planilha';

const ARQUIVO = 'fixtures/planilha.xlsx';
const temArquivo = existsSync(ARQUIVO);

describe.skipIf(!temArquivo)('planilha da Estratégia', () => {
  const buf = () => new Uint8Array(readFileSync(ARQUIVO));

  it('lê as disciplinas do MAPA com as aulas e o T+R', async () => {
    const { disciplinas } = await lerPlanilha(buf());
    expect(disciplinas).toHaveLength(21);
    const dc = disciplinas.find((d) => d.key === 'DIREITO CONSTITUCIONAL')!;
    expect(dc.nome).toBe('Direito Constitucional');
    expect(dc.aulas).toHaveLength(22);
    expect(dc.aulas.filter((a) => a.tr)).toHaveLength(4);
    expect(dc.questoes).toBe(14);
    const total = disciplinas.reduce((s, d) => s + d.aulas.length, 0);
    expect(total).toBe(286);
  });

  it('lê as tarefas do CICLO, trilha a trilha', async () => {
    const { tarefas } = await lerPlanilha(buf());
    expect(new Set(tarefas.map((t) => t.trilha))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(tarefas).toHaveLength(126);
    const t24 = tarefas.find((t) => t.key === '1:24')!;
    expect(t24.disciplina).toBe('LEGISLAÇÃO ADUANEIRA');
    expect(t24.chMin).toBe(90);
    expect(tarefas.find((t) => t.key === '0:EXTRA')!.chMin).toBe(150);
  });

  it('exporta e lê de volta o que foi preenchido', async () => {
    const lido = await lerPlanilha(buf());
    const dc = lido.disciplinas.find((d) => d.key === 'DIREITO TRIBUTARIO')!;
    dc.aulas[7].tr = true;
    dc.aulas[7].qtd = 25;
    dc.aulas[7].acertos = 19;
    const t = lido.tarefas.find((x) => x.key === '1:24')!;
    Object.assign(t, { data: '2026-10-28', chEfetivaMin: 105, questoes: 25, acertos: 19 });

    const blob = await exportarPlanilha(buf(), lido.disciplinas, lido.tarefas);
    const volta = await lerPlanilha(blob);
    const dc2 = volta.disciplinas.find((d) => d.key === 'DIREITO TRIBUTARIO')!;
    expect(dc2.aulas[7]).toMatchObject({ tr: true, qtd: 25, acertos: 19 });
    expect(volta.tarefas.find((x) => x.key === '1:24')).toMatchObject({ data: '2026-10-28', chEfetivaMin: 105, questoes: 25, acertos: 19, feita: true });
    expect(volta.disciplinas.reduce((s, d) => s + d.aulas.filter((a) => a.tr).length, 0)).toBe(
      lido.disciplinas.reduce((s, d) => s + d.aulas.filter((a) => a.tr).length, 0),
    );
  });
});
