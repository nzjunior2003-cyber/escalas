import { useState } from 'react';
import type { FormEvent } from 'react';
import { Shield, Plus, Edit2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TIPO_COMANDO_LABELS, temPapel, type Comando, type TipoComando } from '../../types';

const TODOS_TIPOS = Object.keys(TIPO_COMANDO_LABELS) as TipoComando[];

interface FormComando {
  tipo: TipoComando;
  nome: string;
  sigla: string;
  ubmIds: string[];
}

const FORM_VAZIO: FormComando = { tipo: 'crb', nome: '', sigla: '', ubmIds: [] };

/** Cadastro de CRB/COP e das UBMs vinculadas a cada um — exclusivo do master. */
export default function Comandos() {
  const { usuarioAtual, ubms, comandos, addComando, updateComando, deleteComando } = useApp();

  const [isNovoOpen, setIsNovoOpen] = useState(false);
  const [form, setForm] = useState<FormComando>(FORM_VAZIO);
  const [editando, setEditando] = useState<Comando | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!temPapel(usuarioAtual, 'master')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const nomeDaUbm = (id: string) => {
    const ubm = ubms.find((u) => u.id === id);
    return ubm ? `${ubm.sigla} - ${ubm.nome}` : 'UBM removida';
  };

  const alternarUbm = (lista: string[], ubmId: string) =>
    lista.includes(ubmId) ? lista.filter((id) => id !== ubmId) : [...lista, ubmId];

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.sigla) return;
    setSalvando(true);
    setErro(null);
    try {
      await addComando({ tipo: form.tipo, nome: form.nome, sigla: form.sigla, ubmIds: form.ubmIds });
      setForm(FORM_VAZIO);
      setIsNovoOpen(false);
    } catch (erroCriar) {
      setErro(erroCriar instanceof Error ? erroCriar.message : 'Não foi possível criar o comando.');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    setErro(null);
    try {
      await updateComando(editando.id, { tipo: editando.tipo, nome: editando.nome, sigla: editando.sigla, ubmIds: editando.ubmIds });
      setEditando(null);
    } catch (erroEditar) {
      setErro(erroEditar instanceof Error ? erroEditar.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comandos (CRB/COP)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cadastro dos Comandos Regionais de Bombeiros e Comandos de Operações, e das UBMs vinculadas a cada um —
            exclusivo do master.
          </p>
        </div>
        <button
          onClick={() => setIsNovoOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" /> Novo Comando
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comando</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UBMs vinculadas</th>
              <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {comandos.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-gray-500">Nenhum comando cadastrado ainda.</td>
              </tr>
            ) : (
              comandos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Shield className="w-6 h-6 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{c.sigla} — {TIPO_COMANDO_LABELS[c.tipo]}</div>
                        <div className="text-sm text-gray-500">{c.nome}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {c.ubmIds.length === 0 ? '—' : c.ubmIds.map(nomeDaUbm).join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button onClick={() => setEditando({ ...c })} className="text-red-600 hover:text-red-900" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteComando(c.id)} className="text-gray-400 hover:text-red-600" title="Excluir">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isNovoOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsNovoOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Novo Comando</h3>
            {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
            <form onSubmit={handleCriar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoComando })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm">
                  {TODOS_TIPOS.map((t) => <option key={t} value={t}>{TIPO_COMANDO_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sigla</label>
                <input required value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} placeholder="Ex: 5º CRB" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 5º Comando Regional de Bombeiros" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">UBMs vinculadas</label>
                <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {ubms.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                      <input type="checkbox" checked={form.ubmIds.includes(u.id)} onChange={() => setForm({ ...form, ubmIds: alternarUbm(form.ubmIds, u.id) })} className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" />
                      {u.sigla} - {u.nome}
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsNovoOpen(false)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={salvando} className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                  {salvando ? 'Criando...' : 'Criar Comando'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Comando</h3>
            {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value as TipoComando })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm">
                  {TODOS_TIPOS.map((t) => <option key={t} value={t}>{TIPO_COMANDO_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sigla</label>
                <input required value={editando.sigla} onChange={(e) => setEditando({ ...editando, sigla: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">UBMs vinculadas</label>
                <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {ubms.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm text-gray-800">
                      <input type="checkbox" checked={editando.ubmIds.includes(u.id)} onChange={() => setEditando({ ...editando, ubmIds: alternarUbm(editando.ubmIds, u.id) })} className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" />
                      {u.sigla} - {u.nome}
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setEditando(null)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={salvando} className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
