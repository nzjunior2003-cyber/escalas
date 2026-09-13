import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, addMonths, addYears, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Plus, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LIMITE_EXTRAORDINARIAS_POR_MES, extraordinariasNoMes, formatarDataISO } from '../../lib/escala';
import { temPapel } from '../../types';

type Aba = 'ordinaria' | 'extraordinaria' | 'diferenciada';
type Granularidade = 'semanal' | 'mensal' | 'anual';

function intervaloPorGranularidade(granularidade: Granularidade, base: Date): { inicio: string; fim: string; dias: string[] } {
  if (granularidade === 'semanal') {
    const inicio = startOfWeek(base, { weekStartsOn: 1 });
    const dias = Array.from({ length: 7 }, (_, i) => formatarDataISO(addDays(inicio, i)));
    return { inicio: dias[0], fim: dias[6], dias };
  }
  if (granularidade === 'mensal') {
    const inicio = formatarDataISO(base);
    const fim = formatarDataISO(addMonths(base, 1));
    return { inicio, fim, dias: [] };
  }
  const inicio = formatarDataISO(base);
  const fim = formatarDataISO(addYears(base, 1));
  return { inicio, fim, dias: [] };
}

export default function Escala() {
  const { usuarioAtual, militares, funcoes, escalasOrdinarias, gerarEPersistirEscalaOrdinaria, updateEscalaOrdinaria } = useApp();
  const [aba, setAba] = useState<Aba>('ordinaria');
  const [granularidade, setGranularidade] = useState<Granularidade>('semanal');
  const [funcaoSelecionada, setFuncaoSelecionada] = useState<string>('');
  const [gerando, setGerando] = useState(false);

  const ubmId = usuarioAtual?.ubmId ?? '';
  const isEscalante = temPapel(usuarioAtual, 'escalante');
  const { inicio, fim, dias } = useMemo(() => intervaloPorGranularidade(granularidade, new Date()), [granularidade]);

  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  useEffect(() => {
    if (!funcaoSelecionada && funcoesDaUbm.length > 0) setFuncaoSelecionada(funcoesDaUbm[0].id);
  }, [funcaoSelecionada, funcoesDaUbm]);
  const nomeDaFuncaoSelecionada = funcoes.find((f) => f.id === funcaoSelecionada)?.nome ?? '';

  const militaresDaFuncaoNaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo && m.funcoes.includes(funcaoSelecionada));

  const handleGerar = async () => {
    setGerando(true);
    try {
      const total = await gerarEPersistirEscalaOrdinaria({ ubmId, funcao: funcaoSelecionada, dataInicio: inicio, dataFim: fim });
      alert(`Previsão gerada: ${total} dias de escala para ${nomeDaFuncaoSelecionada}.`);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível gerar a escala.');
    } finally {
      setGerando(false);
    }
  };

  const escalasDoPeriodo = escalasOrdinarias.filter(
    (e) => e.ubmId === ubmId && e.funcao === funcaoSelecionada && e.data >= inicio && e.data <= fim,
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escala</h1>
        <p className="mt-1 text-sm text-gray-500">Previsão da escala em Kanban, com ordinária, extraordinária e diferenciada.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['ordinaria', 'extraordinaria', 'diferenciada'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {a === 'ordinaria' ? 'Ordinária' : a === 'extraordinaria' ? 'Extraordinária' : 'Diferenciada'}
          </button>
        ))}
      </div>

      {aba === 'ordinaria' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-lg border border-gray-200">
            <select value={funcaoSelecionada} onChange={(e) => setFuncaoSelecionada(e.target.value)} className="border border-gray-300 rounded-md text-sm py-2 px-3">
              {funcoesDaUbm.length === 0 && <option value="">Nenhuma função cadastrada</option>}
              {funcoesDaUbm.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
            <div className="flex gap-1">
              {(['semanal', 'mensal', 'anual'] as Granularidade[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularidade(g)}
                  className={`px-3 py-2 text-sm rounded-md ${granularidade === g ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {g === 'semanal' ? 'Semanal' : g === 'mensal' ? 'Mensal' : 'Anual'}
                </button>
              ))}
            </div>
            {isEscalante && (
              <button
                onClick={handleGerar}
                disabled={gerando || militaresDaFuncaoNaUbm.length === 0}
                className="ml-auto inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                <Sparkles className="-ml-1 mr-2 h-4 w-4" /> {gerando ? 'Gerando...' : 'Gerar previsão'}
              </button>
            )}
          </div>

          {funcoesDaUbm.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Nenhuma função cadastrada nesta UBM ainda. Cadastre em "Funções" antes de gerar a escala.
            </p>
          ) : militaresDaFuncaoNaUbm.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Nenhum militar ativo com a função "{nomeDaFuncaoSelecionada}" nesta UBM. Atribua a função no módulo Efetivo.
            </p>
          ) : null}

          {granularidade === 'semanal' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {dias.map((dia) => {
                const doDia = escalasDoPeriodo.filter((e) => e.data === dia);
                return (
                  <div key={dia} className="bg-white rounded-lg border border-gray-200 p-3 min-h-[140px]">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                      {format(new Date(dia + 'T00:00:00'), "EEE dd/MM", { locale: ptBR })}
                    </p>
                    <div className="space-y-2">
                      {doDia.length === 0 && <p className="text-xs text-gray-400">Sem escala</p>}
                      {doDia.map((e) => {
                        const militar = militares.find((m) => m.id === e.militarId);
                        return (
                          <div key={e.id} className="bg-red-50 border border-red-100 rounded-md p-2 text-xs">
                            <p className="font-medium text-red-900">{militar?.nome ?? 'Militar removido'}</p>
                            {isEscalante && (
                              <select
                                className="mt-1 w-full text-xs border-gray-200 rounded"
                                value={e.militarId}
                                onChange={(ev) => updateEscalaOrdinaria(e.id, ev.target.value)}
                              >
                                {militaresDaFuncaoNaUbm.map((m) => (
                                  <option key={m.id} value={m.id}>{m.nome}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Data</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Militar</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {escalasDoPeriodo
                    .sort((a, b) => a.data.localeCompare(b.data))
                    .map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-2">{format(new Date(e.data + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-2">{militares.find((m) => m.id === e.militarId)?.nome ?? '—'}</td>
                        <td className="px-4 py-2 capitalize">{e.origem}</td>
                      </tr>
                    ))}
                  {escalasDoPeriodo.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Nenhuma escala no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === 'extraordinaria' && <AbaExtraordinaria ubmId={ubmId} isEscalante={isEscalante} />}
      {aba === 'diferenciada' && <AbaDiferenciada ubmId={ubmId} />}
    </div>
  );
}

function AbaExtraordinaria({ ubmId, isEscalante }: { ubmId: string; isEscalante: boolean }) {
  const { militares, funcoes, escalasExtraordinarias, criarEscalaExtraordinaria, alterarMilitarExtraordinaria } = useApp();
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const [form, setForm] = useState({ funcao: '', data: formatarDataISO(new Date()), motivo: '' });
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!form.funcao && funcoesDaUbm.length > 0) setForm((f) => ({ ...f, funcao: funcoesDaUbm[0].id }));
  }, [form.funcao, funcoesDaUbm]);

  const doUbm = escalasExtraordinarias.filter((e) => e.ubmId === ubmId).sort((a, b) => b.data.localeCompare(a.data));
  const nomeDaFuncao = (funcaoId: string) => funcoes.find((f) => f.id === funcaoId)?.nome ?? 'Função removida';

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    setCriando(true);
    try {
      await criarEscalaExtraordinaria({ ubmId, ...form });
      setForm({ funcao: funcoesDaUbm[0]?.id ?? '', data: formatarDataISO(new Date()), motivo: '' });
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível criar a escala extraordinária.');
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="space-y-4">
      {isEscalante && (
        <form onSubmit={handleCriar} className="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Função</label>
            <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="border border-gray-300 rounded-md text-sm py-2 px-3">
              {funcoesDaUbm.length === 0 && <option value="">Nenhuma função cadastrada</option>}
              {funcoesDaUbm.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (ex.: reforço para evento)</label>
            <input required value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <button type="submit" disabled={criando} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
            <Plus className="-ml-1 mr-2 h-4 w-4" /> Sugerir e cadastrar
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Data</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Função</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Motivo</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Sugerido</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Escalado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {doUbm.map((e) => {
              const sugerido = militares.find((m) => m.id === e.militarSugeridoId);
              const candidatos = militares.filter((m) => m.ubmId === ubmId && m.ativo && m.funcoes.includes(e.funcao));

              const handleAlterar = async (novoMilitarId: string) => {
                try {
                  await alterarMilitarExtraordinaria(e.id, novoMilitarId);
                } catch (erro) {
                  alert(erro instanceof Error ? erro.message : 'Não foi possível alterar o militar escalado.');
                }
              };

              return (
                <tr key={e.id}>
                  <td className="px-4 py-2">{e.data}</td>
                  <td className="px-4 py-2">{nomeDaFuncao(e.funcao)}</td>
                  <td className="px-4 py-2">{e.motivo}</td>
                  <td className="px-4 py-2 text-gray-500">{sugerido?.nome ?? '—'}</td>
                  <td className="px-4 py-2">
                    {isEscalante ? (
                      <select value={e.militarId} onChange={(ev) => handleAlterar(ev.target.value)} className="border border-gray-200 rounded text-sm">
                        {candidatos.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome} ({extraordinariasNoMes(m.id, e.data, escalasExtraordinarias)}/{LIMITE_EXTRAORDINARIAS_POR_MES} no mês)
                          </option>
                        ))}
                      </select>
                    ) : (
                      militares.find((m) => m.id === e.militarId)?.nome ?? '—'
                    )}
                    {e.militarId !== e.militarSugeridoId && (
                      <span className="ml-2 text-[10px] uppercase text-amber-600 font-semibold">alterado</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {doUbm.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhuma escala extraordinária cadastrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbaDiferenciada({ ubmId }: { ubmId: string }) {
  const {
    usuarioAtual,
    militares,
    escalasDiferenciadas,
    solicitacoesAlteracaoDiferenciada,
    solicitarEscalaDiferenciada,
    removerEscalaDiferenciada,
    solicitarAlteracaoDiferenciada,
    responderAlteracaoDiferenciada,
  } = useApp();

  const isEscalante = temPapel(usuarioAtual, 'escalante');
  const isComandante = temPapel(usuarioAtual, 'comandante');
  const meuMilitarId = usuarioAtual?.militarId;

  const [novaData, setNovaData] = useState(formatarDataISO(new Date()));
  const [observacao, setObservacao] = useState('');
  const [motivoAlteracao, setMotivoAlteracao] = useState<Record<string, string>>({});

  const doUbm = escalasDiferenciadas.filter((e) => e.ubmId === ubmId).sort((a, b) => a.data.localeCompare(b.data));
  const pendentes = solicitacoesAlteracaoDiferenciada.filter((s) => s.ubmId === ubmId && s.status === 'pendente');

  const handleSolicitar = async (e: FormEvent) => {
    e.preventDefault();
    if (!meuMilitarId) return;
    await solicitarEscalaDiferenciada({ militarId: meuMilitarId, ubmId, data: novaData, observacao });
    setObservacao('');
  };

  return (
    <div className="space-y-6">
      {meuMilitarId && (
        <form onSubmit={handleSolicitar} className="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
            <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Observação (opcional)</label>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <button type="submit" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800">
            <CalendarDays className="-ml-1 mr-2 h-4 w-4" /> Indicar dia diferenciado
          </button>
        </form>
      )}

      {isComandante && pendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">Alterações de escala diferenciada aguardando sua autorização</h3>
          {pendentes.map((s) => {
            const militar = militares.find((m) => m.id === s.militarId);
            return (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-md p-3 border border-amber-100">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{militar?.nome ?? 'Militar'}</p>
                  <p className="text-gray-500">Motivo: {s.motivo}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => responderAlteracaoDiferenciada(s.id, true)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Autorizar</button>
                  <button onClick={() => responderAlteracaoDiferenciada(s.id, false)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300">Negar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Data</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Militar</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Observação</th>
              <th className="relative px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {doUbm.map((e) => {
              const militar = militares.find((m) => m.id === e.militarId);
              const jaTemPendencia = solicitacoesAlteracaoDiferenciada.some((s) => s.escalaDiferenciadaId === e.id && s.status === 'pendente');
              return (
                <tr key={e.id}>
                  <td className="px-4 py-2">{e.data}</td>
                  <td className="px-4 py-2">{militar?.nome ?? '—'}</td>
                  <td className="px-4 py-2">{e.observacao || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {e.militarId === meuMilitarId ? (
                      <button onClick={() => removerEscalaDiferenciada(e.id)} className="text-xs text-red-600 hover:text-red-800">Remover</button>
                    ) : isEscalante && !jaTemPendencia ? (
                      <div className="flex gap-2 items-center justify-end">
                        <input
                          placeholder="Motivo da alteração"
                          value={motivoAlteracao[e.id] ?? ''}
                          onChange={(ev) => setMotivoAlteracao({ ...motivoAlteracao, [e.id]: ev.target.value })}
                          className="border border-gray-200 rounded text-xs px-2 py-1"
                        />
                        <button
                          onClick={() => solicitarAlteracaoDiferenciada({ escalaDiferenciadaId: e.id, motivo: motivoAlteracao[e.id] ?? '' })}
                          className="text-xs text-amber-700 hover:text-amber-900 font-medium"
                        >
                          Solicitar alteração
                        </button>
                      </div>
                    ) : jaTemPendencia ? (
                      <span className="text-xs text-amber-600">Alteração pendente</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {doUbm.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhuma escala diferenciada registrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
