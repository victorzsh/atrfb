import { useLoja } from '../data/store';
import { useRota } from './rota';
import { Agora } from './Agora';
import { Registro } from './Registro';
import { Mapa } from './Mapa';
import { Disciplina } from './Disciplina';
import { Ciclo } from './Ciclo';
import { Semana } from './Semana';
import { Analytics } from './Analytics';
import { DadosTela } from './DadosTela';
import { Importar } from './Importar';

export function App() {
  const { dados, pronto } = useLoja();
  const [r0, r1] = useRota();

  if (!dados) {
    if (!pronto) return <div className="tela papel" />;
    return r0 === 'dados' ? <DadosTela /> : <Importar primeira />;
  }
  switch (r0) {
    case 'registro': return <Registro tarefaKey={r1} />;
    case 'mapa': return r1 ? <Disciplina chave={r1} /> : <Mapa />;
    case 'ciclo': return <Ciclo sel={r1} />;
    case 'semana': return <Semana />;
    case 'analytics': return <Analytics />;
    case 'dados': return <DadosTela />;
    case 'nova-trilha': return <Importar />;
    default: return <Agora />;
  }
}
