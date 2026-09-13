import { useState } from 'react';
import type { FormEvent } from 'react';
import { Send, FileSignature } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { gerarPdfAutorizacaoSubstituicao } from '../../lib/pdfAutorizacaoSubstituicao';
import {
  MODALIDADE_SOLICITACAO_LABELS,
  ModalidadeSolicitacaoServico,
  STATUS_SOLICITACAO_LABELS,
  SolicitacaoServico,
  TipoEscalaServico,
  temPapel,
} from '../../types';

const OBSERVACAO_PADRAO =
  'Caso o militar substituto esteja escalado em outra escala por necessidade do serviço, será considerada inválida esta autorização.';

export default function Solicitacoes() {
  const {
    usuarioAtual,
    usuarios,
    ubms,
    militares,
    funcoes,
    escalasOrdinarias,
    escalasExtraordinarias,
    solicitacoesServico,
    criarSolicitacaoServico,
    responderSolicitacaoIndicado,
    responderSolicitacaoAprovador,
  } = useApp();

  const ubmId = usuarioAtual?.ubmId ?? '';
  const isAprovador = temPapel(usuarioAtual, 'escalante') || temPapel(usuarioAtual, 'comandante');
  const meuMilitarId = usuarioAtual?.militarId;

  const minhasEscalas = [
    ...escalasOrdinarias.filter((e) => e.ubmId === ubmId && e.militarId === meuMilitarId).map((e) => ({ ...e, tipoEscala: 'ordinaria' as TipoEscalaServico })),
    ...escalasExtraordinarias.filter((e) => e.ubmId === ubmId && e.militarId === meuMilitarId).map((e) => ({ ...e, tipoEscala: 'extraordinaria' as TipoEscalaServico })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const outrosMilitares = usuarios.filter((u) => u.ubmId === ubmId && u.militarId && u.militarId !== meuMilitarId);

  const [form, setForm] = useState({
    modalidade: 'integral' as ModalidadeSolicitacaoServico,
    horarioParcial: '',
    localEvento: '',
    escalaOrigemId: '',
    tipoEscalaOrigem: 'ordinaria' as TipoEscalaServico,
    indicadoId: '',
    motivo: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);

  const handleEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.escalaOrigemId || !form.indicadoId) return;
    setEnviando(true);
    try {
      await criarSolicitacaoServico({
        ubmId,
        modalidade: form.modalidade,
        horarioParcial: form.modalidade === 'parcial' ? form.horarioParcial : undefined,
        localEvento: form.localEvento || undefined,
        escalaOrigemId: form.escalaOrigemId,
        tipoEscalaOrigem: form.tipoEscalaOrigem,
        indicadoId: form.indicadoId,
        motivo: form.motivo,
      });
      setForm({ modalidade: 'integral', horarioParcial: '', localEvento: '', escalaOrigemId: '', tipoEscalaOrigem: 'ordinaria', indicadoId: '', motivo: '' });
    } finally {
      setEnviando(false);
    }
  };

  const minhasSolicitacoesFeitas = solicitacoesServico.filter((s) => s.solicitanteId === usuarioAtual?.id);
  const solicitacoesParaMim = solicitacoesServico.filter((s) => s.indicadoId === usuarioAtual?.id && s.status === 'aguardando_indicado');
  const solicitacoesParaAprovador = isAprovador
    ? solicitacoesServico.filter((s) => s.ubmId === ubmId && s.status === 'aguardando_aprovacao')
    : [];

  const nomeUsuario = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? '—';

  const gerarPdf = async (s: SolicitacaoServico) => {
    setGerandoPdfId(s.id);
    try {
      const ubm = ubms.find((u) => u.id === s.ubmId);
      const escalas = s.tipoEscalaOrigem === 'ordinaria' ? escalasOrdinarias : escalasExtraordinarias;
      const escala = escalas.find((e) => e.id === s.escalaOrigemId);
      const funcaoNome = funcoes.find((f) => f.id === escala?.funcao)?.nome ?? 'Função removida';
      const eventoExtraordinario =
        s.tipoEscalaOrigem === 'extraordinaria' && escala && 'motivo' in escala
          ? escala.motivo
          : `Serviço Ordinário — ${funcaoNome}`;

      const solicitante = usuarios.find((u) => u.id === s.solicitanteId);
      const indicado = usuarios.find((u) => u.id === s.indicadoId);
      const militarIndicado = militares.find((m) => m.id === indicado?.militarId);
      const aprovador = usuarios.find((u) => u.id === s.aprovadoPorId);
      const militarAprovador = militares.find((m) => m.id === aprovador?.militarId);
      const cargoAprovador = temPapel(aprovador ?? null, 'comandante') ? `Comandante do ${ubm?.sigla ?? ''}` : `Escalante do ${ubm?.sigla ?? ''}`;

      await gerarPdfAutorizacaoSubstituicao({
        ubmNome: ubm ? `${ubm.sigla} - ${ubm.nome}` : 'Unidade de Bombeiro Militar',
        ubmSigla: ubm?.sigla ?? '',
        ubmLogoDataUrl: ubm?.logoDataUrl,
        eventoExtraordinario,
        dataEvento: escala?.data ?? '',
        localEvento: s.localEvento ?? '',
        horario: s.modalidade === 'integral' ? '24h (integral)' : s.horarioParcial || 'Parcial',
        militarSubstituidoNomeGuerra: solicitante?.nomeGuerra || solicitante?.nome || '',
        militarSubstitutoNomeCompleto: militarIndicado ? `${militarIndicado.posto} ${militarIndicado.nome}`.trim() : indicado?.nome || '',
        militarSubstitutoMatricula: militarIndicado?.matricula || indicado?.matricula || '',
        observacao: OBSERVACAO_PADRAO,
        responsavelNome: aprovador?.nome || '',
        responsavelPosto: militarAprovador?.posto || '',
        responsavelCargo: aprovador ? cargoAprovador : '',
      });
    } finally {
      setGerandoPdfId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Solicitações</h1>
        <p className="mt-1 text-sm text-gray-500">
          Autorização de Substituição de Serviço — via de mão única: o indicado cobre o serviço do solicitante, sem
          nenhuma obrigação de troca. O indicado precisa aceitar primeiro, depois vai para aprovação do Comandante ou
          do Escalante. Só depois de aprovada o PDF de autorização é liberado; a escala do sistema não muda
          automaticamente, só por edição manual do escalante.
        </p>
      </div>

      {meuMilitarId && (
        <form onSubmit={handleEnviar} className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Nova autorização de substituição</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Modalidade</label>
              <select value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value as ModalidadeSolicitacaoServico })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
                {Object.entries(MODALIDADE_SOLICITACAO_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            {form.modalidade === 'parcial' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Faixa de horário coberta pelo substituto</label>
                <input
                  value={form.horarioParcial}
                  onChange={(e) => setForm({ ...form, horarioParcial: e.target.value })}
                  placeholder="Ex.: 19h às 07h"
                  className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Minha escala a ser coberta</label>
              <select
                value={form.escalaOrigemId}
                onChange={(e) => {
                  const escala = minhasEscalas.find((m) => m.id === e.target.value);
                  setForm({ ...form, escalaOrigemId: e.target.value, tipoEscalaOrigem: escala?.tipoEscala ?? 'ordinaria' });
                }}
                className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
              >
                <option value="">Selecione</option>
                {minhasEscalas.map((e) => (
                  <option key={e.id} value={e.id}>{e.data} ({e.tipoEscala})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Militar indicado (substituto)</label>
              <select value={form.indicadoId} onChange={(e) => setForm({ ...form, indicadoId: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3">
                <option value="">Selecione</option>
                {outrosMilitares.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Local do serviço/evento (opcional)</label>
              <input value={form.localEvento} onChange={(e) => setForm({ ...form, localEvento: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motivo (opcional)</label>
              <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full border border-gray-300 rounded-md text-sm py-2 px-3" />
            </div>
          </div>
          <button type="submit" disabled={enviando} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
            <Send className="-ml-1 mr-2 h-4 w-4" /> Enviar solicitação
          </button>
        </form>
      )}

      {solicitacoesParaMim.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">Pedidos aguardando sua resposta</h3>
          {solicitacoesParaMim.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-md p-3 border border-amber-100">
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  {nomeUsuario(s.solicitanteId)} pediu autorização de substituição — {MODALIDADE_SOLICITACAO_LABELS[s.modalidade]}
                </p>
                {s.motivo && <p className="text-gray-500">Motivo: {s.motivo}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => responderSolicitacaoIndicado(s.id, true)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Aceitar</button>
                <button onClick={() => responderSolicitacaoIndicado(s.id, false)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300">Recusar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {solicitacoesParaAprovador.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">Aguardando sua aprovação (Comandante/Escalante)</h3>
          {solicitacoesParaAprovador.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-md p-3 border border-blue-100">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{nomeUsuario(s.solicitanteId)} → {nomeUsuario(s.indicadoId)} ({MODALIDADE_SOLICITACAO_LABELS[s.modalidade]})</p>
                {s.motivo && <p className="text-gray-500">Motivo: {s.motivo}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => responderSolicitacaoAprovador(s.id, true)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Aprovar</button>
                <button onClick={() => responderSolicitacaoAprovador(s.id, false)} className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300">Recusar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {minhasSolicitacoesFeitas.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400">Você ainda não fez solicitações.</p>
        ) : (
          minhasSolicitacoesFeitas.map((s) => (
            <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900">{MODALIDADE_SOLICITACAO_LABELS[s.modalidade]} — {nomeUsuario(s.indicadoId)}</div>
                <div className="text-gray-500">{STATUS_SOLICITACAO_LABELS[s.status]}</div>
              </div>
              {s.status === 'aprovada' && (
                <button
                  onClick={() => gerarPdf(s)}
                  disabled={gerandoPdfId === s.id}
                  className="shrink-0 inline-flex items-center justify-center px-2.5 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
                >
                  <FileSignature className="-ml-1 mr-1.5 h-3.5 w-3.5" /> {gerandoPdfId === s.id ? 'Gerando...' : 'Gerar PDF'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
