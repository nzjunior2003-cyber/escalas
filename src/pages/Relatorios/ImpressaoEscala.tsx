import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import { FUNCAO_LABELS, FuncaoOperacional } from '../../types';

/** Folha de impressão sem sidebar/header — pensada para "Salvar como PDF". */
export default function ImpressaoEscala() {
  const [params] = useSearchParams();
  const tipo = (params.get('tipo') as 'ordinaria' | 'extraordinaria') || 'ordinaria';
  const funcao = (params.get('funcao') as FuncaoOperacional) || 'guarnicao';
  const semana = params.get('semana') || formatarDataISO(new Date());

  const { usuarioAtual, ubms, militares, escalasOrdinarias, escalasExtraordinarias } = useApp();
  const ubm = ubms.find((u) => u.id === usuarioAtual?.ubmId);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => formatarDataISO(addDays(new Date(semana + 'T00:00:00'), i))), [semana]);

  const linhas =
    tipo === 'ordinaria'
      ? escalasOrdinarias.filter((e) => e.ubmId === usuarioAtual?.ubmId && e.funcao === funcao && dias.includes(e.data))
      : escalasExtraordinarias.filter((e) => e.ubmId === usuarioAtual?.ubmId && e.funcao === funcao && dias.includes(e.data));

  useEffect(() => {
    document.title = `Escala ${tipo} — ${FUNCAO_LABELS[funcao]}`;
  }, [tipo, funcao]);

  return (
    <div className="max-w-3xl mx-auto p-8 print:p-0 bg-white text-gray-900">
      <div className="flex justify-end mb-4 print:hidden">
        <button onClick={() => window.print()} className="px-4 py-2 bg-red-700 text-white rounded-md text-sm font-medium">Imprimir / Salvar PDF</button>
      </div>

      <div className="text-center border-b-2 border-red-800 pb-4 mb-6">
        <img src="/logo-cbmpa.png" alt="Brasão do CBMPA" className="w-16 h-16 mx-auto mb-2 object-contain" />
        <h1 className="text-lg font-bold uppercase">Corpo de Bombeiros Militar do Pará</h1>
        <h2 className="text-sm font-semibold">{ubm ? `${ubm.sigla} - ${ubm.nome}` : 'Unidade de Bombeiro Militar'}</h2>
        <p className="text-sm mt-2 font-medium">
          Escala {tipo === 'ordinaria' ? 'Ordinária' : 'Extraordinária'} — {FUNCAO_LABELS[funcao]}
        </p>
        <p className="text-xs text-gray-500">
          Semana de {format(new Date(dias[0] + 'T00:00:00'), 'dd/MM/yyyy')} a {format(new Date(dias[6] + 'T00:00:00'), 'dd/MM/yyyy')}
        </p>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left py-2">Data</th>
            <th className="text-left py-2">Dia</th>
            <th className="text-left py-2">Militar Escalado</th>
            {tipo === 'extraordinaria' && <th className="text-left py-2">Motivo</th>}
          </tr>
        </thead>
        <tbody>
          {dias.map((dia) => {
            const doDia = linhas.filter((l) => l.data === dia);
            if (doDia.length === 0) {
              return (
                <tr key={dia} className="border-b border-gray-200">
                  <td className="py-2">{format(new Date(dia + 'T00:00:00'), 'dd/MM')}</td>
                  <td className="py-2 capitalize">{format(new Date(dia + 'T00:00:00'), 'EEEE', { locale: ptBR })}</td>
                  <td className="py-2 text-gray-400">Sem escala</td>
                  {tipo === 'extraordinaria' && <td className="py-2">—</td>}
                </tr>
              );
            }
            return doDia.map((l) => {
              const militar = militares.find((m) => m.id === l.militarId);
              return (
                <tr key={l.id} className="border-b border-gray-200">
                  <td className="py-2">{format(new Date(dia + 'T00:00:00'), 'dd/MM')}</td>
                  <td className="py-2 capitalize">{format(new Date(dia + 'T00:00:00'), 'EEEE', { locale: ptBR })}</td>
                  <td className="py-2">{militar ? `${militar.posto} ${militar.nome}` : '—'}</td>
                  {tipo === 'extraordinaria' && 'motivo' in l && <td className="py-2">{(l as { motivo: string }).motivo}</td>}
                </tr>
              );
            });
          })}
        </tbody>
      </table>

      <p className="text-xs text-gray-400 mt-8">Documento gerado pelo Sistema de Gerenciamento de Jornada de Trabalho — CBMPA.</p>
    </div>
  );
}
