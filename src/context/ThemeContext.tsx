import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type Tema = 'claro' | 'escuro';

interface ThemeContextData {
  tema: Tema;
  alternarTema: () => void;
}

const CHAVE_ARMAZENAMENTO = 'cbmpa-jornada-tema';

const ThemeContext = createContext<ThemeContextData>({
  tema: 'claro',
  alternarTema: () => {},
});

function lerTemaSalvo(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
    // localStorage indisponível (modo privado etc.) — cai no padrão claro.
  }
  return 'claro';
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [tema, setTema] = useState<Tema>(lerTemaSalvo);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    try {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, tema);
    } catch {
      // Ignora falha ao salvar a preferência — não impede o uso do tema.
    }
  }, [tema]);

  const alternarTema = useCallback(() => {
    setTema((atual) => (atual === 'claro' ? 'escuro' : 'claro'));
  }, []);

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
