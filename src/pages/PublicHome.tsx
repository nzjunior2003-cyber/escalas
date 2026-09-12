import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import LoginModal from '../components/LoginModal';

export default function PublicHome() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-red-800 text-white shadow-md border-b-2 border-amber-400">
        <div className="max-w-6xl mx-auto flex items-stretch">
          <div className="bg-white flex items-center px-4 sm:px-6">
            <img src="/logo-cbmpa.png" alt="Brasão do CBMPA" className="w-10 h-10 object-contain" />
          </div>
          <div className="flex flex-col justify-center px-4 sm:px-6 py-3">
            <p className="font-bold leading-tight">Sistema de Gerenciamento de Jornada de Trabalho</p>
            <p className="text-xs text-red-200 uppercase tracking-wider">Corpo de Bombeiros Militar do Pará</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-3xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-7 h-7 text-red-700" />
            <h1 className="text-2xl font-bold text-gray-900">
              Sistema de Gerenciamento de Jornada de Trabalho
            </h1>
          </div>
          <p className="text-gray-500">
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
