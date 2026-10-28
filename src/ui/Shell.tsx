import type { ReactNode } from 'react';
import { useLoja } from '../data/store';
import { link } from './rota';

export type Secao = 'agora' | 'semana' | 'ciclo' | 'mapa' | 'analytics' | 'dados';

const MENU: [Secao, string, string][] = [
  ['agora', 'Agora', ''],
  ['semana', 'Semana', 'semana'],
  ['ciclo', 'Ciclo', 'ciclo'],
  ['mapa', 'Mapa', 'mapa'],
  ['analytics', 'Analytics', 'analytics'],
  ['dados', 'Dados', 'dados'],
];

function Sync() {
  const { sync, github } = useLoja();
  if (!github) return <a className="sync" href={link('dados')}><i />só neste aparelho</a>;
  const txt = { local: 'só neste aparelho', carregando: 'carregando…', salvando: 'salvando…', salvo: 'salvo', erro: 'erro ao salvar', bloqueado: 'bloqueado' }[sync.estado];
  return (
    <a className={`sync ${sync.estado}`} href={link('dados')} title={sync.erro ?? undefined}>
      <i />
      {txt}
    </a>
  );
}

export function Shell({ secao, noite, children, semTopo }: { secao: Secao; noite?: boolean; children: ReactNode; semTopo?: boolean }) {
  const { tema, setTema, temSenha, desbloqueado, desbloquear, bloquear } = useLoja();
  const classe = noite ? 'tela noite' : `tela papel${tema === 'escuro' ? ' escuro' : ''}`;
  return (
    <div className={classe}>
      {!semTopo && (
        <header className="topo">
          <a className="marca" href={link('')}><i />ATRFB</a>
          <nav className="menu" aria-label="Seções">
            {MENU.map(([k, nome, href]) => (
              <a key={k} href={link(href)} className={k === secao ? 'ativo' : ''}>{nome}</a>
            ))}
          </nav>
          <div className="direita">
            <Sync />
            {temSenha && (
              <button type="button" className="btn-tema" onClick={() => (desbloqueado ? bloquear() : void desbloquear())} title={desbloqueado ? 'Bloquear: alterações e downloads voltam a pedir a senha' : 'Desbloquear com a senha'}>
                {desbloqueado ? 'BLOQUEAR' : 'DESBLOQUEAR'}
              </button>
            )}
            {!noite && (
              <button type="button" className="btn-tema" onClick={() => setTema(tema === 'escuro' ? 'claro' : 'escuro')}>
                {tema === 'escuro' ? 'MODO CLARO' : 'MODO ESCURO'}
              </button>
            )}
          </div>
        </header>
      )}
      {children}
      <nav className="abas" aria-label="Seções">
        {MENU.filter(([k]) => k !== 'analytics').map(([k, nome, href]) => (
          <a key={k} href={link(href)} className={k === secao ? 'ativo' : ''}>{nome}</a>
        ))}
      </nav>
    </div>
  );
}
