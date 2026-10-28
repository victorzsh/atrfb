import { useState } from 'react';
import { useLoja } from '../data/store';
import { sigla } from '../data/config';
import { juntar, trilhasNovas } from '../data/logica';
import { lerPlanilha, type Leitura } from '../xlsx/planilha';
import { Shell } from './Shell';
import { ir, link } from './rota';

interface Lido {
  nome: string;
  bytes: Uint8Array;
  leitura: Leitura;
  novas: number[];
}

export function Importar({ primeira }: { primeira?: boolean }) {
  const { dados, substituir, salvarPlanilha, desbloquear } = useLoja();
  const [lido, setLido] = useState<Lido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const abrir = async (f: File | undefined) => {
    if (!f) return;
    setErro(null);
    setLido(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const leitura = await lerPlanilha(bytes);
      if (!leitura.disciplinas.length || !leitura.tarefas.length) throw new Error('Não achei disciplinas ou tarefas nesta planilha.');
      setLido({ nome: f.name, bytes, leitura, novas: trilhasNovas(dados, leitura) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo.');
    }
  };

  const confirmar = async () => {
    if (!lido) return;
    if (!(await desbloquear(primeira ? 'Antes de começar, defina a senha do app.' : 'Para adicionar a trilha.'))) return;
    setOcupado(true);
    const msg = primeira
      ? 'Importação da planilha original'
      : lido.novas.length
        ? `${lido.novas.map((n) => `Trilha ${n}`).join(', ')} adicionada${lido.novas.length > 1 ? 's' : ''}`
        : 'Planilha da Estratégia atualizada';
    try {
      substituir(juntar(dados, lido.leitura), msg);
      await salvarPlanilha(lido.bytes, `Planilha da Estratégia: ${lido.nome}`);
      ir(primeira ? '' : 'ciclo');
    } catch (e) {
      setErro('Os dados foram atualizados, mas a planilha não foi enviada ao GitHub: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setOcupado(false);
    }
  };

  const l = lido?.leitura;
  const aulas = l ? l.disciplinas.reduce((s, d) => s + d.aulas.length, 0) : 0;
  const aulasFeitas = l ? l.disciplinas.reduce((s, d) => s + d.aulas.filter((a) => a.tr).length, 0) : 0;
  const trilhasLidas = l ? [...new Set(l.tarefas.map((t) => t.trilha))] : [];

  return (
    <Shell secao="ciclo">
      <div className="miolo" style={{ maxWidth: 1196 }}>
        {!primeira && (
          <a href={link('ciclo')} style={{ textDecoration: 'none', color: 'var(--muted)', fontSize: 14 }}>← Ciclo</a>
        )}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="titulo">{primeira ? 'Comece pela sua planilha' : 'Nova trilha da semana'}</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, maxWidth: 680, color: 'var(--text2)' }}>
            {primeira
              ? 'Solte aqui a Planilha de Controle da Estratégia (.xlsx). O app lê as abas MAPA e CICLO, com o que você já tiver preenchido, e passa a cuidar dela por você.'
              : 'Baixe a planilha nova da Estratégia e solte aqui. Só o que é novo entra; o que você já registrou não é tocado.'}
          </p>
        </section>

        <label
          className={`soltar${sobre ? ' sobre' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setSobre(true);
          }}
          onDragLeave={() => setSobre(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSobre(false);
            void abrir(e.dataTransfer.files[0]);
          }}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ width: 14, height: 14, background: lido ? 'var(--ink)' : 'transparent', border: '1px solid var(--ink)' }} />
          <span className="mono" style={{ fontSize: 13 }}>{lido ? lido.nome : 'Arraste o .xlsx aqui ou clique para escolher'}</span>
          {lido && <span className="muted" style={{ marginLeft: 'auto', fontSize: 14 }}>lida: abas MAPA e CICLO</span>}
          <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => void abrir(e.target.files?.[0])} />
        </label>
        {erro && <p className="erro-txt" style={{ margin: 0 }}>{erro}</p>}

        {l && primeira && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '2px solid var(--ink)', paddingTop: 22 }}>
            <h2 className="sub" style={{ fontSize: 28 }}>Tudo certo com a planilha</h2>
            <span style={{ fontSize: 16, lineHeight: 1.6 }}>
              {l.disciplinas.length} disciplinas e {aulas} aulas no Mapa ({aulasFeitas} já com teoria + revisão).<br />
              {trilhasLidas.length} trilhas no Ciclo ({trilhasLidas.join(', ')}), com {l.tarefas.length} tarefas.
            </span>
          </section>
        )}

        {l && !primeira && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 18, borderTop: '2px solid var(--ink)', paddingTop: 22 }}>
            {lido!.novas.length === 0 ? (
              <>
                <h2 className="sub" style={{ fontSize: 28 }}>Nenhuma trilha nova</h2>
                <span style={{ fontSize: 15, color: 'var(--text2)' }}>
                  Esta planilha tem as trilhas {trilhasLidas.join(', ')}, que você já tem. Você pode atualizar mesmo assim: descrições e aulas novas entram, seus registros ficam.
                </span>
              </>
            ) : (
              lido!.novas.map((n) => {
                const ts = l.tarefas.filter((t) => t.trilha === n);
                const ch = ts.reduce((s, t) => s + t.chMin, 0);
                return (
                  <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px 32px' }}>
                      <h2 className="sub" style={{ fontSize: 28 }}>Trilha {n}</h2>
                      <span className="rotulo">{ts.length} tarefas · {Math.floor(ch / 60)}h{String(ch % 60).padStart(2, '0')}</span>
                    </div>
                    <div className="ciclo-tiles" style={{ ['--n' as string]: ts.length + 1 }}>
                      {ts.map((t) => (
                        <span key={t.key} className={`tile${t.num === null ? ' extra' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--ink)' }} title={t.descricao}>
                          {sigla(t.disciplina)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        {l && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button type="button" className="btn btn-ink" disabled={ocupado} onClick={() => void confirmar()}>
              {primeira ? 'Começar' : lido!.novas.length ? `Adicionar ${lido!.novas.map((n) => `Trilha ${n}`).join(' e ')}` : 'Atualizar mesmo assim'}
            </button>
            {!primeira && <a className="btn btn-texto" href={link('ciclo')}>Cancelar</a>}
          </div>
        )}

        {primeira && !l && (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Já usa o app em outro aparelho? <a href={link('dados')}>Conecte o seu repositório do GitHub</a> para trazer seus dados.
          </p>
        )}
      </div>
    </Shell>
  );
}
