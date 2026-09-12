import { Bell, LogOut, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import ThemeToggle from '../ThemeToggle';
import { PAPEL_LABELS } from '../../types';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const { usuarioAtual, ubms, logout, alertas } = useApp();
  const ubm = ubms.find((u) => u.id === usuarioAtual?.ubmId);
  const naoLidos = alertas.filter((a) => !a.lida).length;

  return (
    <header className="flex-shrink-0 h-20 bg-red-800 text-white shadow-md border-b-2 border-amber-400 z-20 relative">
      <div className="flex items-stretch justify-between h-full relative z-10 w-full">
        <div className="flex items-center h-full flex-1">
          <div className="bg-white flex items-center justify-center h-full px-4 sm:px-6 shadow-sm w-fit relative min-w-[72px]">
            <button
              type="button"
              className="md:hidden p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none mr-2 sm:mr-4 transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            >
              <span className="sr-only">Alternar menu</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <img src="/logo-cbmpa.png" alt="Brasão do CBMPA" className="w-12 h-12 sm:w-14 sm:h-14 object-contain relative z-10" />
          </div>

          <div className="flex flex-col justify-center ml-4">
            <span className="text-xl font-bold tracking-wide leading-tight hidden sm:block">CBMPA - Jornada de Trabalho</span>
            <span className="text-xl font-bold tracking-wide leading-tight sm:hidden">CBMPA</span>
            <span className="text-xs font-semibold text-red-200 uppercase tracking-wider mt-0.5 hidden sm:block">
              {ubm ? `${ubm.sigla} - ${ubm.nome}` : 'Gestão de Escalas de Serviço'}
            </span>
          </div>
        </div>

        <div className="flex items-center pr-4 sm:pr-6">
          <ThemeToggle />
          <Link
            to="/sistema/alertas"
            className="relative p-1 rounded-full text-red-200 hover:text-white hover:bg-red-700 focus:outline-none transition-colors border border-transparent mx-4"
          >
            <span className="sr-only">Notificações</span>
            <Bell className="h-5 w-5" aria-hidden="true" />
            {naoLidos > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-red-900 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {naoLidos > 9 ? '9+' : naoLidos}
              </span>
            )}
          </Link>

          <div className="flex items-center border-l border-red-700 pl-4 space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{usuarioAtual?.nome}</p>
              <p className="text-xs text-red-200">{usuarioAtual?.papeis?.map((p) => PAPEL_LABELS[p]).join(', ')}</p>
            </div>
            <button onClick={logout} title="Sair do sistema" className="flex items-center text-sm font-medium text-red-200 hover:text-white p-1 rounded-md hover:bg-red-700 transition-colors">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
