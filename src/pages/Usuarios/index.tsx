import { useState } from 'react';
import type { FormEvent } from 'react';
import { Search, UserPlus, Shield, Edit2, X, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PAPEL_LABELS, Papel, Usuario, temPapel } from '../../types';

const TODOS_PAPEIS = Object.keys(PAPEL_LABELS) as Papel[];

export default function Usuarios() {
  const { usuarioAtual, usuarios, militares, updateUsuario, deleteUsuario, addUsuario } = useApp();

  const [busca, setBusca] = useState('');
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [isNovoOpen, setIsNovoOpen] = useState(false);
  const [usuarioExcluindo, setUsuarioExcluindo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [novoForm, setNovoForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: '',
    papeis: ['militar'] as Papel[],
    militarId: '',
    ativo: true,
  });

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const ubmId = usuarioAtual!.ubmId;
  const usuariosDaUbm = usuarios.filter((u) => u.ubmId === ubmId);
  const filtrados = usuariosDaUbm.filter((u) => u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase()));
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId);

  const alternarPapelEdicao = (papel: Papel) => {
    if (!usuarioEditando) return;
    const jaTem = usuarioEditando.papeis.includes(papel);
    const novosPapeis = jaTem ? usuarioEditando.papeis.filter((p) => p !== papel) : [...usuarioEditando.papeis, papel];
    setUsuarioEditando({ ...usuarioEditando, papeis: novosPapeis.length ? novosPapeis : ['militar'] });
  };

  const alternarPapelNovo = (papel: Papel) => {
    const jaTem = novoForm.papeis.includes(papel);
    const novosPapeis = jaTem ? novoForm.papeis.filter((p) => p !== papel) : [...novoForm.papeis, papel];
    setNovoForm({ ...novoForm, papeis: novosPapeis.length ? novosPapeis : ['militar'] });
  };

  const handleSalvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuarioEditando) return;
    try {
      await updateUsuario(usuarioEditando.id, {
        papeis: usuarioEditando.papeis,
        ativo: usuarioEditando.ativo,
        militarId: usuarioEditando.militarId || undefined,
      });
      setUsuarioEditando(null);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível salvar as alterações.');
    }
  };

  const confirmDelete = async () => {
    if (!usuarioExcluindo) return;
    try {
      await deleteUsuario(usuarioExcluindo);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível excluir o usuário.');
    } finally {
      setUsuarioExcluindo(null);
    }
  };

  const handleCriarUsuario = async (e: FormEvent) => {
    e.preventDefault();
    if (!novoForm.nome || !novoForm.email || !novoForm.senha) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    setSalvando(true);
    try {
      await addUsuario({
        nome: novoForm.nome,
        email: novoForm.email,
        senha: novoForm.senha,
        cargo: novoForm.cargo,
        ubmId,
        papeis: novoForm.papeis,
        militarId: novoForm.militarId || undefined,
        ativo: novoForm.ativo,
      });
      setIsNovoOpen(false);
      setNovoForm({ nome: '', email: '', senha: '', cargo: '', papeis: ['militar'], militarId: '', ativo: true });
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível criar o usuário.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="mt-1 text-sm text-gray-500">Aprovação de cadastro, perfis (papéis) e vínculo com a UBM.</p>
        </div>
        <button onClick={() => setIsNovoOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800">
          <UserPlus className="-ml-1 mr-2 h-5 w-5" /> Novo Usuário
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="h-5 w-5 text-gray-400" /></div>
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border" placeholder="Buscar por nome ou email..." />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Papéis</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtrados.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
              ) : (
                filtrados.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{u.nome}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        {u.papeis?.includes('comandante') && <Shield className="w-4 h-4 text-purple-600" />}
                        <span className="text-xs font-medium text-gray-700">
                          {u.papeis?.map((p) => PAPEL_LABELS[p]).join(', ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {u.ativo ? 'Ativo' : 'Pendente de aprovação'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => setUsuarioEditando({ ...u })} className="text-red-600 hover:text-red-900 mr-4" title="Editar"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setUsuarioExcluindo(u.id)} className="text-gray-400 hover:text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {usuarioEditando && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button onClick={() => setUsuarioEditando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Acessos</h3>
            <p className="text-sm font-medium text-gray-900">{usuarioEditando.nome}</p>
            <p className="text-sm text-gray-500 mb-4">{usuarioEditando.email}</p>

            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Papéis (pode acumular Comandante + Escalante)</label>
                <div className="space-y-1">
                  {TODOS_PAPEIS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm text-gray-800">
                      <input type="checkbox" checked={usuarioEditando.papeis.includes(p)} onChange={() => alternarPapelEdicao(p)} className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" />
                      {PAPEL_LABELS[p]}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vínculo com o Efetivo (para aparecer na escala)</label>
                <select value={usuarioEditando.militarId ?? ''} onChange={(e) => setUsuarioEditando({ ...usuarioEditando, militarId: e.target.value || undefined })} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md border sm:text-sm">
                  <option value="">Nenhum</option>
                  {militaresDaUbm.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>

              <div className="flex items-center mt-4">
                <input id="ativo" type="checkbox" checked={usuarioEditando.ativo} onChange={(e) => setUsuarioEditando({ ...usuarioEditando, ativo: e.target.checked })} className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" />
                <label htmlFor="ativo" className="ml-2 block text-sm text-gray-900">Usuário Ativo (aprovado)</label>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setUsuarioEditando(null)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNovoOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsNovoOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Novo Usuário</h3>
            <form onSubmit={handleCriarUsuario} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" required value={novoForm.nome} onChange={(e) => setNovoForm({ ...novoForm, nome: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={novoForm.email} onChange={(e) => setNovoForm({ ...novoForm, email: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Inicial (mín. 6)</label>
                <input type="password" required value={novoForm.senha} onChange={(e) => setNovoForm({ ...novoForm, senha: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Papéis</label>
                <div className="space-y-1">
                  {TODOS_PAPEIS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm text-gray-800">
                      <input type="checkbox" checked={novoForm.papeis.includes(p)} onChange={() => alternarPapelNovo(p)} className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" />
                      {PAPEL_LABELS[p]}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vínculo com o Efetivo (opcional)</label>
                <select value={novoForm.militarId} onChange={(e) => setNovoForm({ ...novoForm, militarId: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm">
                  <option value="">Nenhum</option>
                  {militaresDaUbm.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsNovoOpen(false)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={salvando} className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                  {salvando ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {usuarioExcluindo && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setUsuarioExcluindo(null)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
