import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, User, Briefcase } from 'lucide-react';
import { useApp } from '../context/AppContext';
import FormField from './ui/FormField';

type ModalView = 'login' | 'solicitar' | 'esqueci';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, solicitarAcesso, enviarResetSenha, firebaseConfigurado, ubms } = useApp();
  const navigate = useNavigate();

  const [view, setView] = useState<ModalView>('login');
  const [erro, setErro] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [ubmId, setUbmId] = useState(ubms[0]?.id ?? '');
  const [newSenha, setNewSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');

  const trocarView = (nova: ModalView) => {
    setErro(null);
    setView(nova);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    try {
      await login(email, senha);
      onClose();
      navigate('/sistema');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível entrar.');
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
      await solicitarAcesso({ nome, email, senha: newSenha, ubmId, cargo });
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

  const handleEsqueci = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    try {
      await enviarResetSenha(email);
      alert(`Se houver uma conta para ${email}, um link de redefinição de senha foi enviado.`);
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
            <FormField label="Email" icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" />
            <div>
              <FormField label="Senha" icon={Lock} type="password" showToggle required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
              <div className="flex justify-start mt-2">
                <button type="button" onClick={() => trocarView('esqueci')} className="text-sm font-medium text-red-600 hover:text-red-500">
                  Esqueci a senha
                </button>
              </div>
            </div>
            <button type="submit" disabled={aguardando} className={classeBotaoPrimario}>
              {aguardando ? 'Entrando...' : 'Entrar'}
            </button>
            <div className="text-center mt-4 border-t pt-4">
              <p className="text-sm text-gray-600">Não possui conta?</p>
              <button type="button" onClick={() => trocarView('solicitar')} className="mt-2 w-full flex justify-center py-2 px-4 border border-red-200 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                Solicitar Acesso
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
            <FormField label="Email" icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Senha (mín. 6)" icon={Lock} type="password" required minLength={6} value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="••••••" />
              <FormField label="Confirmar Senha" icon={Lock} type="password" required minLength={6} value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)} placeholder="••••••" />
            </div>
            <button type="submit" disabled={aguardando} className={`${classeBotaoPrimario} mt-2`}>
              {aguardando ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
            <div className="text-center mt-2">
              <button type="button" onClick={() => trocarView('login')} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {view === 'esqueci' && (
          <form onSubmit={handleEsqueci} className="p-6 space-y-6">
            <p className="text-sm text-gray-600">Digite seu e-mail cadastrado. Você receberá um link seguro para cadastrar uma nova senha.</p>
            <FormField label="Email" icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" />
            <button type="submit" disabled={aguardando} className={classeBotaoPrimario}>
              {aguardando ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
            <div className="text-center mt-2">
              <button type="button" onClick={() => trocarView('login')} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
