import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { tema, alternarTema } = useTheme();

  return (
    <button
      type="button"
      onClick={alternarTema}
      title={tema === 'claro' ? 'Ativar modo escuro' : 'Ativar modo claro'}
      className="p-1 rounded-full text-red-200 hover:text-white hover:bg-red-700 focus:outline-none transition-colors border border-transparent"
    >
      <span className="sr-only">Alternar tema claro/escuro</span>
      {tema === 'claro' ? <Moon className="h-5 w-5" aria-hidden="true" /> : <Sun className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
