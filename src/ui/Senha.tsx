import { useEffect, useRef, useState } from 'react';
import { useLoja } from '../data/store';
import { SENHA_MINIMA } from '../data/seguranca';
import { ir } from './rota';

// Pedido de senha: aparece por cima de qualquer tela quando uma ação
// precisa dela (alterar dados, baixar arquivos) e o app está bloqueado.
export function PedidoSenha() {
  const { pedido, responder, cancelarPedido, criarSenha, esquecerAparelho, github, tema } = useLoja();
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [esqueci, setEsqueci] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSenha('');
    setRepetir('');
    setErro(null);
    setEsqueci(false);
    if (pedido) setTimeout(() => campo.current?.focus(), 30);
  }, [pedido]);

  if (!pedido) return null;
  const criar = pedido.modo === 'criar';

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (criar) {
      if (senha.length < SENHA_MINIMA) return setErro(`Use pelo menos ${SENHA_MINIMA} caracteres.`);
      if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    }
    setOcupado(true);
    try {
      if (criar) await criarSenha(senha);
      else {
        const r = await responder(senha, lembrar);
        if (r) setErro(r);
      }
    } finally {
      setOcupado(false);
    }
  };

  const apagar = async () => {
    const aviso = github
      ? 'Apagar os dados deste aparelho? Eles continuam no seu repositório do GitHub; depois, conecte de novo com o token e marque “Esqueci a senha”.'
      : 'Apagar os dados deste aparelho? Eles não estão no GitHub, então o progresso registrado aqui será perdido.';
    if (!confirm(aviso)) return;
    await esquecerAparelho();
    ir(github ? 'dados' : '');
  };

  return (
    <div className={`papel${tema === 'escuro' ? ' escuro' : ''}`} role="dialog" aria-modal="true" aria-label={criar ? 'Criar senha' : 'Digite a senha'}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(10,10,9,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
      <form onSubmit={enviar} style={{ width: 'min(440px, 100%)', background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--ink)', padding: 28, display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'var(--sans)' }}>
        <span className="rotulo">{criar ? 'Senha do app' : 'Bloqueado'}</span>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-.03em' }}>{criar ? 'Crie uma senha' : 'Digite a senha'}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text2)' }}>
          {pedido.motivo ? pedido.motivo + ' ' : ''}
          {criar
            ? 'Sem ela, ninguém altera seus dados nem baixa arquivos. A senha não fica guardada em lugar nenhum: só dá para trocá-la sabendo a atual ou com o token do GitHub.'
            : 'Ver é livre; alterar dados e baixar arquivos pedem a senha.'}
        </p>
        {!esqueci && (
          <>
            <label className="campo-rotulo">
              {criar ? 'NOVA SENHA' : 'SENHA'}
              <input ref={campo} className="campo" type="password" autoComplete={criar ? 'new-password' : 'current-password'} value={senha} onChange={(e) => setSenha(e.target.value)} />
            </label>
            {criar ? (
              <label className="campo-rotulo">
                REPITA A SENHA
                <input className="campo" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
              </label>
            ) : (
              <label style={{ display: 'flex', gap: 10, fontSize: 14, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--ink)' }} />
                Manter desbloqueado neste aparelho por 8 horas
              </label>
            )}
            {erro && <p className="erro-txt" style={{ margin: 0 }}>{erro}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button type="submit" className="btn btn-ink" disabled={ocupado}>{ocupado ? 'Conferindo…' : criar ? 'Criar senha' : 'Desbloquear'}</button>
              <button type="button" className="btn btn-texto" onClick={cancelarPedido}>Cancelar</button>
              {!criar && <button type="button" className="btn btn-texto" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => setEsqueci(true)}>Esqueci a senha</button>}
            </div>
          </>
        )}
        {esqueci && (
          <>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              {github
                ? 'Seus dados estão no repositório do GitHub. Apague os dados deste aparelho e conecte de novo em Dados, com o token, marcando “Esqueci a senha” para criar outra.'
                : 'Sem GitHub conectado, a senha não pode ser recuperada. Dá para apagar os dados deste aparelho e começar de novo com a planilha.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" className="btn btn-ink" onClick={() => void apagar()}>Apagar dados deste aparelho</button>
              <button type="button" className="btn btn-texto" onClick={() => setEsqueci(false)}>Voltar</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
