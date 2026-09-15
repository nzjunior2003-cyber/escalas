import { useState } from 'react';
import { startOfWeek, addDays } from 'date-fns';
import { Download, Lock, Unlock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import { gerarPdfEscala } from '../../lib/pdfEscala';
import { temPapel, type HistoricoEscala, type TipoEscalaServico, type Ubm } from '../../types';

/** Número ordinal (ex.: "30º") + nome por extenso da UBM, sem duplicar o ordinal quando o campo `nome` já o inclui. */
function nomeUbmPorExtenso(ubm: Ubm | undefined): string {
  if (!ubm) return 'Unidade de Bombeiro Militar';
  const ordinal = ubm.sigla.match(/^\d+º/)?.[0];
  const nome = ubm.nome.trim();
  if (!ordinal || nome.startsWith(ordinal)) return nome;
  return `${ordinal} ${nome}`;
}

export default function Historico() {
  const {
    usuarioAtual,
    usuarios,
    ubms,
    comandos,
    militares,
    funcoes,
    escalasOrdinarias,
    escalasExtraordinarias,
    fechamentosEscala,
    historicoEscalas,
    fecharEscalaSemana,
    reabrirEscalaSemana,
  } = useApp();

  const ubmId = usuarioAtual?.ubmId ?? '';
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const isEscalante = temPapel(usuarioAtual, 'escalante');

  const [semana, setSemana] = useState(formatarDataISO(startOfWeek(new Date(), { weekStartsOn: 1 })));
  const [processando, setProcessando] = useState<TipoEscalaServico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const ubm = ubms.find((u) => u.id === ubmId);
  const crb = comandos.find((c) => c.tipo === 'crb' && c.ubmIds.includes(ubmId));
  const meuMilitar = militares.find((m) => m.id === usuarioAtual?.militarId);

  const fechamentoDe = (tipo: TipoEscalaServico) => fechamentosEscala.find((f) => f.id === `${ubmId}_${tipo}_${semana}`);
  const travada = (tipo: TipoEscalaServico) => fechamentoDe(tipo)?.travada ?? false;

  const handleFechar = async (tipo: TipoEscalaServico) => {
    setErro(null);
    setProcessando(tipo);
    try {
      await fecharEscalaSemana({ ubmId, tipo, semanaInicio: semana });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível fechar a escala.');
    } finally {
      setProcessando(null);
    }
  };

  const handleReabrir = async (tipo: TipoEscalaServico) => {
    setErro(null);
    setProcessando(tipo);
    try {
      await reabrirEscalaSemana({ ubmId, tipo, semanaInicio: semana });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível reabrir a escala.');
    } finally {
      setProcessando(null);
    }
  };

  const baixarPdf = async (tipo: TipoEscalaServico) => {
    setErro(null);
    setProcessando(tipo);
    try {
      const dias = Array.from({ length: 7 }, (_, i) => formatarDataISO(addDays(new Date(`${semana}T00:00:00`), i)));
      const escalas = tipo === 'ordinaria' ? escalasOrdinarias : escalasExtraordinarias;
      const linhas = escalas
        .filter((e) => e.ubmId === ubmId && dias.includes(e.data))
        .map((e) => ({
          funcaoId: e.funcao,
          data: e.data,
          militarNome: (() => {
            const militar = militares.find((m) => m.id === e.militarId);
            return militar ? `${militar.posto} ${militar.nome}`.trim() : 'Militar removido';
          })(),
          motivo: 'motivo' in e ? e.motivo : undefined,
        }));

      await gerarPdfEscala({
        tipo,
        ubmNome: nomeUbmPorExtenso(ubm),
        ubmLogoDataUrl: ubm?.logoDataUrl,
        ubmEndereco: ubm?.endereco,
        ubmCep: ubm?.cep,
        ubmBairro: ubm?.bairro,
        ubmCidade: ubm?.cidade,
        ubmEmail: ubm?.email,
        ubmTelefone: ubm?.telefone,
        crbNome: crb ? `${crb.nome} - ${crb.sigla}` : undefined,
        semanaInicio: semana,
        funcoes: funcoesDaUbm.map((f) => ({ id: f.id, nome: f.nome })),
        linhas,
        escalanteNome: usuarioAtual?.nomeGuerra || usuarioAtual?.nome || '',
        escalanteCargo: usuarioAtual?.cargo || meuMilitar?.posto,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setProcessando(null);
    }
  };

  const baixarPdfDoHistorico = async (h: HistoricoEscala) => {
    const funcoesUnicas = new Map<string, string>();
    h.linhas.forEach((l) => funcoesUnicas.set(l.funcaoId, l.funcaoNome));

    await gerarPdfEscala({
      tipo: h.tipo,
      ubmNome: nomeUbmPorExtenso(ubm),
      ubmLogoDataUrl: ubm?.logoDataUrl,
      ubmEndereco: ubm?.endereco,
      ubmCep: ubm?.cep,
      ubmBairro: ubm?.bairro,
      ubmCidade: ubm?.cidade,
      ubmEmail: ubm?.email,
      ubmTelefone: ubm?.telefone,
      crbNome: crb ? `${crb.nome} - ${crb.sigla}` : undefined,
      semanaInicio: h.semanaInicio,
      funcoes: Array.from(funcoesUnicas.entries()).map(([id, nome]) => ({ id, nome })),
      linhas: h.linhas,
      escalanteNome: usuarios.find((u) => u.id === h.fechadoPorId)?.nome ?? '',
      escalanteCargo: usuarios.find((u) => u.id === h.fechadoPorId)?.cargo,
    });
  };

  const nomeUsuario = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? '—';
  const historicoDaUbm = historicoEscalas.filter((h) => h.ubmId === ubmId).sort((a, b) => b.fechado_em.localeCompare(a.fechado_em));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Histórico</h1>
        <p className="mt-1 text-sm text-gray-500">
          Fechar a escala da semana libera o PDF padronizado e grava uma versão no histórico. O escalante pode reabrir
          pra editar de novo — cada novo fechamento gera uma nova versão, refletindo o que de fato foi publicado.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Semana (segunda-feira)</label>
          <input
            type="date"
            value={semana}
            onChange={(e) => setSemana(e.target.value)}
            className="w-full sm:w-64 border border-gray-300 rounded-md text-sm py-2 px-3"
          />
        </div>

        {funcoesDaUbm.length === 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            Nenhuma função cadastrada nesta UBM ainda. Cadastre em "Funções" antes de gerar o relatório.
          </p>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        {(['ordinaria', 'extraordinaria'] as TipoEscalaServico[]).map((tipo) => {
          const fechada = travada(tipo);
          return (
            <div key={tipo} className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <span className="text-sm font-medium text-gray-700 w-40">
                {tipo === 'ordinaria' ? 'Escala Ordinária' : 'Escala Extraordinária'}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${fechada ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                {fechada ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />} {fechada ? 'Fechada' : 'Aberta (editável)'}
              </span>

              {isEscalante && (
                fechada ? (
                  <button
                    onClick={() => handleReabrir(tipo)}
                    disabled={processando !== null}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reabrir pra editar
                  </button>
                ) : (
                  <button
                    onClick={() => handleFechar(tipo)}
                    disabled={processando !== null}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
                  >
                    Fechar escala
                  </button>
                )
              )}

              <button
                onClick={() => baixarPdf(tipo)}
                disabled={processando !== null || funcoesDaUbm.length === 0 || !fechada}
                title={!fechada ? 'Feche a escala da semana pra liberar o PDF' : undefined}
                className="ml-auto inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50"
              >
                <Download className="-ml-1 mr-1.5 h-3.5 w-3.5" /> {processando === tipo ? 'Gerando...' : 'PDF'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {historicoDaUbm.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400">Nenhuma escala fechada ainda.</p>
        ) : (
          historicoDaUbm.map((h) => (
            <div key={h.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 capitalize">{h.tipo} — Semana {h.semanaInicio} · v{h.versao}</div>
                <div className="text-gray-500">Fechada por {nomeUsuario(h.fechadoPorId)} em {new Date(h.fechado_em).toLocaleString('pt-BR')}</div>
              </div>
              <button onClick={() => baixarPdfDoHistorico(h)} className="shrink-0 self-end sm:self-auto text-xs text-red-600 hover:text-red-800 font-medium p-2 -m-2">
                Baixar PDF
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
