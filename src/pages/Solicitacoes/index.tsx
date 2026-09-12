import { useState } from 'react';
import type { FormEvent } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  STATUS_SOLICITACAO_LABELS,
  TipoEscalaServico,
  TipoSolicitacaoServico,
  temPapel,
} from '../../types';

export default function Solicitacoes() {
  const {
    usuarioAtual,
    usuarios,
    escalasOrdinarias,
    escalasExtraordinarias,
    solicitacoesServico,
    criarSolicitacaoServico,
    responderSolicitacaoIndicado,
    responderSolicitacaoEscalante,
  } = useApp();

  const ubmId = usuarioAtual?.ubmId ?? '';
  const isEscalante = temPapel(usuarioAtual, 'escalante');
  const meuMilitarId = usuarioAtual?.militarId;

  const minhasEscalas = [
    ...escalasOrdinarias.filter((e) => e.ubmId === ubmId && e.militarId === meuMilitarId).map((e) => ({ ...e, tipoEscala: 'ordinaria' as TipoEscalaServico })),
    ...escalasExtraordinarias.filter((e) => e.ubmId === ubmId && e.militarId === meuMilitarId).map((e) => ({ ...e, tipoEscala: 'extraordinaria' as TipoEscalaServico })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const outrosMilitares = usuarios.filter((u) => u.ubmId === ubmId && u.militarId && u.militarId !== meuMilitarId);

  const [form, setForm] = useState({
    tipo: 'substituicao' as TipoSolicitacaoServico,
    escalaOrigemId: '',
    tipoEscalaOrigem: 'ordinaria' as TipoEscalaServico,
    indicadoId: '',
    motivo: '',
  });
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.escalaOrigemId || !form.indicadoId) return;
    setEnviando(true);
    try {
      await criarSolicitacaoServico({
        ubmId,
        tipo: form.tipo,
        escalaOrigemId: form.escalaOrigemId,
        tipoEscalaOrigem: form.tipoEscalaOrigem,
        indicadoId: form.indicadoId,
        motivo: form.motivo,
      });
      setForm({ tipo: 'substituicao', escalaOrigemId: '', tipoEscalaOrigem: 'ordinaria', indicadoId: '', motivo: '' });
    } finally {
      setEnviando(false);
    }
  };

  const minhasSolicitacoesFeitas = solicitacoesServico.filter((s) => s.solicitanteId === usuarioAtual?.id);
  const solicitacoesParaMim = solicitacoesServico.filter((s) => s.indicadoId === usuarioAtual?.id && s.status === 'aguardando_indicado');
  const solicitacoesParaEscalante = isEscalante
    ? solicitacoesServico.filter((s) => s.ubmId === ubmId && s.status === 'aguardando_escalante')
    : [];

  const nomeUsuario = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? '—';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Solicitações</h1>
        <p className="mt-1 text-sm text-gray-500">Autorização de serviço (substituição) e permuta.</p>
      </div>

      {meuMilitarId && (
        <form onSubmit={handleEnviar} className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Nova solicitação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoSolicitacaoServico })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
                <option value="substituicao">Autorização de serviço (substituição)</option>
                <option value="permuta">Permuta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Minha escala a ser trocada</label>
              <select
                value={form.escalaOrigemId}
                onChange={(e) => {
                  const escala = minhasEscalas.find((m) => m.id === e.target.value);
                  setForm({ ...form, escalaOrigemId: e.target.value, tipoEscalaOrigem: escala?.tipoEscala ?? 'ordinaria' });
                }}
                className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
              >
                <option value="">Selecione</option>
                {minhasEscalas.map((e) => (
                  <option key={e.id} value={e.id}>{e.data} ({e.tipoEscala})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Militar indicado</label>
              <select value={form.indicadoId} onChange={(e) => setForm({ ...form, indicadoId: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
                <option value="">Selecione</option>
                {outrosMilitares.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (opcional)</label>
              <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
            </div>
          </div>
          <button type="submit" disabled={enviando} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
            <Send className="-ml-1 mr-2 h-4 w-4" /> Enviar solicitação
          </button>
        </form>
      )}

      {solicitacoesParaMim.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">Pedidos aguardando sua resposta</h3>
          {solicitacoesParaMim.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-md p-3 border border-amber-100">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{nomeUsuario(s.solicitanteId)} pediu {s.tipo === 'permuta' ? 'permuta' : 'substituição'}</p>
                {s.motivo && <p className="text-gray-500">Motivo: {s.motivo}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => responderSolicitacaoIndicado(s.id, true)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Aceitar</button>
                <button onClick={() => responderSolicitacaoIndicado(s.id, false)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300">Recusar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {solicitacoesParaEscalante.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">Aguardando sua aprovação (Escalante)</h3>
          {solicitacoesParaEscalante.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-md p-3 border border-blue-100">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{nomeUsuario(s.solicitanteId)} ↔ {nomeUsuario(s.indicadoId)} ({s.tipo})</p>
                {s.motivo && <p className="text-gray-500">Motivo: {s.motivo}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => responderSolicitacaoEscalante(s.id, true)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Aprovar</button>
                <button onClick={() => responderSolicitacaoEscalante(s.id, false)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300">Recusar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Tipo</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Indicado</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {minhasSolicitacoesFeitas.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 capitalize">{s.tipo}</td>
                <td className="px-4 py-2">{nomeUsuario(s.indicadoId)}</td>
                <td className="px-4 py-2">{STATUS_SOLICITACAO_LABELS[s.status]}</td>
              </tr>
            ))}
            {minhasSolicitacoesFeitas.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Você ainda não fez solicitações.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
