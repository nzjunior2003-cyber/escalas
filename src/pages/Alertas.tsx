import { useApp } from '../context/AppContext';
import { Bell } from 'lucide-react';

export default function Alertas() {
  const { alertas, marcarAlertaLida } = useApp();
  const ordenados = [...alertas].sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="mt-1 text-sm text-gray-500">Notificações de solicitações, aprovações e alterações de escala.</p>
      </div>

      <div className="space-y-2">
        {ordenados.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">Nenhum alerta no momento.</p>
        )}
        {ordenados.map((a) => (
          <div key={a.id} className={`flex items-start gap-3 p-4 rounded-lg border ${a.lida ? 'bg-white border-gray-200' : 'bg-red-50 border-red-100'}`}>
            <Bell className={`w-5 h-5 mt-0.5 ${a.lida ? 'text-gray-300' : 'text-red-600'}`} />
            <div className="flex-1">
              <p className="text-sm text-gray-800">{a.mensagem}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(a.criado_em).toLocaleString('pt-BR')}</p>
            </div>
            {!a.lida && (
              <button onClick={() => marcarAlertaLida(a.id)} className="text-xs font-medium text-red-700 hover:text-red-900">
                Marcar como lida
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
