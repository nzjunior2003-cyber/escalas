import { useState } from 'react';
import type { FormEvent } from 'react';
import { User, Mail, IdCard, Building2, Lock, Send, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import FormField from '../../components/ui/FormField';
import { PAPEL_LABELS, STATUS_REMANEJAMENTO_LABELS } from '../../types';
import { pushConfigurado, statusPermissaoPush } from '../../lib/pushNotifications';

/** Autoedição do próprio perfil (nome de guerra + troca de senha), notificações push e solicitação de remanejamento/alteração de função ao escalante. */
export default function MeuPerfil() {
  const {
    usuarioAtual,
    ubms,
    funcoes,
    militares,
    solicitacoesRemanejamento,
    atualizarMeuPerfil,
    ativarNotificacoesPushNoDispositivo,
    solicitarRemanejamentoFuncao,
    enviarResetSenha,
  } = useApp();

  const ubm = ubms.find((u) => u.id === usuarioAtual?.ubmId);
  const militar = militares.find((m) => m.id === usuarioAtual?.militarId);
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === usuarioAtual?.ubmId && f.ativa);
  const funcoesAtuais = militar ? funcoesDaUbm.filter((f) => militar.funcoes.includes(f.id)) : [];
  const funcoesDisponiveis = militar ? funcoesDaUbm.filter((f) => !militar.funcoes.includes(f.id)) : funcoesDaUbm;

  const minhasSolicitacoes = solicitacoesRemanejamento
    .filter((s) => s.solicitanteId === usuarioAtual?.id)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  const [nomeGuerra, setNomeGuerra] = useState(usuarioAtual?.nomeGuerra ?? '');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [mensagemPerfil, setMensagemPerfil] = useState<string | null>(null);

  const [enviandoReset, setEnviandoReset] = useState(false);
  const [mensagemReset, setMensagemReset] = useState<string | null>(null);

  const [statusPush, setStatusPush] = useState(statusPermissaoPush());
  const [ativandoPush, setAtivandoPush] = useState(false);
  const [mensagemPush, setMensagemPush] = useState<string | null>(null);

  const [formRemanejamento, setFormRemanejamento] = useState({ funcaoDesejadaId: '', motivo: '' });
  const [enviandoRemanejamento, setEnviandoRemanejamento] = useState(false);
  const [erroRemanejamento, setErroRemanejamento] = useState<string | null>(null);

  const handleSalvarPerfil = async (e: FormEvent) => {
    e.preventDefault();
    setSalvandoPerfil(true);
    setMensagemPerfil(null);
    try {
      await atualizarMeuPerfil({ nomeGuerra: nomeGuerra.trim() });
      setMensagemPerfil('Nome de guerra atualizado.');
    } catch (erro) {
      setMensagemPerfil(erro instanceof Error ? erro.message : 'Não foi possível salvar.');
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const handleTrocarSenha = async () => {
    if (!usuarioAtual?.email) return;
    setEnviandoReset(true);
    setMensagemReset(null);
    try {
      await enviarResetSenha(usuarioAtual.email);
      setMensagemReset(`Link de redefinição enviado para ${usuarioAtual.email}.`);
    } catch (erro) {
      setMensagemReset(erro instanceof Error ? erro.message : 'Não foi possível enviar o link.');
    } finally {
      setEnviandoReset(false);
    }
  };

  const handleAtivarPush = async () => {
    setAtivandoPush(true);
    setMensagemPush(null);
    try {
      const ativou = await ativarNotificacoesPushNoDispositivo();
      setStatusPush(statusPermissaoPush());
      setMensagemPush(
        ativou
          ? 'Notificações push ativadas neste navegador.'
          : 'Não foi possível ativar — permissão negada ou o navegador não suporta.',
      );
    } catch (erro) {
      setMensagemPush(erro instanceof Error ? erro.message : 'Não foi possível ativar as notificações push.');
    } finally {
      setAtivandoPush(false);
    }
  };

  const handleSolicitarRemanejamento = async (e: FormEvent) => {
    e.preventDefault();
    if (!formRemanejamento.funcaoDesejadaId || !formRemanejamento.motivo.trim()) return;
    setEnviandoRemanejamento(true);
    setErroRemanejamento(null);
    try {
      await solicitarRemanejamentoFuncao(formRemanejamento);
      setFormRemanejamento({ funcaoDesejadaId: '', motivo: '' });
    } catch (erro) {
      setErroRemanejamento(erro instanceof Error ? erro.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setEnviandoRemanejamento(false);
    }
  };

  if (!usuarioAtual) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meu Perfil</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Seus dados de acesso e vínculo institucional.</p>
      </div>

      {/* Dados institucionais — somente leitura; alteração é sempre pelo escalante/comandante em Efetivo. */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Dados institucionais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
            <User className="w-4 h-4 flex-shrink-0" /> {militar ? `${militar.posto} ${militar.nome}` : usuarioAtual.nome}
          </div>
          {militar?.matricula && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
              <IdCard className="w-4 h-4 flex-shrink-0" /> MF {militar.matricula}
            </div>
          )}
          {ubm && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
              <Building2 className="w-4 h-4 flex-shrink-0" /> {ubm.sigla} - {ubm.nome}
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
            <Mail className="w-4 h-4 flex-shrink-0" /> {usuarioAtual.email}
          </div>
        </div>
        {funcoesAtuais.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Funções: {funcoesAtuais.map((f) => f.nome).join(', ')}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Papel de acesso: {usuarioAtual.papeis.map((p) => PAPEL_LABELS[p]).join(', ')}. Esses dados são controlados
          pelo escalante/comandante da sua UBM — pra corrigir algo aqui, fale com eles.
        </p>
      </div>

      {/* Nome de guerra — só isso é autoeditável na conta de acesso. */}
      <form onSubmit={handleSalvarPerfil} className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Como você quer ser chamado</h2>
        <FormField label="Nome de guerra" icon={User} type="text" value={nomeGuerra} onChange={(e) => setNomeGuerra(e.target.value)} placeholder="Ex.: SILVA" />
        {mensagemPerfil && <p className="text-sm text-gray-600 dark:text-slate-400">{mensagemPerfil}</p>}
        <button type="submit" disabled={salvandoPerfil} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
          {salvandoPerfil ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      {/* Senha. */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2"><Lock className="w-4 h-4" /> Senha</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">Enviamos um link seguro para o seu e-mail cadastrado, pra você definir uma nova senha.</p>
        {mensagemReset && <p className="text-sm text-gray-600 dark:text-slate-400">{mensagemReset}</p>}
        <button onClick={handleTrocarSenha} disabled={enviandoReset} className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">
          {enviandoReset ? 'Enviando...' : 'Enviar link de redefinição de senha'}
        </button>
      </div>

      {/* Notificações push — sempre por clique explícito, nunca automático. */}
      {pushConfigurado && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2"><Bell className="w-4 h-4" /> Notificações push</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Receba um aviso na tela mesmo com o sistema fechado, além do alerta interno e do e-mail que você já recebe.
          </p>
          {statusPush === 'granted' ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Ativadas neste navegador.</p>
          ) : statusPush === 'denied' ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Bloqueadas nas configurações do navegador — pra ativar, libere notificações pra este site manualmente e recarregue a página.
            </p>
          ) : statusPush === 'indisponivel' ? (
            <p className="text-sm text-gray-400">Este navegador não suporta notificações push.</p>
          ) : (
            <button onClick={handleAtivarPush} disabled={ativandoPush} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
              {ativandoPush ? 'Ativando...' : 'Ativar notificações push neste dispositivo'}
            </button>
          )}
          {mensagemPush && <p className="text-sm text-gray-600 dark:text-slate-400">{mensagemPush}</p>}
        </div>
      )}

      {/* Remanejamento de função — pedido ao escalante, não se aplica sozinho. */}
      {militar && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Solicitar remanejamento de função</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Peça ao escalante/comandante da sua UBM pra passar a exercer outra função. A solicitação só é aplicada depois de aprovada.
            </p>
          </div>
          {funcoesDisponiveis.length === 0 ? (
            <p className="text-sm text-gray-400">Você já exerce todas as funções cadastradas na sua UBM.</p>
          ) : (
            <form onSubmit={handleSolicitarRemanejamento} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Função desejada</label>
                <select
                  value={formRemanejamento.funcaoDesejadaId}
                  onChange={(e) => setFormRemanejamento({ ...formRemanejamento, funcaoDesejadaId: e.target.value })}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-md shadow-sm sm:text-sm"
                >
                  <option value="" disabled>Selecione</option>
                  {funcoesDisponiveis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Motivo</label>
                <textarea
                  value={formRemanejamento.motivo}
                  onChange={(e) => setFormRemanejamento({ ...formRemanejamento, motivo: e.target.value })}
                  required
                  rows={2}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-md shadow-sm sm:text-sm"
                />
              </div>
              {erroRemanejamento && <p className="text-sm text-red-600">{erroRemanejamento}</p>}
              <button type="submit" disabled={enviandoRemanejamento} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
                <Send className="-ml-1 mr-1.5 h-4 w-4" /> {enviandoRemanejamento ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </form>
          )}

          {minhasSolicitacoes.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Suas solicitações</h3>
              {minhasSolicitacoes.map((s) => (
                <div key={s.id} className="text-sm flex items-center justify-between gap-2">
                  <span className="text-gray-700 dark:text-slate-300">{funcoes.find((f) => f.id === s.funcaoDesejadaId)?.nome ?? 'Função removida'}</span>
                  <span
                    className={
                      s.status === 'aprovado'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : s.status === 'rejeitado'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }
                  >
                    {STATUS_REMANEJAMENTO_LABELS[s.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
