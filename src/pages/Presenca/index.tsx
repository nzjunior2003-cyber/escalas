import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import { STATUS_PRESENCA_LABELS, StatusPresenca, TipoEscalaServico, temPapel } from '../../types';

const TODOS_STATUS = Object.keys(STATUS_PRESENCA_LABELS) as StatusPresenca[];

export default function Presenca() {
  const {
    usuarioAtual,
    militares,
    escalasOrdinarias,
    escalasExtraordinarias,
    presencas,
    registrarPresenca,
  } = useApp();

  const ubmId = usuarioAtual?.ubmId ?? '';
  const [data, setData] = useState(formatarDataISO(new Date()));
  const meuMilitarId = usuarioAtual?.militarId;

  const escaladosNoDia = useMemo(() => {
    const ord = escalasOrdinarias
      .filter((e) => e.ubmId === ubmId && e.data === data)
      .map((e) => ({ id: e.id, tipoEscala: 'ordinaria' as TipoEscalaServico, funcao: e.funcao, militarId: e.militarId }));
    const extra = escalasExtraordinarias
      .filter((e) => e.ubmId === ubmId && e.data === data)
      .map((e) => ({ id: e.id, tipoEscala: 'extraordinaria' as TipoEscalaServico, funcao: e.funcao, militarId: e.militarId }));
    return [...ord, ...extra];
  }, [escalasOrdinarias, escalasExtraordinarias, ubmId, data]);

  const souCmtDeSosNoDia = escaladosNoDia.some((e) => e.funcao === 'cmt_sos' && e.militarId === meuMilitarId);
  const isGestao = temPapel(usuarioAtual, 'comandante') || temPapel(usuarioAtual, 'escalante');
  const podeRegistrar = souCmtDeSosNoDia || isGestao;

  const guarnicaoDoDia = escaladosNoDia.filter((e) => e.funcao !== 'cmt_sos');

  const statusAtual = (escalaId: string, militarId: string) =>
    presencas.find((p) => p.escalaId === escalaId && p.militarId === militarId)?.status;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Presença</h1>
        <p className="mt-1 text-sm text-gray-500">Controle de presença da guarnição — tela do Comandante de Socorro (CMT de SOS).</p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <label className="block text-xs font-medium text-gray-500 mb-1">Data do serviço</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="border border-gray-300 rounded-md text-sm py-2 px-3" />
      </div>

      {!podeRegistrar && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
          Você só pode registrar presença nos dias em que estiver escalado como Comandante de Socorro (CMT de SOS).
        </p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Militar</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Função</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {guarnicaoDoDia.map((e) => {
              const militar = militares.find((m) => m.id === e.militarId);
              const atual = statusAtual(e.id, e.militarId);
              return (
                <tr key={`${e.tipoEscala}-${e.id}`}>
                  <td className="px-4 py-2">{militar?.nome ?? '—'}</td>
                  <td className="px-4 py-2 capitalize">{e.funcao.replace('_', ' ')}</td>
                  <td className="px-4 py-2">
                    {podeRegistrar ? (
                      <select
                        value={atual ?? ''}
                        onChange={(ev) =>
                          registrarPresenca({
                            ubmId,
                            escalaId: e.id,
                            tipoEscala: e.tipoEscala,
                            data,
                            militarId: e.militarId,
                            status: ev.target.value as StatusPresenca,
                          })
                        }
                        className="border border-gray-200 rounded text-sm"
                      >
                        <option value="" disabled>Selecionar</option>
                        {TODOS_STATUS.map((s) => <option key={s} value={s}>{STATUS_PRESENCA_LABELS[s]}</option>)}
                      </select>
                    ) : (
                      atual ? STATUS_PRESENCA_LABELS[atual] : '—'
                    )}
                  </td>
                </tr>
              );
            })}
            {guarnicaoDoDia.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Nenhum militar escalado nesta data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
