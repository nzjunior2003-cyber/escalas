import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import LoginModal from '../components/LoginModal';

export default function PublicHome() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-red-800 text-white shadow-md border-b-2 border-amber-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-cbmpa.png" alt="Brasão do CBMPA" className="w-10 h-10 object-contain" />
            <div>
              <p className="font-bold leading-tight">CBMPA</p>
              <p className="text-xs text-red-200 uppercase tracking-wider">Jornada de Trabalho</p>
            </div>
          </div>
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-red-800 font-medium rounded-md shadow-sm hover:bg-red-50 transition-colors"
          >
            <LogIn className="w-4 h-4" /> Entrar
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl text-center space-y-6 py-16">
          <ShieldCheck className="w-16 h-16 text-red-700 mx-auto" />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Sistema de Gerenciamento de Jornada de Trabalho
          </h1>
          <p className="text-gray-600">
            Gestão de escalas de serviço das Unidades de Bombeiro Militar (UBM) do Corpo de
            Bombeiros Militar do Pará: escala ordinária, extraordinária e diferenciada,
            afastamentos, permutas/substituições, presença e estatísticas.
          </p>
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-700 text-white font-medium rounded-md shadow-sm hover:bg-red-800 transition-colors"
          >
            <LogIn className="w-5 h-5" /> Acessar o sistema
          </button>
        </div>
      </main>

      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} />}
    </div>
  );
}
