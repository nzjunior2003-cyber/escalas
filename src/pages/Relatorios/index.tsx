import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import { startOfWeek } from 'date-fns';
import { FUNCAO_LABELS, FuncaoOperacional, temPapel } from '../../types';

const TODAS_FUNCOES = Object.keys(FUNCAO_LABELS) as FuncaoOperacional[];

export default function Relatorios() {
  const { usuarioAtual } = useApp();
  const navigate = useNavigate();

  const [funcao, setFuncao] = useState<FuncaoOperacional>('guarnicao');
  const [semana, setSemana] = useState(formatarDataISO(startOfWeek(new Date(), { weekStartsOn: 1 })));

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const abrir = (tipo: 'ordinaria' | 'extraordinaria') => {
    navigate(`/sistema/relatorios/imprimir?tipo=${tipo}&funcao=${funcao}&semana=${semana}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="mt-1 text-sm text-gray-500">Geração de PDF padronizado semanal (escala ordinária e extraordinária) para publicidade/afixação oficial.</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Função</label>
            <select value={funcao} onChange={(e) => setFuncao(e.target.value as FuncaoOperacional)} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
              {TODAS_FUNCOES.map((f) => <option key={f} value={f}>{FUNCAO_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Semana (segunda-feira)</label>
            <input type="date" value={semana} onChange={(e) => setSemana(e.target.value)} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => abrir('ordinaria')} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800">
            <Printer className="-ml-1 mr-2 h-4 w-4" /> PDF Escala Ordinária
          </button>
          <button onClick={() => abrir('extraordinaria')} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Printer className="-ml-1 mr-2 h-4 w-4" /> PDF Escala Extraordinária
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Abre uma folha de impressão pronta para "Salvar como PDF" (Ctrl+P / Cmd+P), no padrão visual institucional.
        </p>
      </div>
    </div>
  );
}
