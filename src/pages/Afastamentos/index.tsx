import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import { MOTIVO_AFASTAMENTO_LABELS, MotivoAfastamento, temPapel } from '../../types';

const TODOS_MOTIVOS = Object.keys(MOTIVO_AFASTAMENTO_LABELS) as MotivoAfastamento[];

export default function Afastamentos() {
  const { usuarioAtual, militares, afastamentos, addAfastamento, deleteAfastamento } = useApp();
  const hoje = formatarDataISO(new Date());

  const [form, setForm] = useState({
    militarId: '',
    motivo: 'ferias' as MotivoAfastamento,
    detalhe: '',
    dataInicio: hoje,
    dataFim: hoje,
  });

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const ubmId = usuarioAtual!.ubmId;
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo);
  const doUbm = afastamentos.filter((a) => a.ubmId === ubmId).sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.militarId) return;
    await addAfastamento({ ...form, ubmId });
    setForm({ militarId: '', motivo: 'ferias', detalhe: '', dataInicio: hoje, dataFim: hoje });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Afastamentos</h1>
        <p className="mt-1 text-sm text-gray-500">Durante o período informado, o militar fica bloqueado de qualquer escalação.</p>
      </div>

      <form onSubmit={handleCriar} className="bg-white p-4 rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Militar</label>
          <select value={form.militarId} onChange={(e) => setForm({ ...form, militarId: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
            <option value="">Selecione</option>
            {militaresDaUbm.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Motivo</label>
          <select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value as MotivoAfastamento })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
            {TODOS_MOTIVOS.map((m) => <option key={m} value={m}>{MOTIVO_AFASTAMENTO_LABELS[m]}</option>)}
          </select>
        </div>
        {(form.motivo === 'missao_externa' || form.motivo === 'outro') && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{form.motivo === 'missao_externa' ? 'Qual missão' : 'Detalhe do motivo'}</label>
            <input value={form.detalhe} onChange={(e) => setForm({ ...form, detalhe: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data início</label>
          <input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data fim</label>
          <input type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800">
            <Plus className="-ml-1 mr-2 h-4 w-4" /> Registrar afastamento
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Militar</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Motivo</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Período</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Situação</th>
              <th className="relative px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {doUbm.map((a) => {
              const militar = militares.find((m) => m.id === a.militarId);
              const ativo = a.dataInicio <= hoje && a.dataFim >= hoje;
              return (
                <tr key={a.id}>
                  <td className="px-4 py-2">{militar?.nome ?? '—'}</td>
                  <td className="px-4 py-2">{MOTIVO_AFASTAMENTO_LABELS[a.motivo]}{a.detalhe ? ` — ${a.detalhe}` : ''}</td>
                  <td className="px-4 py-2">{a.dataInicio} a {a.dataFim}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ativo ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                      {ativo ? 'Em curso' : a.dataFim < hoje ? 'Encerrado' : 'Futuro'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => deleteAfastamento(a.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
            {doUbm.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum afastamento registrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
