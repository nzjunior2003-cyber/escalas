import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PublicHome from './pages/PublicHome';
import SistemaHome from './pages/SistemaHome';
import Efetivo from './pages/Efetivo';
import Escala from './pages/Escala';
import Solicitacoes from './pages/Solicitacoes';
import Afastamentos from './pages/Afastamentos';
import Presenca from './pages/Presenca';
import Relatorios from './pages/Relatorios';
import Estatisticas from './pages/Estatisticas';
import Usuarios from './pages/Usuarios';
import Ubms from './pages/Ubms';
import Alertas from './pages/Alertas';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicHome />} />

            <Route path="/sistema" element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<SistemaHome />} />
                <Route path="efetivo" element={<Efetivo />} />
                <Route path="escala" element={<Escala />} />
                <Route path="solicitacoes" element={<Solicitacoes />} />
                <Route path="afastamentos" element={<Afastamentos />} />
                <Route path="presenca" element={<Presenca />} />
                <Route path="relatorios" element={<Relatorios />} />
                <Route path="estatisticas" element={<Estatisticas />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="ubms" element={<Ubms />} />
                <Route path="alertas" element={<Alertas />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  );
}
