import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, addMonths, addYears, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Plus, Sparkles, Lock, Megaphone, HandHeart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LIMITE_EXTRAORDINARIAS_POR_MES, extraordinariasNoMes, formatarDataISO, ordenarCandidatosExtraordinario, semanaInicioDe } from '../../lib/escala';
import { STATUS_VAGA_VOLUNTARIA_LABELS, temPapel } from '../../types';

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
  const { usuarioAtual, militares, funcoes, escalasOrdinarias, fechamentosEscala, gerarEPersistirEscalaOrdinaria, updateEscalaOrdinaria } = useApp();
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

  const estaTravada = (data: string) => {
    const docId = `${ubmId}_ordinaria_${semanaInicioDe(data)}`;
    return fechamentosEscala.find((f) => f.id === docId)?.travada ?? false;
  };

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
                const travada = estaTravada(dia);
                return (
                  <div key={dia} className="bg-white rounded-lg border border-gray-200 p-3 min-h-[140px]">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                      {format(new Date(dia + 'T00:00:00'), "EEE dd/MM", { locale: ptBR })}
                      {travada && <span title="Semana fechada"><Lock className="w-3 h-3 text-gray-400" /></span>}
                    </p>
                    <div className="space-y-2">
                      {doDia.length === 0 && <p className="text-xs text-gray-400">Sem escala</p>}
                      {doDia.map((e) => {
                        const militar = militares.find((m) => m.id === e.militarId);
                        return (
                          <div key={e.id} className="bg-red-50 border border-red-100 rounded-md p-2 text-xs">
                            <p className="font-medium text-red-900">{militar?.nome ?? 'Militar removido'}</p>
                            {e.origem === 'diferenciada' && (
                              <p className="text-[10px] uppercase text-amber-600 font-semibold">diferenciada</p>
                            )}
                            {isEscalante && !travada && e.origem !== 'diferenciada' && (
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
  const {
    usuarioAtual,
    militares,
    funcoes,
    afastamentos,
    escalasOrdinarias,
    escalasExtraordinarias,
    fechamentosEscala,
    vagasVoluntariasExtraordinarias,
    criarEscalaExtraordinaria,
    alterarMilitarExtraordinaria,
    dispararVagaVoluntariaExtraordinaria,
    voluntariarParaVaga,
    resolverVagaCompulsoriamente,
  } = useApp();
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const [form, setForm] = useState({ funcao: '', data: formatarDataISO(new Date()), motivo: '' });
  const [criando, setCriando] = useState(false);
  const [formVaga, setFormVaga] = useState({ funcao: '', data: formatarDataISO(new Date()), motivo: '', prazo: formatarDataISO(new Date()), quantidade: 1 });
  const [disparando, setDisparando] = useState(false);
  const [processandoVagaId, setProcessandoVagaId] = useState<string | null>(null);

  useEffect(() => {
    if (!form.funcao && funcoesDaUbm.length > 0) setForm((f) => ({ ...f, funcao: funcoesDaUbm[0].id }));
  }, [form.funcao, funcoesDaUbm]);
  useEffect(() => {
    if (!formVaga.funcao && funcoesDaUbm.length > 0) setFormVaga((f) => ({ ...f, funcao: funcoesDaUbm[0].id }));
  }, [formVaga.funcao, funcoesDaUbm]);

  const doUbm = escalasExtraordinarias.filter((e) => e.ubmId === ubmId).sort((a, b) => b.data.localeCompare(a.data));
  const nomeDaFuncao = (funcaoId: string) => funcoes.find((f) => f.id === funcaoId)?.nome ?? 'Função removida';
  const nomeMilitar = (id?: string) => militares.find((m) => m.id === id)?.nome ?? '—';
  const estaTravada = (data: string) => {
    const docId = `${ubmId}_extraordinaria_${semanaInicioDe(data)}`;
    return fechamentosEscala.find((f) => f.id === docId)?.travada ?? false;
  };

  const hoje = formatarDataISO(new Date());
  const meuMilitarId = usuarioAtual?.militarId;
  const vagasDaUbm = vagasVoluntariasExtraordinarias
    .filter((v) => v.ubmId === ubmId)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  const vagasAbertas = vagasDaUbm.filter((v) => v.status === 'aberta');
  const vagasResolvidas = vagasDaUbm.filter((v) => v.status !== 'aberta').slice(0, 15);

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

  const handleDisparar = async (e: FormEvent) => {
    e.preventDefault();
    setDisparando(true);
    try {
      await dispararVagaVoluntariaExtraordinaria({ ubmId, ...formVaga, quantidade: Math.max(1, formVaga.quantidade) });
      setFormVaga({ funcao: funcoesDaUbm[0]?.id ?? '', data: formatarDataISO(new Date()), motivo: '', prazo: formatarDataISO(new Date()), quantidade: 1 });
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível disparar a vaga pra voluntariado.');
    } finally {
      setDisparando(false);
    }
  };

  const handleVoluntariar = async (vagaId: string) => {
    setProcessandoVagaId(vagaId);
    try {
      await voluntariarParaVaga(vagaId);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível se voluntariar pra essa vaga.');
    } finally {
      setProcessandoVagaId(null);
    }
  };

  const handleResolverCompulsorio = async (vagaId: string) => {
    setProcessandoVagaId(vagaId);
    try {
      await resolverVagaCompulsoriamente(vagaId);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível resolver essa vaga compulsoriamente.');
    } finally {
      setProcessandoVagaId(null);
    }
  };

  return (
    <div className="space-y-6">
      {isEscalante && (
        <div className="space-y-4">
          <form onSubmit={handleDisparar} className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-red-600" /> Disparar vaga pra voluntários
            </h3>
            <p className="text-xs text-gray-500">
              Extraordinária é voluntária por natureza. O efetivo elegível recebe alerta com prazo; assim que alguém se
              voluntariar, o sistema já confirma. Se ninguém se voluntariar até o prazo, você resolve compulsoriamente.
            </p>
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:items-end">
              <div className="min-w-0 w-full sm:w-auto">
                <label className="block text-xs font-medium text-gray-500 mb-1">Função</label>
                <select value={formVaga.funcao} onChange={(e) => setFormVaga({ ...formVaga, funcao: e.target.value })} className="w-full sm:w-auto max-w-full border border-gray-300 rounded-md text-sm py-2 px-3">
                  {funcoesDaUbm.length === 0 && <option value="">Nenhuma função cadastrada</option>}
                  {funcoesDaUbm.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="min-w-0 w-full sm:w-auto">
                <label className="block text-xs font-medium text-gray-500 mb-1">Data do serviço</label>
                <input type="date" value={formVaga.data} onChange={(e) => setFormVaga({ ...formVaga, data: e.target.value })} className="w-full sm:w-auto border border-gray-300 rounded-md text-sm py-2 px-3" />
              </div>
              <div className="min-w-0 w-full sm:w-auto">
                <label className="block text-xs font-medium text-gray-500 mb-1">Prazo pra se voluntariar</label>
                <input type="date" value={formVaga.prazo} onChange={(e) => setFormVaga({ ...formVaga, prazo: e.target.value })} className="w-full sm:w-auto border border-gray-300 rounded-md text-sm py-2 px-3" />
              </div>
              <div className="min-w-0 w-full sm:w-24">
                <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade</label>
                <input
                  type="number"
                  min={1}
                  value={formVaga.quantidade}
                  onChange={(e) => setFormVaga({ ...formVaga, quantidade: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
                />
              </div>
              <div className="min-w-0 w-full sm:flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (ex.: reforço para evento)</label>
                <input required value={formVaga.motivo} onChange={(e) => setFormVaga({ ...formVaga, motivo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
              </div>
              <button type="submit" disabled={disparando} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
                <Megaphone className="-ml-1 mr-2 h-4 w-4" /> {disparando ? 'Disparando...' : 'Disparar vaga'}
              </button>
            </div>
          </form>

          <details className="bg-white p-4 rounded-lg border border-gray-200">
            <summary className="text-sm font-semibold text-gray-700 cursor-pointer">Escalar direto, sem passar por voluntariado</summary>
            <form onSubmit={handleCriar} className="mt-3 grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:items-end">
              <div className="min-w-0 w-full sm:w-auto">
                <label className="block text-xs font-medium text-gray-500 mb-1">Função</label>
                <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="w-full sm:w-auto border border-gray-300 rounded-md text-sm py-2 px-3">
                  {funcoesDaUbm.length === 0 && <option value="">Nenhuma função cadastrada</option>}
                  {funcoesDaUbm.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div className="min-w-0 w-full sm:w-auto">
                <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full sm:w-auto border border-gray-300 rounded-md text-sm py-2 px-3" />
              </div>
              <div className="min-w-0 w-full sm:flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (ex.: reforço para evento)</label>
                <input required value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
              </div>
              <button type="submit" disabled={criando} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-50">
                <Plus className="-ml-1 mr-2 h-4 w-4" /> Sugerir e cadastrar
              </button>
            </form>
          </details>
        </div>
      )}

      {vagasAbertas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <HandHeart className="w-4 h-4 text-emerald-600" /> Vagas aguardando voluntário
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {vagasAbertas.map((v) => {
              const prazoVencido = v.prazo < hoje;
              const jaVoluntariado = !!meuMilitarId && v.voluntariosIds.includes(meuMilitarId);
              const souElegivel = !!meuMilitarId && v.candidatosElegiveisIds.includes(meuMilitarId) && !jaVoluntariado;
              const faltam = v.quantidade - v.voluntariosIds.length;
              const listaPrevia = ordenarCandidatosExtraordinario({
                ubmId: v.ubmId,
                funcao: v.funcao,
                data: v.data,
                militares,
                afastamentos,
                escalasOrdinarias,
                extraordinariasAnteriores: escalasExtraordinarias,
              })
                .filter((m) => v.candidatosElegiveisIds.includes(m.id) && !v.voluntariosIds.includes(m.id))
                .slice(0, faltam);
              return (
                <div key={v.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">
                      {v.data} — {nomeDaFuncao(v.funcao)} <span className="text-xs text-gray-400 font-normal">({v.voluntariosIds.length}/{v.quantidade} preenchida{v.quantidade > 1 ? 's' : ''})</span>
                    </div>
                    <div className="text-gray-500">{v.motivo}</div>
                    {v.voluntariosIds.length > 0 && (
                      <div className="text-xs text-emerald-700 mt-0.5">Voluntários: {v.voluntariosIds.map((id) => nomeMilitar(id)).join(', ')}</div>
                    )}
                    {faltam > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Lista prévia se ninguém mais se voluntariar: {listaPrevia.length > 0 ? listaPrevia.map((m) => m.nome).join(', ') : '—'}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      Prazo pra voluntariar: {v.prazo}{prazoVencido && <span className="text-amber-600 font-medium"> · esgotado</span>}
                    </div>
                  </div>
                  <div className="shrink-0 self-end sm:self-auto">
                    {souElegivel && !prazoVencido && (
                      <button
                        onClick={() => handleVoluntariar(v.id)}
                        disabled={processandoVagaId === v.id}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <HandHeart className="-ml-1 mr-1.5 h-3.5 w-3.5" /> Quero me voluntariar
                      </button>
                    )}
                    {isEscalante && prazoVencido && (
                      <button
                        onClick={() => handleResolverCompulsorio(v.id)}
                        disabled={processandoVagaId === v.id}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        Prazo esgotado — completar compulsoriamente
                      </button>
                    )}
                    {jaVoluntariado && <span className="text-xs text-emerald-700 font-medium">Você já se voluntariou</span>}
                    {!souElegivel && !jaVoluntariado && !isEscalante && (
                      <span className="text-xs text-gray-400">Aguardando voluntário</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isEscalante && vagasResolvidas.length > 0 && (
        <details className="bg-white rounded-lg border border-gray-200">
          <summary className="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer">Histórico de vagas voluntárias resolvidas</summary>
          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {vagasResolvidas.map((v) => (
              <div key={v.id} className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{v.data} — {nomeDaFuncao(v.funcao)}</div>
                  <div className="text-gray-500">
                    {STATUS_VAGA_VOLUNTARIA_LABELS[v.status]}
                    {v.voluntariosIds.length > 0 && ` · Voluntário(s): ${v.voluntariosIds.map((id) => nomeMilitar(id)).join(', ')}`}
                    {(v.militaresCompulsoriosIds?.length ?? 0) > 0 && ` · Compulsório(s): ${v.militaresCompulsoriosIds!.map((id) => nomeMilitar(id)).join(', ')}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {doUbm.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400">Nenhuma escala extraordinária cadastrada.</p>
        ) : (
          doUbm.map((e) => {
            const sugerido = militares.find((m) => m.id === e.militarSugeridoId);
            const candidatos = militares.filter((m) => m.ubmId === ubmId && m.ativo && m.funcoes.includes(e.funcao));
            const travada = estaTravada(e.data);

            const handleAlterar = async (novoMilitarId: string) => {
              try {
                await alterarMilitarExtraordinaria(e.id, novoMilitarId);
              } catch (erro) {
                alert(erro instanceof Error ? erro.message : 'Não foi possível alterar o militar escalado.');
              }
            };

            return (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{e.data} — {nomeDaFuncao(e.funcao)}</div>
                  <div className="text-gray-500">{e.motivo}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Sugerido: {sugerido?.nome ?? '—'}</div>
                </div>
                <div className="shrink-0">
                  {isEscalante && !travada ? (
                    <select value={e.militarId} onChange={(ev) => handleAlterar(ev.target.value)} className="border border-gray-200 rounded text-sm max-w-full">
                      {candidatos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({extraordinariasNoMes(m.id, e.data, escalasExtraordinarias)}/{LIMITE_EXTRAORDINARIAS_POR_MES} no mês)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {militares.find((m) => m.id === e.militarId)?.nome ?? '—'}
                      {travada && <span title="Semana fechada"><Lock className="w-3 h-3 text-gray-400" /></span>}
                    </span>
                  )}
                  {e.militarId !== e.militarSugeridoId && (
                    <span className="ml-2 text-[10px] uppercase text-amber-600 font-semibold">alterado</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AbaDiferenciada({ ubmId }: { ubmId: string }) {
  const {
    usuarioAtual,
    militares,
    funcoes,
    escalasDiferenciadas,
    criarEscalaDiferenciada,
    atualizarEscalaDiferenciada,
    removerEscalaDiferenciada,
  } = useApp();

  const isEscalante = temPapel(usuarioAtual, 'escalante');
  const isComandante = temPapel(usuarioAtual, 'comandante');
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo);

  const [form, setForm] = useState({ militarId: '', funcao: '', data: formatarDataISO(new Date()), observacao: '' });
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState({ militarId: '', funcao: '', data: '', observacao: '' });

  useEffect(() => {
    if (!form.funcao && funcoesDaUbm.length > 0) setForm((f) => ({ ...f, funcao: funcoesDaUbm[0].id }));
  }, [form.funcao, funcoesDaUbm]);

  const doUbm = escalasDiferenciadas.filter((e) => e.ubmId === ubmId).sort((a, b) => a.data.localeCompare(b.data));
  const nomeDaFuncao = (id: string) => funcoes.find((f) => f.id === id)?.nome ?? 'Função removida';

  const handleCriar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.militarId || !form.funcao) return;
    setCriando(true);
    try {
      await criarEscalaDiferenciada({ ...form, ubmId });
      setForm({ militarId: '', funcao: funcoesDaUbm[0]?.id ?? '', data: formatarDataISO(new Date()), observacao: '' });
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível cadastrar a escala diferenciada.');
    } finally {
      setCriando(false);
    }
  };

  const iniciarEdicao = (id: string) => {
    const atual = doUbm.find((e) => e.id === id);
    if (!atual) return;
    setEditandoId(id);
    setEdicao({ militarId: atual.militarId, funcao: atual.funcao, data: atual.data, observacao: atual.observacao ?? '' });
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;
    try {
      await atualizarEscalaDiferenciada(editandoId, edicao);
      setEditandoId(null);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível salvar a alteração.');
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4">
        Pra militares que só podem servir em dias específicos. Ao cadastrar, o dia já entra na escala ordinária normal
        (Kanban, PDF e contagem de equidade) — depois de cadastrado, só o Comandante da UBM pode alterar ou remover.
      </p>

      {isEscalante && (
        <form onSubmit={handleCriar} className="bg-white p-4 rounded-lg border border-gray-200 grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:items-end">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">Militar</label>
            <select value={form.militarId} onChange={(e) => setForm({ ...form, militarId: e.target.value })} className="w-full sm:w-auto max-w-full border border-gray-300 rounded-md text-sm py-2 px-3">
              <option value="">Selecione</option>
              {militaresDaUbm.map((m) => <option key={m.id} value={m.id}>{m.posto} {m.nome}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">Função</label>
            <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="w-full sm:w-auto max-w-full border border-gray-300 rounded-md text-sm py-2 px-3">
              {funcoesDaUbm.length === 0 && <option value="">Nenhuma função cadastrada</option>}
              {funcoesDaUbm.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full sm:w-auto border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div className="min-w-0 sm:flex-1 sm:min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Observação (opcional)</label>
            <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <button type="submit" disabled={criando || !form.militarId || !form.funcao} className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
            <CalendarDays className="-ml-1 mr-2 h-4 w-4" /> Cadastrar dia diferenciado
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {doUbm.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400">Nenhuma escala diferenciada registrada.</p>
        ) : (
          doUbm.map((e) => {
            const militar = militares.find((m) => m.id === e.militarId);
            const emEdicao = editandoId === e.id;

            if (emEdicao) {
              return (
                <div key={e.id} className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:items-center px-4 py-3 text-sm">
                  <input type="date" value={edicao.data} onChange={(ev) => setEdicao({ ...edicao, data: ev.target.value })} className="border border-gray-300 rounded text-xs py-1.5 px-2" />
                  <select value={edicao.militarId} onChange={(ev) => setEdicao({ ...edicao, militarId: ev.target.value })} className="border border-gray-300 rounded text-xs py-1.5 px-2 max-w-full">
                    {militaresDaUbm.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                  <select value={edicao.funcao} onChange={(ev) => setEdicao({ ...edicao, funcao: ev.target.value })} className="border border-gray-300 rounded text-xs py-1.5 px-2 max-w-full">
                    {funcoesDaUbm.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                  <input value={edicao.observacao} onChange={(ev) => setEdicao({ ...edicao, observacao: ev.target.value })} placeholder="Observação" className="border border-gray-300 rounded text-xs py-1.5 px-2 sm:flex-1 sm:min-w-[140px]" />
                  <div className="flex gap-3 justify-end">
                    <button onClick={salvarEdicao} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{e.data} — {militar?.nome ?? '—'}</div>
                  <div className="text-gray-500">{nomeDaFuncao(e.funcao)}{e.observacao ? ` · ${e.observacao}` : ''}</div>
                </div>
                <div className="shrink-0">
                  {isComandante ? (
                    <div className="flex gap-3">
                      <button onClick={() => iniciarEdicao(e.id)} className="text-xs text-red-600 hover:text-red-800">Editar</button>
                      <button onClick={() => removerEscalaDiferenciada(e.id)} className="text-xs text-gray-500 hover:text-red-700">Remover</button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Só o Comandante altera</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
