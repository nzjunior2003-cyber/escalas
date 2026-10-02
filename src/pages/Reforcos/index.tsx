import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Send, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { extraordinariasNoMes, formatarDataISO, LIMITE_EXTRAORDINARIAS_POR_MES } from '../../lib/escala';
import { STATUS_SOLICITACAO_REFORCO_LABELS, temPapel, TIPO_REFORCO_LABELS, type TipoReforco } from '../../types';

export default function Reforcos() {
  const { usuarioAtual } = useApp();

  const isComando = temPapel(usuarioAtual, 'crb') || temPapel(usuarioAtual, 'cop');
  const isGestao = temPapel(usuarioAtual, 'comandante') || temPapel(usuarioAtual, 'escalante');
  const souMilitar = !!usuarioAtual?.militarId;

  if (!isComando && !isGestao && !souMilitar) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reforços</h1>
        <p className="mt-1 text-sm text-gray-500">Solicitação de militares do CRB/COP às UBMs vinculadas, para escala extraordinária ou operação.</p>
      </div>

      {isComando && <PainelComando />}
      {isGestao && <PainelUbm />}
      {souMilitar && <VoluntariadoOperacaoMilitar />}
    </div>
  );
}

function PainelComando() {
  const { usuarioAtual, comandos, ubms, funcoes, militares, solicitacoesReforco, escalasComando, criarSolicitacaoReforco } = useApp();
  const meuComando = comandos.find((c) => c.id === usuarioAtual?.comandoId);

  const [form, setForm] = useState<{ ubmId: string; funcao: string; postoDesejado: string; data: string; tipo: TipoReforco; motivo: string }>({
    ubmId: '',
    funcao: '',
    postoDesejado: '',
    data: formatarDataISO(new Date()),
    tipo: 'escala_extraordinaria',
    motivo: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ubmsVinculadas = ubms.filter((u) => meuComando?.ubmIds.includes(u.id));
  const funcoesDaUbmSelecionada = funcoes.filter((f) => f.ubmId === form.ubmId && f.ativa);

  useEffect(() => {
    if (!form.funcao && funcoesDaUbmSelecionada.length > 0) {
      setForm((f) => ({ ...f, funcao: funcoesDaUbmSelecionada[0].id }));
    }
  }, [form.funcao, funcoesDaUbmSelecionada]);

  const minhasSolicitacoes = solicitacoesReforco
    .filter((s) => s.comandoId === meuComando?.id)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  const escalaDoComando = escalasComando
    .filter((e) => e.comandoId === meuComando?.id)
    .sort((a, b) => b.data.localeCompare(a.data));

  const nomeUbm = (id: string) => {
    const ubm = ubms.find((u) => u.id === id);
    return ubm ? `${ubm.sigla} - ${ubm.nome}` : '—';
  };
  const nomeFuncao = (id: string) => funcoes.find((f) => f.id === id)?.nome ?? 'Função removida';
  const nomeMilitar = (id?: string) => {
    if (!id) return '—';
    const m = militares.find((mm) => mm.id === id);
    return m ? `${m.posto} ${m.nome}`.trim() : '—';
  };

  const handleEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!meuComando || !form.ubmId || !form.funcao || !form.motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await criarSolicitacaoReforco({
        comandoId: meuComando.id,
        ubmId: form.ubmId,
        funcao: form.funcao,
        postoDesejado: form.postoDesejado || undefined,
        data: form.data,
        tipo: form.tipo,
        motivo: form.motivo,
      });
      setForm({ ubmId: '', funcao: '', postoDesejado: '', data: formatarDataISO(new Date()), tipo: 'escala_extraordinaria', motivo: '' });
    } catch (erroCriar) {
      setErro(erroCriar instanceof Error ? erroCriar.message : 'Não foi possível criar a solicitação.');
    } finally {
      setEnviando(false);
    }
  };

  if (!meuComando) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
        Seu usuário tem o papel CRB/COP, mas não está vinculado a nenhum comando cadastrado. Peça ao master pra
        vincular em Usuários.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">{meuComando.sigla} — Solicitar reforço</h2>

      <form onSubmit={handleEnviar} className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">UBM</label>
            <select value={form.ubmId} onChange={(e) => setForm({ ...form, ubmId: e.target.value, funcao: '' })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
              <option value="">Selecione</option>
              {ubmsVinculadas.map((u) => <option key={u.id} value={u.id}>{u.sigla} - {u.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Função desejada</label>
            <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} disabled={!form.ubmId} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3 disabled:bg-gray-50">
              <option value="">{form.ubmId ? 'Selecione' : 'Escolha a UBM primeiro'}</option>
              {funcoesDaUbmSelecionada.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Posto/graduação desejado (opcional)</label>
            <input value={form.postoDesejado} onChange={(e) => setForm({ ...form, postoDesejado: e.target.value })} placeholder="Ex.: Sargento" className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoReforco })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
              {(Object.entries(TIPO_REFORCO_LABELS) as [TipoReforco, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {form.tipo === 'escala_extraordinaria'
                ? 'Conta no teto mensal de extraordinárias do militar; não gera recuperação ao voltar.'
                : 'Não entra no teto mensal; para a contagem de equidade e gera recuperação ao voltar, como missão externa.'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (ex.: nome da operação/evento)</label>
            <input required value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button type="submit" disabled={enviando || !form.ubmId || !form.funcao} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
          <Send className="-ml-1 mr-2 h-4 w-4" /> Enviar solicitação
        </button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {minhasSolicitacoes.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400">Nenhuma solicitação feita ainda.</p>
        ) : (
          minhasSolicitacoes.map((s) => (
            <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900">{nomeUbm(s.ubmId)} — {nomeFuncao(s.funcao)} <span className="font-normal text-gray-400">({TIPO_REFORCO_LABELS[s.tipo] ?? 'Escala Extraordinária'})</span></div>
                <div className="text-gray-500">{s.data} · {STATUS_SOLICITACAO_REFORCO_LABELS[s.status]}{s.status === 'atendida' ? ` · ${nomeMilitar(s.militarId)}` : ''}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Efetivo em reforço</h2>
        <p className="text-sm text-gray-500 mb-3">
          Militares cedidos pelas UBMs depois de atendida a solicitação — o {meuComando.sigla} só passa a enxergar o
          nome de cada um a partir daqui, nunca a sugestão automática que a UBM avalia antes de decidir.
        </p>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {escalaDoComando.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-400">Nenhum militar em reforço no momento.</p>
          ) : (
            escalaDoComando.map((e) => (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{nomeMilitar(e.militarId)} — {e.funcaoNome}</div>
                  <div className="text-gray-500">{e.data} · Cedido por {nomeUbm(e.ubmOrigemId)} · {e.motivo}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <OperacaoComando comandoId={meuComando.id} />
    </div>
  );
}

/** Reforço em massa: um pedido só, distribuído automaticamente entre as UBMs do comando (ver `dispararSolicitacaoOperacao`). */
function OperacaoComando({ comandoId }: { comandoId: string }) {
  const { ubms, solicitacoesOperacao, vagasVoluntariasOperacao, dispararSolicitacaoOperacao } = useApp();

  const [form, setForm] = useState({ motivo: '', data: formatarDataISO(new Date()), prazo: formatarDataISO(new Date()), quantidadeTotal: 25 });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const minhasOperacoes = solicitacoesOperacao
    .filter((o) => o.comandoId === comandoId)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  const nomeUbm = (id: string) => {
    const ubm = ubms.find((u) => u.id === id);
    return ubm ? `${ubm.sigla} - ${ubm.nome}` : '—';
  };

  const progressoDaCota = (operacaoId: string, ubmId: string) => {
    const vaga = vagasVoluntariasOperacao.find((v) => v.operacaoId === operacaoId && v.ubmId === ubmId);
    if (!vaga) return 'Aguardando a UBM abrir o voluntariado';
    const confirmados = vaga.voluntariosIds.length + (vaga.militaresCompulsoriosIds?.length ?? 0);
    return `${confirmados}/${vaga.quantidade} confirmado(s) — ${vaga.status === 'aberta' ? 'voluntariado aberto' : 'concluído'}`;
  };

  const handleEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.motivo.trim() || form.quantidadeTotal <= 0) return;
    setEnviando(true);
    setErro(null);
    try {
      await dispararSolicitacaoOperacao({ comandoId, ...form });
      setForm({ motivo: '', data: formatarDataISO(new Date()), prazo: formatarDataISO(new Date()), quantidadeTotal: 25 });
    } catch (erroCriar) {
      setErro(erroCriar instanceof Error ? erroCriar.message : 'Não foi possível criar a solicitação.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Reforço para operação (distribuição automática)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Pra pedidos grandes (ex.: prevenção em jogo, evento) — informe quantos militares precisa no total e o
          sistema reparte a cota entre as UBMs vinculadas, proporcional ao efetivo ativo de cada uma. Sem função
          obrigatória: qualquer militar ativo da UBM pode se voluntariar.
        </p>
      </div>

      <form onSubmit={handleEnviar} className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (ex.: nome da operação/evento)</label>
            <input required value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Prazo sugerido pro voluntariado</label>
            <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Quantidade total de militares</label>
            <input type="number" min={1} value={form.quantidadeTotal} onChange={(e) => setForm({ ...form, quantidadeTotal: Number(e.target.value) })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button type="submit" disabled={enviando} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
          <Send className="-ml-1 mr-2 h-4 w-4" /> Disparar reforço para operação
        </button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {minhasOperacoes.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400">Nenhum reforço de operação disparado ainda.</p>
        ) : (
          minhasOperacoes.map((o) => (
            <div key={o.id} className="px-4 py-3 text-sm space-y-1.5">
              <div className="font-medium text-gray-900">{o.motivo} — {o.data} <span className="font-normal text-gray-400">({o.quantidadeTotal} no total)</span></div>
              <div className="space-y-0.5">
                {o.cotas.map((c) => (
                  <div key={c.ubmId} className="flex flex-wrap items-center justify-between gap-2 text-gray-500">
                    <span>{nomeUbm(c.ubmId)} — cota {c.quantidade}</span>
                    <span>{progressoDaCota(o.id, c.ubmId)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PainelUbm() {
  const { usuarioAtual, comandos, militares, funcoes, afastamentos, escalasExtraordinarias, solicitacoesReforco, responderSolicitacaoReforco } = useApp();
  const ubmId = usuarioAtual?.ubmId ?? '';
  const [selecaoMilitar, setSelecaoMilitar] = useState<Record<string, string>>({});
  const [processando, setProcessando] = useState<string | null>(null);

  const pendentes = solicitacoesReforco
    .filter((s) => s.ubmId === ubmId && s.status === 'pendente')
    .sort((a, b) => a.data.localeCompare(b.data));
  const historico = solicitacoesReforco
    .filter((s) => s.ubmId === ubmId && s.status !== 'pendente')
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .slice(0, 20);

  const nomeComando = (id: string) => {
    const c = comandos.find((co) => co.id === id);
    return c ? `${c.sigla} (${c.tipo.toUpperCase()})` : '—';
  };
  const nomeFuncao = (id: string) => funcoes.find((f) => f.id === id)?.nome ?? 'Função removida';
  const nomeMilitar = (id?: string) => (id ? militares.find((m) => m.id === id)?.nome ?? '—' : '—');

  const candidatos = (funcaoId: string) => militares.filter((m) => m.ubmId === ubmId && m.ativo && m.funcoes.includes(funcaoId));

  const handleAtender = async (id: string, militarSugeridoId?: string) => {
    setProcessando(id);
    try {
      const militarId = selecaoMilitar[id] ?? militarSugeridoId;
      await responderSolicitacaoReforco(id, { atender: true, militarId });
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível atender essa solicitação.');
    } finally {
      setProcessando(null);
    }
  };

  const handleRecusar = async (id: string) => {
    setProcessando(id);
    try {
      await responderSolicitacaoReforco(id, { atender: false });
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível recusar essa solicitação.');
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Solicitações recebidas</h2>

      {pendentes.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-lg p-4">Nenhuma solicitação de reforço pendente.</p>
      ) : (
        <div className="space-y-3">
          {pendentes.map((s) => {
            const candidatosDaFuncao = candidatos(s.funcao);
            const valorSelecionado = selecaoMilitar[s.id] ?? s.militarSugeridoId ?? '';
            return (
              <div key={s.id} className="bg-white rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{nomeComando(s.comandoId)} pediu reforço — {nomeFuncao(s.funcao)} <span className="font-normal text-gray-400">({TIPO_REFORCO_LABELS[s.tipo] ?? 'Escala Extraordinária'})</span></p>
                    <p className="text-gray-500">
                      Data: {s.data} {s.postoDesejado ? `· Posto desejado: ${s.postoDesejado}` : ''} · Motivo: {s.motivo}
                    </p>
                    {s.militarSugeridoId && (
                      <p className="text-gray-500">Sugestão automática do sistema: {nomeMilitar(s.militarSugeridoId)}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={valorSelecionado}
                    onChange={(e) => setSelecaoMilitar({ ...selecaoMilitar, [s.id]: e.target.value })}
                    className="border border-gray-300 rounded-md text-sm py-1.5 px-2"
                  >
                    <option value="">Selecione o militar</option>
                    {candidatosDaFuncao.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.posto} {m.nome} ({extraordinariasNoMes(m.id, s.data, escalasExtraordinarias, afastamentos)}/{LIMITE_EXTRAORDINARIAS_POR_MES} no mês)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAtender(s.id, s.militarSugeridoId)}
                    disabled={processando === s.id || !valorSelecionado}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="-ml-1 mr-1 h-3.5 w-3.5" /> Atender solicitação
                  </button>
                  <button
                    onClick={() => handleRecusar(s.id)}
                    disabled={processando === s.id}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                  >
                    <X className="-ml-1 mr-1 h-3.5 w-3.5" /> Recusar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {historico.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {historico.map((s) => (
            <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-1 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900">{nomeComando(s.comandoId)} — {nomeFuncao(s.funcao)}</div>
                <div className="text-gray-500">{s.data} · {STATUS_SOLICITACAO_REFORCO_LABELS[s.status]} · {nomeMilitar(s.militarId)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <OperacaoUbm ubmId={ubmId} />
    </div>
  );
}

/** Cotas de reforço de operação recebidas pela UBM — o escalante decide quando abrir o voluntariado pros próprios militares. */
function OperacaoUbm({ ubmId }: { ubmId: string }) {
  const {
    comandos,
    solicitacoesOperacao,
    vagasVoluntariasOperacao,
    abrirVoluntariadoOperacaoUbm,
    resolverOperacaoCompulsoriamente,
  } = useApp();
  const [processando, setProcessando] = useState<string | null>(null);

  const operacoesComCota = solicitacoesOperacao
    .filter((o) => o.cotas.some((c) => c.ubmId === ubmId))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  const nomeComando = (id: string) => comandos.find((c) => c.id === id)?.sigla ?? '—';

  const handleAbrir = async (operacaoId: string) => {
    setProcessando(operacaoId);
    try {
      await abrirVoluntariadoOperacaoUbm(operacaoId);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível abrir o voluntariado.');
    } finally {
      setProcessando(null);
    }
  };

  const handleResolver = async (vagaId: string) => {
    setProcessando(vagaId);
    try {
      await resolverOperacaoCompulsoriamente(vagaId);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível completar a cota compulsoriamente.');
    } finally {
      setProcessando(null);
    }
  };

  if (operacoesComCota.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Cotas de reforço para operação</h2>
      <div className="space-y-3">
        {operacoesComCota.map((o) => {
          const cota = o.cotas.find((c) => c.ubmId === ubmId)!;
          const vaga = vagasVoluntariasOperacao.find((v) => v.operacaoId === o.id && v.ubmId === ubmId);
          return (
            <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{nomeComando(o.comandoId)} — {o.motivo}</p>
                <p className="text-gray-500">Data: {o.data} · Sua cota: {cota.quantidade} militar(es) · Prazo sugerido: {o.prazo}</p>
              </div>
              {!vaga ? (
                <button
                  onClick={() => handleAbrir(o.id)}
                  disabled={processando === o.id}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                >
                  Abrir voluntariado
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-gray-500">
                    {vaga.voluntariosIds.length}/{vaga.quantidade} voluntário(s) — {vaga.status === 'aberta' ? 'aguardando' : vaga.status === 'preenchida' ? 'preenchida' : 'completada compulsoriamente'}
                  </span>
                  {vaga.status === 'aberta' && vaga.voluntariosIds.length < vaga.quantidade && (
                    <button
                      onClick={() => handleResolver(vaga.id)}
                      disabled={processando === vaga.id}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      Completar compulsoriamente
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Vagas de reforço de operação abertas pra própria UBM — qualquer militar ativo pode se voluntariar (e desistir enquanto não resolvida compulsoriamente). */
function VoluntariadoOperacaoMilitar() {
  const { usuarioAtual, vagasVoluntariasOperacao, voluntariarParaOperacao, desistirVoluntariadoOperacao } = useApp();
  const [processando, setProcessando] = useState<string | null>(null);

  const meuMilitarId = usuarioAtual?.militarId;
  const vagasElegiveis = vagasVoluntariasOperacao.filter(
    (v) => v.status === 'aberta' && meuMilitarId && v.candidatosElegiveisIds.includes(meuMilitarId) && !v.voluntariosIds.includes(meuMilitarId),
  );
  const vagasConfirmadas = vagasVoluntariasOperacao.filter(
    (v) => meuMilitarId && v.voluntariosIds.includes(meuMilitarId) && v.status !== 'expirada_compulsoria',
  );

  if (vagasElegiveis.length === 0 && vagasConfirmadas.length === 0) return null;

  const handleVoluntariar = async (vagaId: string) => {
    setProcessando(vagaId);
    try {
      await voluntariarParaOperacao(vagaId);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível se voluntariar.');
    } finally {
      setProcessando(null);
    }
  };

  const handleDesistir = async (vagaId: string) => {
    if (!confirm('Desistir desse voluntariado? A vaga volta a ficar aberta pra outros militares.')) return;
    setProcessando(vagaId);
    try {
      await desistirVoluntariadoOperacao(vagaId);
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível desistir.');
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Voluntariado para reforço de operação</h2>

      {vagasConfirmadas.length > 0 && (
        <div className="space-y-3">
          {vagasConfirmadas.map((v) => (
            <div key={v.id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{v.motivo} <span className="font-normal text-emerald-700">— você confirmado</span></p>
                <p className="text-gray-500">{v.data} · {v.voluntariosIds.length}/{v.quantidade} preenchido(s)</p>
              </div>
              <button
                onClick={() => handleDesistir(v.id)}
                disabled={processando === v.id}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                {processando === v.id ? 'Enviando...' : 'Desistir'}
              </button>
            </div>
          ))}
        </div>
      )}

      {vagasElegiveis.length > 0 && (
        <div className="space-y-3">
          {vagasElegiveis.map((v) => (
            <div key={v.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{v.motivo}</p>
                <p className="text-gray-500">{v.data} · {v.voluntariosIds.length}/{v.quantidade} preenchido(s) · Prazo: {v.prazo}</p>
              </div>
              <button
                onClick={() => handleVoluntariar(v.id)}
                disabled={processando === v.id}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {processando === v.id ? 'Enviando...' : 'Quero me voluntariar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
