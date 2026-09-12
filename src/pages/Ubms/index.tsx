import { useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, Plus, Edit2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { temPapel, type Ubm } from '../../types';

/** Cadastro de UBMs — exclusivo do master (seção "Papéis" do sistema). */
export default function Ubms() {
  const { usuarioAtual, ubms, usuarios, addUbm, updateUbm } = useApp();

  const [isNovoOpen, setIsNovoOpen] = useState(false);
  const [editando, setEditando] = useState<Ubm | null>(null);
  const [form, setForm] = useState({ nome: '', sigla: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!temPapel(usuarioAtual, 'master')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const contarUsuarios = (ubmId: string) => usuarios.filter((u) => u.ubmId === ubmId).length;

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.sigla) return;
    setSalvando(true);
    setErro(null);
    try {
      await addUbm({ nome: form.nome, sigla: form.sigla });
      setForm({ nome: '', sigla: '' });
      setIsNovoOpen(false);
    } catch (erroCriar) {
      setErro(erroCriar instanceof Error ? erroCriar.message : 'Não foi possível criar a UBM.');
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
      await updateUbm(editando.id, { nome: editando.nome, sigla: editando.sigla });
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
          <h1 className="text-2xl font-bold text-gray-900">UBMs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cadastro das Unidades de Bombeiro Militar — exclusivo do master.
          </p>
        </div>
        <button
          onClick={() => setIsNovoOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" /> Nova UBM
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UBM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuários vinculados</th>
              <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ubms.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                  Nenhuma UBM cadastrada ainda.
                </td>
              </tr>
            ) : (
              ubms.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{u.sigla}</div>
                        <div className="text-sm text-gray-500">{u.nome}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contarUsuarios(u.id)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => setEditando({ ...u })} className="text-red-600 hover:text-red-900" title="Editar">
                      <Edit2 className="w-4 h-4" />
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
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <button onClick={() => setIsNovoOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Nova UBM</h3>
            {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
            <form onSubmit={handleCriar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sigla</label>
                <input required value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} placeholder="Ex: 1º GB" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 1º Grupamento de Bombeiros" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsNovoOpen(false)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={salvando} className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                  {salvando ? 'Criando...' : 'Criar UBM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <button onClick={() => setEditando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Editar UBM</h3>
            {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sigla</label>
                <input required value={editando.sigla} onChange={(e) => setEditando({ ...editando, sigla: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
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
