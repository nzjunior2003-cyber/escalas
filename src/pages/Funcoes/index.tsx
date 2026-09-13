import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Edit2, Check, X, Power } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { temPapel } from '../../types';

export default function Funcoes() {
  const { usuarioAtual, funcoes, addFuncao, updateFuncao, deleteFuncao } = useApp();

  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const ubmId = usuarioAtual!.ubmId;
  const funcoesDaUbm = funcoes
    .filter((f) => f.ubmId === ubmId)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCriando(true);
    try {
      await addFuncao({ ubmId, nome: novoNome.trim() });
      setNovoNome('');
    } finally {
      setCriando(false);
    }
  };

  const iniciarEdicao = (id: string, nomeAtual: string) => {
    setEditandoId(id);
    setNomeEditado(nomeAtual);
  };

  const confirmarEdicao = async () => {
    if (!editandoId || !nomeEditado.trim()) return;
    await updateFuncao(editandoId, { nome: nomeEditado.trim() });
    setEditandoId(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Funções</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cadastre as funções do serviço ordinário (24h) desta UBM. Cada unidade tem suas próprias — depois de
          criadas, elas aparecem no menu de função ao atribuir o Efetivo e ao gerar/consultar a Escala.
        </p>
      </div>

      <form onSubmit={handleCriar} className="bg-white p-4 rounded-lg border border-gray-200 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Nova função</label>
          <input
            type="text"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Ex.: Motorista de Viatura, Chefe de Guarnição..."
            className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
          />
        </div>
        <button
          type="submit"
          disabled={criando || !novoNome.trim()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
        >
          <Plus className="-ml-1 mr-2 h-4 w-4" /> Cadastrar
        </button>
      </form>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 divide-y divide-gray-200">
        {funcoesDaUbm.length === 0 ? (
          <p className="p-6 text-center text-gray-500 text-sm">Nenhuma função cadastrada ainda.</p>
        ) : (
          funcoesDaUbm.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3">
              {editandoId === f.id ? (
                <input
                  autoFocus
                  value={nomeEditado}
                  onChange={(e) => setNomeEditado(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmarEdicao()}
                  className="flex-1 border border-gray-300 rounded-md text-sm py-1.5 px-2 mr-3"
                />
              ) : (
                <span className={`text-sm ${f.ativa ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{f.nome}</span>
              )}

              <div className="flex items-center gap-3 shrink-0">
                {editandoId === f.id ? (
                  <>
                    <button onClick={confirmarEdicao} className="text-emerald-600 hover:text-emerald-800" title="Salvar">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditandoId(null)} className="text-gray-400 hover:text-gray-600" title="Cancelar">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.ativa ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {f.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                    <button onClick={() => iniciarEdicao(f.id, f.nome)} className="text-red-600 hover:text-red-900" title="Renomear">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateFuncao(f.id, { ativa: !f.ativa })}
                      className={f.ativa ? 'text-gray-400 hover:text-gray-700' : 'text-emerald-600 hover:text-emerald-800'}
                      title={f.ativa ? 'Inativar' : 'Reativar'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteFuncao(f.id)} className="text-gray-400 hover:text-red-600" title="Excluir">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-gray-400">
        Inativar uma função a tira do menu de atribuição sem apagar o histórico de escalas já geradas com ela.
        Excluir remove o cadastro por completo — só faça isso se ela nunca chegou a ser usada.
      </p>
    </div>
  );
}
