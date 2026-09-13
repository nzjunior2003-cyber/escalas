import { useState } from 'react';
import type { FormEvent } from 'react';
import { Search, UserPlus, ListPlus, Trash2, Edit2, X, ArrowLeftRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { buscarEfetivoDaPlanilha } from '../../lib/planilhaEfetivo';
import type { LinhaMilitar } from '../../lib/csvMilitares';
import MilitarPlanilhaAutocomplete from '../../components/MilitarPlanilhaAutocomplete';
import { Militar, temPapel } from '../../types';

export default function Efetivo() {
  const { usuarioAtual, militares, ubms, funcoes, addMilitar, updateMilitar, deleteMilitar, transferirMilitarDeUbm } = useApp();

  const [busca, setBusca] = useState('');
  const [militarEditando, setMilitarEditando] = useState<Militar | null>(null);
  const [isNovoOpen, setIsNovoOpen] = useState(false);
  const [novoMilitarForm, setNovoMilitarForm] = useState({ nome: '', posto: '', matricula: '' });
  const [transferindo, setTransferindo] = useState<Militar | null>(null);
  const [novaUbmId, setNovaUbmId] = useState('');

  const [isBuscaPlanilhaOpen, setIsBuscaPlanilhaOpen] = useState(false);
  const [linhasPlanilha, setLinhasPlanilha] = useState<LinhaMilitar[]>([]);
  const [carregandoPlanilha, setCarregandoPlanilha] = useState(false);
  const [erroPlanilha, setErroPlanilha] = useState<string | null>(null);
  const [buscaPlanilhaValor, setBuscaPlanilhaValor] = useState('');
  const [selecionadoPlanilha, setSelecionadoPlanilha] = useState<LinhaMilitar | null>(null);

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const ubmId = usuarioAtual!.ubmId;
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId);
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const nomeDaFuncao = (funcaoId: string) => funcoes.find((f) => f.id === funcaoId)?.nome ?? 'Função removida';
  const filtrados = militaresDaUbm.filter(
    (m) => m.nome.toLowerCase().includes(busca.toLowerCase()) || m.matricula.toLowerCase().includes(busca.toLowerCase()),
  );

  const abrirBuscaPlanilha = async () => {
    setIsBuscaPlanilhaOpen(true);
    setSelecionadoPlanilha(null);
    setBuscaPlanilhaValor('');
    if (linhasPlanilha.length > 0) return;
    setCarregandoPlanilha(true);
    setErroPlanilha(null);
    try {
      const linhas = await buscarEfetivoDaPlanilha();
      setLinhasPlanilha(linhas);
    } catch (erro) {
      setErroPlanilha(erro instanceof Error ? erro.message : 'Erro ao carregar a planilha de efetivo.');
    } finally {
      setCarregandoPlanilha(false);
    }
  };

  const jaCadastradoNaUbm = (matricula: string) =>
    !!matricula && militaresDaUbm.some((m) => m.matricula === matricula);

  const handleInserirDaPlanilha = async () => {
    if (!selecionadoPlanilha) return;
    await addMilitar({
      nome: selecionadoPlanilha.nome,
      posto: selecionadoPlanilha.posto,
      matricula: selecionadoPlanilha.matricula,
      ubmId,
      funcoes: [],
      ativo: true,
      origemCadastro: 'planilha',
    });
    setSelecionadoPlanilha(null);
    setBuscaPlanilhaValor('');
  };

  const handleCriarManual = async (e: FormEvent) => {
    e.preventDefault();
    if (!novoMilitarForm.nome) return;
    await addMilitar({
      nome: novoMilitarForm.nome,
      posto: novoMilitarForm.posto,
      matricula: novoMilitarForm.matricula,
      ubmId,
      funcoes: [],
      ativo: true,
      origemCadastro: 'manual',
    });
    setNovoMilitarForm({ nome: '', posto: '', matricula: '' });
    setIsNovoOpen(false);
  };

  const alternarFuncao = (militar: Militar, funcao: string) => {
    const jaTem = militar.funcoes.includes(funcao);
    const novasFuncoes = jaTem ? militar.funcoes.filter((f) => f !== funcao) : [...militar.funcoes, funcao];
    updateMilitar(militar.id, { funcoes: novasFuncoes });
    setMilitarEditando((atual) => (atual ? { ...atual, funcoes: novasFuncoes } : atual));
  };

  const confirmarTransferencia = async () => {
    if (!transferindo || !novaUbmId) return;
    await transferirMilitarDeUbm(transferindo.id, novaUbmId);
    setTransferindo(null);
    setNovaUbmId('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Efetivo</h1>
          <p className="mt-1 text-sm text-gray-500">Busca na planilha de efetivo, cadastro manual e atribuição de funções.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={abrirBuscaPlanilha}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ListPlus className="-ml-1 mr-2 h-5 w-5" /> Adicionar da planilha
          </button>
          <button
            onClick={() => setIsNovoOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
          >
            <UserPlus className="-ml-1 mr-2 h-5 w-5" /> Novo Militar
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
              placeholder="Buscar por nome ou matrícula..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Militar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funções</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">Nenhum militar encontrado.</td>
                </tr>
              ) : (
                filtrados.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{m.posto} {m.nome}</div>
                      <div className="text-sm text-gray-500">Matr. {m.matricula || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {m.funcoes.length === 0 ? (
                          <span className="text-xs text-gray-400">Nenhuma função atribuída</span>
                        ) : (
                          m.funcoes.map((f) => (
                            <span key={f} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                              {nomeDaFuncao(f)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button onClick={() => setMilitarEditando(m)} className="text-red-600 hover:text-red-900" title="Editar funções">
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => setTransferindo(m)} className="text-gray-500 hover:text-gray-800" title="Transferir de UBM">
                        <ArrowLeftRight className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => deleteMilitar(m.id)} className="text-gray-400 hover:text-red-600" title="Excluir">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {militarEditando && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button onClick={() => setMilitarEditando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-1">{militarEditando.posto} {militarEditando.nome}</h3>
            <p className="text-sm text-gray-500 mb-4">Funções operacionais (um militar pode acumular mais de uma)</p>
            <div className="space-y-2">
              {funcoesDaUbm.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  Nenhuma função cadastrada nesta UBM ainda. Cadastre em "Funções".
                </p>
              ) : (
                funcoesDaUbm.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm text-gray-800">
                    <input type="checkbox" checked={militarEditando.funcoes.includes(f.id)} onChange={() => alternarFuncao(militarEditando, f.id)} className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" />
                    {f.nome}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isBuscaPlanilhaOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button onClick={() => setIsBuscaPlanilhaOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Adicionar da planilha de efetivo</h3>
            <p className="text-sm text-gray-500 mb-4">
              Digite o nome, o cargo/posto ou a matrícula (MF). A busca é sempre feita ao vivo na
              planilha, então promoções e atualizações lá já aparecem aqui.
            </p>

            {carregandoPlanilha && <p className="text-sm text-gray-500">Carregando planilha...</p>}
            {erroPlanilha && <p className="text-sm text-red-600 mb-3">{erroPlanilha}</p>}

            {!carregandoPlanilha && !erroPlanilha && (
              <>
                <MilitarPlanilhaAutocomplete
                  linhas={linhasPlanilha}
                  value={buscaPlanilhaValor}
                  onChange={(v) => {
                    setBuscaPlanilhaValor(v);
                    setSelecionadoPlanilha(null);
                  }}
                  onSelect={(linha) => {
                    setSelecionadoPlanilha(linha);
                    setBuscaPlanilhaValor(linha.nome);
                  }}
                  placeholder="Buscar por nome, posto/cargo ou MF..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                />

                {selecionadoPlanilha && (
                  <div className="mt-4 p-3 rounded-md border border-gray-200 bg-gray-50">
                    <p className="text-sm font-medium text-gray-900">{selecionadoPlanilha.nome}</p>
                    <p className="text-xs text-gray-500">{selecionadoPlanilha.posto} — MF: {selecionadoPlanilha.matricula}</p>
                    {jaCadastradoNaUbm(selecionadoPlanilha.matricula) && (
                      <p className="text-xs text-amber-600 mt-1">Já cadastrado nesta UBM — inserir criará um segundo registro.</p>
                    )}
                    <button
                      onClick={handleInserirDaPlanilha}
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-red-700 hover:bg-red-800"
                    >
                      Inserir nesta UBM
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isNovoOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button onClick={() => setIsNovoOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Novo Militar (cadastro manual)</h3>
            <form onSubmit={handleCriarManual} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={novoMilitarForm.nome} onChange={(e) => setNovoMilitarForm({ ...novoMilitarForm, nome: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Posto/Graduação</label>
                <input value={novoMilitarForm.posto} onChange={(e) => setNovoMilitarForm({ ...novoMilitarForm, posto: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
                <input value={novoMilitarForm.matricula} onChange={(e) => setNovoMilitarForm({ ...novoMilitarForm, matricula: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsNovoOpen(false)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">Cadastrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferindo && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Transferir {transferindo.nome} de UBM</h3>
            <select value={novaUbmId} onChange={(e) => setNovaUbmId(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm mb-4">
              <option value="">Selecione a nova UBM</option>
              {ubms.filter((u) => u.id !== transferindo.ubmId).map((u) => (
                <option key={u.id} value={u.id}>{u.sigla} - {u.nome}</option>
              ))}
            </select>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setTransferindo(null)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarTransferencia} className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700">Transferir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
