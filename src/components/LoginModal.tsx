import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, User, Briefcase, IdCard, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { LinhaMilitar } from '../lib/csvMilitares';
import FormField from './ui/FormField';

type ModalView = 'login' | 'solicitar' | 'esqueci' | 'completarCadastro';

const SENHA_PADRAO_PRIMEIRO_ACESSO = '123456';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, solicitarAcesso, enviarResetSenha, validarMatriculaEfetivo, primeiroAcessoPorMatricula, firebaseConfigurado, ubms } =
    useApp();
  const navigate = useNavigate();

  const [view, setView] = useState<ModalView>('login');
  const [erro, setErro] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);

  // Login (aceita matrícula ou e-mail)
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [emailEsqueci, setEmailEsqueci] = useState('');

  // Solicitar acesso (autocadastro sem matrícula, ex.: quem não está na planilha)
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [ubmId, setUbmId] = useState(ubms[0]?.id ?? '');
  const [newSenha, setNewSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');

  // Completar cadastro (primeiro acesso por matrícula, validado na planilha)
  const [militarValidado, setMilitarValidado] = useState<LinhaMilitar | null>(null);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [cadastroUbmId, setCadastroUbmId] = useState(ubms[0]?.id ?? '');
  const [cadastroEmail, setCadastroEmail] = useState('');
  const [cadastroSenha, setCadastroSenha] = useState('');
  const [cadastroConfirmSenha, setCadastroConfirmSenha] = useState('');

  const trocarView = (nova: ModalView) => {
    setErro(null);
    setView(nova);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    try {
      await login(identificador, senha);
      onClose();
      navigate('/sistema');
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível entrar.';
      const pareceMatricula = !identificador.includes('@');

      // Matrícula desconhecida + senha padrão: pode ser primeiro acesso.
      if (pareceMatricula && senha === SENHA_PADRAO_PRIMEIRO_ACESSO && mensagem.includes('Matrícula não encontrada')) {
        try {
          const linha = await validarMatriculaEfetivo(identificador);
          if (linha) {
            setMilitarValidado(linha);
            setNomeGuerra('');
            setCadastroEmail('');
            setCadastroSenha('');
            setCadastroConfirmSenha('');
            trocarView('completarCadastro');
          } else {
            setErro('Matrícula não encontrada no efetivo do CBMPA. Verifique o número digitado.');
          }
        } catch {
          setErro('Não foi possível validar a matrícula agora. Tente novamente em instantes.');
        }
      } else {
        setErro(mensagem);
      }
    } finally {
      setAguardando(false);
    }
  };

  const handleSolicitar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (newSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newSenha !== confirmSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (!ubmId) {
      setErro('Selecione a UBM à qual você pertence.');
      return;
    }

    setAguardando(true);
    try {
      await solicitarAcesso({ nome, email: identificador, senha: newSenha, ubmId, cargo });
      alert('Solicitação enviada com sucesso! Aguarde a aprovação do Comandante/Escalante da sua UBM.');
      setNewSenha('');
      setConfirmSenha('');
      trocarView('login');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setAguardando(false);
    }
  };

  const handleCompletarCadastro = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!militarValidado) return;
    if (!nomeGuerra.trim()) {
      setErro('Informe seu nome de guerra.');
      return;
    }
    if (!cadastroUbmId) {
      setErro('Selecione a UBM à qual você pertence.');
      return;
    }
    if (cadastroSenha.length < 6) {
      setErro('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (cadastroSenha !== cadastroConfirmSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setAguardando(true);
    try {
      await primeiroAcessoPorMatricula({
        matricula: militarValidado.matricula,
        nomeCompleto: militarValidado.nome,
        cargo: militarValidado.posto,
        nomeGuerra,
        email: cadastroEmail,
        senha: cadastroSenha,
        ubmId: cadastroUbmId,
      });
      alert('Cadastro recebido! Enviamos um e-mail de confirmação. Aguarde a aprovação do Comandante/Escalante da sua UBM.');
      setIdentificador('');
      setSenha('');
      trocarView('login');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setAguardando(false);
    }
  };

  const handleEsqueci = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    try {
      await enviarResetSenha(emailEsqueci);
      alert(`Se houver uma conta para ${emailEsqueci}, um link de redefinição de senha foi enviado.`);
      trocarView('login');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.');
    } finally {
      setAguardando(false);
    }
  };

  const classeBotaoPrimario =
    'w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {view === 'login' && 'Acesso ao Sistema'}
            {view === 'solicitar' && 'Solicitar Acesso'}
            {view === 'esqueci' && 'Recuperar Senha'}
            {view === 'completarCadastro' && 'Completar Cadastro'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {!firebaseConfigurado && (
          <div className="mx-6 mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            O Firebase ainda não foi configurado neste ambiente. Defina as variáveis
            <span className="font-mono"> VITE_FIREBASE_*</span> no arquivo <span className="font-mono">.env</span>.
          </div>
        )}

        {erro && (
          <div role="alert" className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} className="p-6 space-y-6">
            <FormField
              label="Matrícula ou E-mail"
              icon={IdCard}
              type="text"
              required
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Sua matrícula ou e-mail"
            />
            <p className="-mt-4 text-xs text-gray-500">
              Primeiro acesso? Digite sua matrícula (sem o dígito verificador) e a senha padrão{' '}
              <span className="font-mono font-medium">{SENHA_PADRAO_PRIMEIRO_ACESSO}</span>.
            </p>
            <div>
              <FormField label="Senha" icon={Lock} type="password" showToggle required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
              <div className="flex justify-start mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailEsqueci(identificador.includes('@') ? identificador : '');
                    trocarView('esqueci');
                  }}
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Esqueci a senha
                </button>
              </div>
            </div>
            <button type="submit" disabled={aguardando} className={classeBotaoPrimario}>
              {aguardando ? 'Entrando...' : 'Entrar'}
            </button>
            <div className="text-center mt-4 border-t pt-4">
              <p className="text-sm text-gray-600">Não está no efetivo cadastrado na planilha?</p>
              <button type="button" onClick={() => trocarView('solicitar')} className="mt-2 w-full flex justify-center py-2 px-4 border border-red-200 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                Solicitar Acesso Manualmente
              </button>
            </div>
          </form>
        )}

        {view === 'completarCadastro' && militarValidado && (
          <form onSubmit={handleCompletarCadastro} className="p-6 space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Matrícula encontrada no efetivo do CBMPA</p>
                <p>{militarValidado.posto} {militarValidado.nome} — MF: {militarValidado.matricula}</p>
              </div>
            </div>

            <FormField label="Nome de Guerra" icon={User} type="text" required value={nomeGuerra} onChange={(e) => setNomeGuerra(e.target.value)} placeholder="Como você é chamado no dia a dia" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UBM</label>
              <select value={cadastroUbmId} onChange={(e) => setCadastroUbmId(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm">
                <option value="" disabled>Selecione sua UBM</option>
                {ubms.map((u) => (
                  <option key={u.id} value={u.id}>{u.sigla} - {u.nome}</option>
                ))}
              </select>
            </div>

            <FormField label="Email" icon={Mail} type="email" required value={cadastroEmail} onChange={(e) => setCadastroEmail(e.target.value)} placeholder="usuario@email.com" />

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Nova Senha (mín. 6)" icon={Lock} type="password" showToggle required minLength={6} value={cadastroSenha} onChange={(e) => setCadastroSenha(e.target.value)} placeholder="••••••" />
              <FormField label="Confirmar Senha" icon={Lock} type="password" showToggle required minLength={6} value={cadastroConfirmSenha} onChange={(e) => setCadastroConfirmSenha(e.target.value)} placeholder="••••••" />
            </div>

            <button type="submit" disabled={aguardando} className={`${classeBotaoPrimario} mt-2`}>
              {aguardando ? 'Enviando...' : 'Concluir Cadastro'}
            </button>
            <div className="text-center mt-2">
              <button type="button" onClick={() => trocarView('login')} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {view === 'solicitar' && (
          <form onSubmit={handleSolicitar} className="p-6 space-y-4">
            <FormField label="Nome Completo" icon={User} type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
            <FormField label="Posto/Graduação" icon={Briefcase} type="text" required value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: 1º TEN QOABM" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UBM</label>
              <select value={ubmId} onChange={(e) => setUbmId(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm">
                <option value="" disabled>Selecione sua UBM</option>
                {ubms.map((u) => (
                  <option key={u.id} value={u.id}>{u.sigla} - {u.nome}</option>
                ))}
              </select>
            </div>
            <FormField label="Email" icon={Mail} type="email" required value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="usuario@email.com" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Senha (mín. 6)" icon={Lock} type="password" required minLength={6} value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="••••••" />
              <FormField label="Confirmar Senha" icon={Lock} type="password" required minLength={6} value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)} placeholder="••••••" />
            </div>

            <button
              type="submit"
              disabled={aguardando}
              className={`${classeBotaoPrimario} mt-2`}
            >
              {aguardando ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => trocarView('login')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {view === 'esqueci' && (
          <form onSubmit={handleEsqueci} className="p-6 space-y-6">
            <p className="text-sm text-gray-600">
              Digite seu e-mail cadastrado (não a matrícula). Você receberá um link seguro
              para cadastrar uma nova senha.
            </p>
            <FormField label="Email" icon={Mail} type="email" required value={emailEsqueci} onChange={(e) => setEmailEsqueci(e.target.value)} placeholder="usuario@email.com" />

            <button type="submit" disabled={aguardando} className={classeBotaoPrimario}>
              {aguardando ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => trocarView('login')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
