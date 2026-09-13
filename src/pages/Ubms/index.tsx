import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Building2, Plus, Edit2, X, Upload } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { redimensionarImagemParaDataUrl } from '../../lib/imagem';
import { temPapel, type Ubm } from '../../types';

/** Cadastro de UBMs — exclusivo do master (seção "Papéis" do sistema). */
export default function Ubms() {
  const { usuarioAtual, ubms, usuarios, addUbm, updateUbm } = useApp();

  const [isNovoOpen, setIsNovoOpen] = useState(false);
  const [editando, setEditando] = useState<Ubm | null>(null);
  const [form, setForm] = useState<{ nome: string; sigla: string; logoDataUrl?: string; endereco: string; cep: string; bairro: string; cidade: string; email: string; telefone: string }>({
    nome: '',
    sigla: '',
    endereco: '',
    cep: '',
    bairro: '',
    cidade: '',
    email: '',
    telefone: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputNovoRef = useRef<HTMLInputElement>(null);
  const inputEditarRef = useRef<HTMLInputElement>(null);

  if (!temPapel(usuarioAtual, 'master')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const contarUsuarios = (ubmId: string) => usuarios.filter((u) => u.ubmId === ubmId).length;

  const handleSelecionarLogo = async (e: ChangeEvent<HTMLInputElement>, destino: 'novo' | 'editar') => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    const dataUrl = await redimensionarImagemParaDataUrl(arquivo, 200);
    if (!dataUrl) {
      setErro('Não foi possível ler essa imagem.');
      return;
    }
    if (destino === 'novo') {
      setForm({ ...form, logoDataUrl: dataUrl });
    } else if (editando) {
      setEditando({ ...editando, logoDataUrl: dataUrl });
    }
  };

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.sigla) return;
    setSalvando(true);
    setErro(null);
    try {
      await addUbm({
        nome: form.nome,
        sigla: form.sigla,
        logoDataUrl: form.logoDataUrl,
        endereco: form.endereco || undefined,
        cep: form.cep || undefined,
        bairro: form.bairro || undefined,
        cidade: form.cidade || undefined,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
      });
      setForm({ nome: '', sigla: '', endereco: '', cep: '', bairro: '', cidade: '', email: '', telefone: '' });
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
      await updateUbm(editando.id, {
        nome: editando.nome,
        sigla: editando.sigla,
        logoDataUrl: editando.logoDataUrl,
        endereco: editando.endereco,
        cep: editando.cep,
        bairro: editando.bairro,
        cidade: editando.cidade,
        email: editando.email,
        telefone: editando.telefone,
      });
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

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 divide-y divide-gray-200">
        {ubms.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-500">Nenhuma UBM cadastrada ainda.</p>
        ) : (
          ubms.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                {u.logoDataUrl ? (
                  <img src={u.logoDataUrl} alt="" className="w-8 h-8 object-contain shrink-0" />
                ) : (
                  <Building2 className="w-6 h-6 text-gray-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{u.sigla}</div>
                  <div className="text-sm text-gray-500 truncate">{u.nome}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline text-xs text-gray-400">{contarUsuarios(u.id)} usuário(s)</span>
                <button onClick={() => setEditando({ ...u })} className="p-2 -m-2 text-red-600 hover:text-red-900" title="Editar">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isNovoOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsNovoOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Nova UBM</h3>
            {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
            <form onSubmit={handleCriar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brasão da UBM (opcional)</label>
                <div className="flex items-center gap-3">
                  {form.logoDataUrl ? (
                    <img src={form.logoDataUrl} alt="" className="w-12 h-12 object-contain border border-gray-200 rounded" />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center border border-dashed border-gray-300 rounded text-gray-300">
                      <Building2 className="w-6 h-6" />
                    </div>
                  )}
                  <input ref={inputNovoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleSelecionarLogo(e, 'novo')} />
                  <button type="button" onClick={() => inputNovoRef.current?.click()} className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50">
                    <Upload className="-ml-0.5 mr-1.5 h-3.5 w-3.5" /> Escolher imagem
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sigla</label>
                <input required value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} placeholder="Ex: 1º GB" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 1º Grupamento de Bombeiros" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <p className="text-xs font-medium text-gray-500 pt-2 border-t border-gray-100">Endereço (mostrado no rodapé do PDF de escala)</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex: Belém" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
                </div>
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Editar UBM</h3>
            {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brasão da UBM (opcional)</label>
                <div className="flex items-center gap-3">
                  {editando.logoDataUrl ? (
                    <img src={editando.logoDataUrl} alt="" className="w-12 h-12 object-contain border border-gray-200 rounded" />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center border border-dashed border-gray-300 rounded text-gray-300">
                      <Building2 className="w-6 h-6" />
                    </div>
                  )}
                  <input ref={inputEditarRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleSelecionarLogo(e, 'editar')} />
                  <button type="button" onClick={() => inputEditarRef.current?.click()} className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50">
                    <Upload className="-ml-0.5 mr-1.5 h-3.5 w-3.5" /> Trocar imagem
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sigla</label>
                <input required value={editando.sigla} onChange={(e) => setEditando({ ...editando, sigla: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <p className="text-xs font-medium text-gray-500 pt-2 border-t border-gray-100">Endereço (mostrado no rodapé do PDF de escala)</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input value={editando.endereco ?? ''} onChange={(e) => setEditando({ ...editando, endereco: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <input value={editando.bairro ?? ''} onChange={(e) => setEditando({ ...editando, bairro: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <input value={editando.cep ?? ''} onChange={(e) => setEditando({ ...editando, cep: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input value={editando.cidade ?? ''} onChange={(e) => setEditando({ ...editando, cidade: e.target.value })} placeholder="Ex: Belém" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input type="email" value={editando.email ?? ''} onChange={(e) => setEditando({ ...editando, email: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input value={editando.telefone ?? ''} onChange={(e) => setEditando({ ...editando, telefone: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
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
