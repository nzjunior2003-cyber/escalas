import { useState } from 'react';
import { startOfWeek, addDays } from 'date-fns';
import { Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import { gerarPdfEscala } from '../../lib/pdfEscala';
import { FUNCAO_LABELS, FuncaoOperacional, temPapel } from '../../types';

const TODAS_FUNCOES = Object.keys(FUNCAO_LABELS) as FuncaoOperacional[];

export default function Relatorios() {
  const { usuarioAtual, ubms, militares, escalasOrdinarias, escalasExtraordinarias } = useApp();

  const [funcao, setFuncao] = useState<FuncaoOperacional>('guarnicao');
  const [semana, setSemana] = useState(formatarDataISO(startOfWeek(new Date(), { weekStartsOn: 1 })));
  const [gerando, setGerando] = useState<'ordinaria' | 'extraordinaria' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const ubmId = usuarioAtual!.ubmId;
  const ubm = ubms.find((u) => u.id === ubmId);

  const baixarPdf = async (tipo: 'ordinaria' | 'extraordinaria') => {
    setErro(null);
    setGerando(tipo);
    try {
      const dias = Array.from({ length: 7 }, (_, i) => formatarDataISO(addDays(new Date(semana + 'T00:00:00'), i)));
      const escalas = tipo === 'ordinaria' ? escalasOrdinarias : escalasExtraordinarias;
      const linhas = escalas
        .filter((e) => e.ubmId === ubmId && e.funcao === funcao && dias.includes(e.data))
        .map((e) => ({
          data: e.data,
          militarNome: (() => {
            const militar = militares.find((m) => m.id === e.militarId);
            return militar ? `${militar.posto} ${militar.nome}`.trim() : 'Militar removido';
          })(),
          motivo: 'motivo' in e ? e.motivo : undefined,
        }));

      await gerarPdfEscala({
        tipo,
        funcao,
        ubmNome: ubm ? `${ubm.sigla} - ${ubm.nome}` : 'Unidade de Bombeiro Militar',
        semanaInicio: semana,
        linhas,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setGerando(null);
    }
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

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => baixarPdf('ordinaria')}
            disabled={gerando !== null}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
          >
            <Download className="-ml-1 mr-2 h-4 w-4" /> {gerando === 'ordinaria' ? 'Gerando...' : 'PDF Escala Ordinária'}
          </button>
          <button
            onClick={() => baixarPdf('extraordinaria')}
            disabled={gerando !== null}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="-ml-1 mr-2 h-4 w-4" /> {gerando === 'extraordinaria' ? 'Gerando...' : 'PDF Escala Extraordinária'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          O download começa automaticamente, no padrão visual institucional (brasão, cabeçalho da UBM, tabela por dia da semana).
        </p>
      </div>
    </div>
  );
}
