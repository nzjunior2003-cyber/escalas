import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Send, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { extraordinariasNoMes, formatarDataISO, LIMITE_EXTRAORDINARIAS_POR_MES } from '../../lib/escala';
import { STATUS_SOLICITACAO_REFORCO_LABELS, temPapel } from '../../types';

export default function Reforcos() {
  const { usuarioAtual } = useApp();

  const isComando = temPapel(usuarioAtual, 'crb') || temPapel(usuarioAtual, 'cop');
  const isGestao = temPapel(usuarioAtual, 'comandante') || temPapel(usuarioAtual, 'escalante');

  if (!isComando && !isGestao) {
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
    </div>
  );
}

function PainelComando() {
  const { usuarioAtual, comandos, ubms, funcoes, militares, solicitacoesReforco, escalasComando, criarSolicitacaoReforco } = useApp();
  const meuComando = comandos.find((c) => c.id === usuarioAtual?.comandoId);

  const [form, setForm] = useState({ ubmId: '', funcao: '', postoDesejado: '', data: formatarDataISO(new Date()), motivo: '' });
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
        motivo: form.motivo,
      });
      setForm({ ubmId: '', funcao: '', postoDesejado: '', data: formatarDataISO(new Date()), motivo: '' });
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
                <div className="font-medium text-gray-900">{nomeUbm(s.ubmId)} — {nomeFuncao(s.funcao)}</div>
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
                    <p className="font-medium text-gray-900">{nomeComando(s.comandoId)} pediu reforço — {nomeFuncao(s.funcao)}</p>
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
    </div>
  );
}
