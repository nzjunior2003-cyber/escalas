import { useState } from 'react';
import type { FormEvent } from 'react';
import { addDays, startOfWeek, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChevronLeft, Building2, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import {
  afastamentosPorMotivo,
  efetivoPorCargoEFuncao,
  mediaFolgasPorCargoEFuncao,
  volumeTrabalhoPorCargo,
} from '../../lib/painelRegional';
import { MOTIVO_AFASTAMENTO_LABELS, TIPO_COMANDO_LABELS, TIPO_REFORCO_LABELS, temPapel, type Comando, type TipoReforco } from '../../types';

export default function PainelRegional() {
  const { usuarioAtual, comandos } = useApp();
  const meuComando = comandos.find((c) => c.id === usuarioAtual?.comandoId);
  const [crbSelecionadoId, setCrbSelecionadoId] = useState<string | null>(null);

  if (!temPapel(usuarioAtual, 'crb') && !temPapel(usuarioAtual, 'cop')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  if (!meuComando) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 max-w-2xl mx-auto mt-6">
        Seu usuário tem o papel CRB/COP, mas não está vinculado a nenhum comando cadastrado. Peça ao master pra
        vincular em Usuários.
      </p>
    );
  }

  // COP enxerga todos os CRBs (visão ampla pra apoiar decisão de movimentação
  // de efetivo); CRB só enxerga o próprio comando.
  if (meuComando.tipo === 'cop') {
    const crbs = comandos.filter((c) => c.tipo === 'crb');
    const crbSelecionado = crbs.find((c) => c.id === crbSelecionadoId);

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Regional — {meuComando.sigla}</h1>
          <p className="mt-1 text-sm text-gray-500">Visão do efetivo por CRB e UBM, pra apoiar decisão de movimentação de pessoal.</p>
        </div>

        {!crbSelecionado ? (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {crbs.length === 0 ? (
              <p className="p-6 text-center text-gray-500 text-sm">Nenhum CRB cadastrado ainda.</p>
            ) : (
              crbs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCrbSelecionadoId(c.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-900">{c.sigla} — {c.nome}</span>
                  <span className="text-xs text-gray-500">{c.ubmIds.length} UBM(s) vinculada(s)</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => setCrbSelecionadoId(null)} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800">
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar pra lista de CRBs
            </button>
            <VisaoComando comando={crbSelecionado} comandoOrigemId={meuComando.id} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel Regional — {meuComando.sigla}</h1>
        <p className="mt-1 text-sm text-gray-500">{TIPO_COMANDO_LABELS[meuComando.tipo]} — efetivo das UBMs vinculadas.</p>
      </div>
      <VisaoComando comando={meuComando} comandoOrigemId={meuComando.id} />
    </div>
  );
}

/** UBMs de um comando (CRB ou COP), com gráfico agregado de efetivo e seleção pra detalhar uma UBM. */
function VisaoComando({ comando, comandoOrigemId }: { comando: Comando; comandoOrigemId: string }) {
  const { ubms, militares } = useApp();
  const [ubmSelecionadaId, setUbmSelecionadaId] = useState<string | null>(null);

  const ubmsDoComando = ubms.filter((u) => comando.ubmIds.includes(u.id));
  const dadosEfetivoPorUbm = ubmsDoComando.map((u) => ({
    nome: u.sigla,
    efetivo: militares.filter((m) => m.ubmId === u.id && m.ativo).length,
  }));

  const ubmSelecionada = ubmsDoComando.find((u) => u.id === ubmSelecionadaId);

  if (ubmSelecionada) {
    return (
      <div className="space-y-4">
        <button onClick={() => setUbmSelecionadaId(null)} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar pras UBMs de {comando.sigla}
        </button>
        <VisaoUbm ubmId={ubmSelecionada.id} nomeUbm={`${ubmSelecionada.sigla} - ${ubmSelecionada.nome}`} comandoOrigemId={comandoOrigemId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Efetivo por UBM — {comando.sigla}</h2>
        {ubmsDoComando.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma UBM vinculada a este comando.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosEfetivoPorUbm}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="efetivo" fill="#b91c1c" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {ubmsDoComando.map((u) => (
          <button
            key={u.id}
            onClick={() => setUbmSelecionadaId(u.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Building2 className="w-4 h-4 text-gray-400" /> {u.sigla} - {u.nome}
            </span>
            <span className="text-xs text-gray-500">{militares.filter((m) => m.ubmId === u.id && m.ativo).length} militares</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Detalhamento de uma UBM: efetivo por cargo/função, escala da semana, médias de folga, volume de trabalho e afastamentos — com filtro de período. */
function VisaoUbm({ ubmId, nomeUbm, comandoOrigemId }: { ubmId: string; nomeUbm: string; comandoOrigemId: string }) {
  const { funcoes, militares, escalasOrdinarias, escalasExtraordinarias, afastamentos } = useApp();

  const hoje = new Date();
  const [periodoInicio, setPeriodoInicio] = useState(formatarDataISO(new Date(hoje.getFullYear(), 0, 1)));
  const [periodoFim, setPeriodoFim] = useState(formatarDataISO(hoje));
  const [isSolicitarOpen, setIsSolicitarOpen] = useState(false);

  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const matrizEfetivo = efetivoPorCargoEFuncao(militares, funcoes, ubmId);
  const mediaFolgas = mediaFolgasPorCargoEFuncao(militares, funcoes, escalasOrdinarias, ubmId, periodoInicio, periodoFim);
  const volumeTrabalho = volumeTrabalhoPorCargo(militares, escalasOrdinarias, escalasExtraordinarias, ubmId, periodoInicio, periodoFim);
  const afastamentosResumo = afastamentosPorMotivo(afastamentos, ubmId, periodoInicio, periodoFim).map((a) => ({
    ...a,
    motivoNome: MOTIVO_AFASTAMENTO_LABELS[a.motivo],
  }));

  const semanaInicio = formatarDataISO(startOfWeek(hoje, { weekStartsOn: 1 }));
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => formatarDataISO(addDays(new Date(semanaInicio + 'T00:00:00'), i)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{nomeUbm}</h2>
        <button
          onClick={() => setIsSolicitarOpen(true)}
          className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-800"
        >
          <Send className="-ml-1 mr-1.5 h-3.5 w-3.5" /> Disparar solicitação de reforço
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Efetivo por cargo e função (total: {matrizEfetivo.totalGeral})</h3>
        <p className="text-[11px] text-gray-400 mb-1 sm:hidden">Arraste a tabela para o lado para ver todas as colunas →</p>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="min-w-full text-xs divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-white">Cargo</th>
                {matrizEfetivo.funcoes.map((f) => <th key={f.id} className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">{f.nome}</th>)}
                <th className="px-3 py-2 text-center font-medium text-gray-700 whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matrizEfetivo.linhas.map((l) => (
                <tr key={l.cargo}>
                  <td className="px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white whitespace-nowrap">{l.cargo}</td>
                  {matrizEfetivo.funcoes.map((f) => <td key={f.id} className="px-3 py-2 text-center text-gray-600">{l.porFuncao[f.id] ?? 0}</td>)}
                  <td className="px-3 py-2 text-center font-semibold text-gray-800">{l.total}</td>
                </tr>
              ))}
              {matrizEfetivo.linhas.length === 0 && (
                <tr><td colSpan={matrizEfetivo.funcoes.length + 2} className="px-3 py-6 text-center text-gray-400">Nenhum militar cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Escala ordinária desta semana ({format(new Date(semanaInicio + 'T00:00:00'), 'dd/MM')} a {format(new Date(diasDaSemana[6] + 'T00:00:00'), 'dd/MM')})</h3>
        <p className="text-[11px] text-gray-400 mb-1 sm:hidden">Arraste a tabela para o lado para ver todos os dias →</p>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="min-w-full text-xs divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 bg-white">Função</th>
                {diasDaSemana.map((d) => (
                  <th key={d} className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">
                    {format(new Date(d + 'T00:00:00'), 'EEE dd/MM', { locale: ptBR })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {funcoesDaUbm.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white whitespace-nowrap">{f.nome}</td>
                  {diasDaSemana.map((d) => {
                    const escalado = escalasOrdinarias.find((e) => e.ubmId === ubmId && e.funcao === f.id && e.data === d);
                    const militar = escalado ? militares.find((m) => m.id === escalado.militarId) : undefined;
                    return <td key={d} className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">{militar?.nome ?? '—'}</td>;
                  })}
                </tr>
              ))}
              {funcoesDaUbm.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Nenhuma função cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Estatísticas do período</h3>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-gray-500">De</label>
            <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} className="border border-gray-300 rounded-md py-1 px-2" />
            <label className="text-gray-500">até</label>
            <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} className="border border-gray-300 rounded-md py-1 px-2" />
          </div>
        </div>

        <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Média de folgas por cargo e função (dias no período)</h4>
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-md">
          {mediaFolgas.length === 0 ? (
            <p className="px-3 py-6 text-center text-gray-400 text-xs">Sem dados nesse período.</p>
          ) : (
            mediaFolgas.map((l) => (
              <div key={`${l.cargo}-${l.funcaoId}`} className="flex flex-col sm:flex-row sm:items-center gap-1 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-gray-800 font-medium">{l.cargo}</span> <span className="text-gray-500">— {l.funcaoNome}</span>
                </div>
                <div className="shrink-0 text-gray-600">{l.militares} militar(es) · média {l.mediaFolgas} folgas</div>
              </div>
            ))
          )}
        </div>

        <h4 className="text-xs font-semibold text-gray-500 uppercase mt-6 mb-2">Volume de trabalho por cargo (serviços no período)</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={volumeTrabalho}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cargo" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="servicosOrdinarios" name="Ordinários" fill="#2563eb" />
            <Bar dataKey="servicosExtraordinarios" name="Extraordinários" fill="#059669" />
          </BarChart>
        </ResponsiveContainer>

        <h4 className="text-xs font-semibold text-gray-500 uppercase mt-6 mb-2">Afastamentos e dispensas no período</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={afastamentosResumo}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="motivoNome" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="quantidade" name="Ocorrências" fill="#d97706" />
            <Bar dataKey="diasTotal" name="Dias totais" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {isSolicitarOpen && (
        <ModalSolicitarReforco ubmId={ubmId} comandoId={comandoOrigemId} onClose={() => setIsSolicitarOpen(false)} />
      )}
    </div>
  );
}

function ModalSolicitarReforco({ ubmId, comandoId, onClose }: { ubmId: string; comandoId: string; onClose: () => void }) {
  const { funcoes, criarSolicitacaoReforco } = useApp();
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const [form, setForm] = useState<{ funcao: string; postoDesejado: string; data: string; tipo: TipoReforco; motivo: string }>({
    funcao: funcoesDaUbm[0]?.id ?? '',
    postoDesejado: '',
    data: formatarDataISO(new Date()),
    tipo: 'escala_extraordinaria',
    motivo: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.funcao || !form.motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await criarSolicitacaoReforco({
        comandoId,
        ubmId,
        funcao: form.funcao,
        postoDesejado: form.postoDesejado || undefined,
        data: form.data,
        tipo: form.tipo,
        motivo: form.motivo,
      });
      onClose();
    } catch (erroCriar) {
      setErro(erroCriar instanceof Error ? erroCriar.message : 'Não foi possível criar a solicitação.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Solicitar reforço</h3>
        <form onSubmit={handleEnviar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Função desejada</label>
            <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm">
              {funcoesDaUbm.length === 0 && <option value="">Nenhuma função cadastrada</option>}
              {funcoesDaUbm.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posto/graduação desejado (opcional)</label>
            <input value={form.postoDesejado} onChange={(e) => setForm({ ...form, postoDesejado: e.target.value })} placeholder="Ex.: Sargento" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoReforco })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm">
              {(Object.entries(TIPO_REFORCO_LABELS) as [TipoReforco, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (ex.: nome da operação/evento)</label>
            <input required value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={enviando || !form.funcao} className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {enviando ? 'Enviando...' : 'Enviar solicitação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
