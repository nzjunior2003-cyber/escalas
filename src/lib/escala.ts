/**
 * Núcleo das regras de escala (PRD seção 5).
 *
 * O objetivo de fundo, para ordinária e extraordinária: ao final de um ano,
 * todo militar dentro de uma função deve ter feito aproximadamente a mesma
 * quantidade de serviços (e, por consequência, a mesma quantidade de
 * folgas) que os demais da própria função. Isso só se sustenta se a
 * distribuição olhar para o HISTÓRICO REAL já registrado, e não para um
 * ponteiro de rodízio reiniciado a cada geração — do contrário, gerar a
 * escala várias vezes ao longo do ano (semana a semana, ou depois de
 * incluir/excluir alguém da função) sempre favoreceria quem está primeiro
 * na lista.
 *
 * - Escala ordinária: pra cada dia do período, escolhe entre os militares
 *   disponíveis (ativos na função, não afastados) quem tem MENOS serviços
 *   acumulados naquela função até ali — contando tanto o histórico já
 *   persistido quanto o que a própria geração atual já distribuiu —,
 *   desempatando por quem serviu há mais tempo (ou nunca serviu). Isso
 *   equaliza sozinho mesmo com militares entrando/saindo da função ou com
 *   gerações parciais e repetidas ao longo do ano.
 * - Escala extraordinária: sugestão automática priorizando quem está há
 *   mais tempo sem reforço extraordinário (o "mais folgado") — o mesmo
 *   princípio de equalização, aplicado um reforço de cada vez. A alteração
 *   manual pelo escalante NÃO deve corromper essa contagem: a estatística
 *   conta sempre o `militarSugeridoId` original, mesmo que `militarId` (o
 *   efetivamente escalado) seja outro — a exceção fica registrada em
 *   separado (militarId !== militarSugeridoId).
 */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type {
  Afastamento,
  EscalaExtraordinaria,
  EscalaOrdinaria,
  FuncaoOperacional,
  Militar,
} from '../types';

export const FORMATO_DATA = 'yyyy-MM-dd';

export function formatarDataISO(data: Date): string {
  return format(data, FORMATO_DATA);
}

export function militaresDaFuncao(militares: Militar[], ubmId: string, funcao: FuncaoOperacional): Militar[] {
  return militares
    .filter((m) => m.ubmId === ubmId && m.ativo && m.funcoes.includes(funcao))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Um militar está bloqueado de qualquer escalação (ordinária/extra/diferenciada) durante o afastamento. */
export function estaAfastado(militarId: string, data: string, afastamentos: Afastamento[]): boolean {
  return afastamentos.some(
    (a) => a.militarId === militarId && data >= a.dataInicio && data <= a.dataFim,
  );
}

/**
 * Gera a previsão de escala ordinária corrida para uma função: em cada dia
 * do período, escala quem tem menos serviços acumulados naquela função (ver
 * nota do módulo) entre os disponíveis — pulando quem estiver afastado —,
 * desempatando por quem serviu há mais tempo (ou nunca serviu). Precisa do
 * histórico já persistido (`escalasOrdinariasExistentes`) para contar certo;
 * sem ele, cada geração recomeçaria do zero e favoreceria sempre os
 * primeiros da lista.
 */
export function gerarEscalaOrdinaria(params: {
  ubmId: string;
  funcao: FuncaoOperacional;
  militares: Militar[];
  afastamentos: Afastamento[];
  escalasOrdinariasExistentes: EscalaOrdinaria[];
  dataInicio: string;
  dataFim: string;
}): Omit<EscalaOrdinaria, 'id' | 'criado_em'>[] {
  const { ubmId, funcao, afastamentos, escalasOrdinariasExistentes, dataInicio, dataFim } = params;
  const elegiveis = militaresDaFuncao(params.militares, ubmId, funcao);
  if (elegiveis.length === 0) return [];

  const contagem = new Map<string, number>(elegiveis.map((m) => [m.id, 0]));
  const ultimoServico = new Map<string, string>();
  const diasJaEscalados = new Set<string>();
  for (const e of escalasOrdinariasExistentes) {
    if (e.ubmId !== ubmId || e.funcao !== funcao) continue;
    diasJaEscalados.add(e.data);
    if (!contagem.has(e.militarId)) continue;
    contagem.set(e.militarId, (contagem.get(e.militarId) ?? 0) + 1);
    const atual = ultimoServico.get(e.militarId);
    if (!atual || e.data > atual) ultimoServico.set(e.militarId, e.data);
  }

  const resultado: Omit<EscalaOrdinaria, 'id' | 'criado_em'>[] = [];
  let dataAtual = parseISO(dataInicio);
  const fim = parseISO(dataFim);

  while (differenceInCalendarDays(fim, dataAtual) >= 0) {
    const dataStr = formatarDataISO(dataAtual);

    if (diasJaEscalados.has(dataStr)) {
      // Esse dia já tem alguém escalado (de uma geração anterior) — não
      // duplica; quem quiser mudar, edita a escala já gerada.
      dataAtual = addDays(dataAtual, 1);
      continue;
    }

    const disponiveis = elegiveis.filter((m) => !estaAfastado(m.id, dataStr, afastamentos));

    if (disponiveis.length === 0) {
      // Ninguém da função disponível nesse dia (todos afastados) — não dá
      // pra escalar, segue pro próximo dia sem deixar isso desequilibrar a
      // contagem de ninguém.
      dataAtual = addDays(dataAtual, 1);
      continue;
    }

    disponiveis.sort((a, b) => {
      const diferenca = (contagem.get(a.id) ?? 0) - (contagem.get(b.id) ?? 0);
      if (diferenca !== 0) return diferenca;
      return (ultimoServico.get(a.id) ?? '').localeCompare(ultimoServico.get(b.id) ?? '');
    });
    const escolhido = disponiveis[0];

    resultado.push({ ubmId, funcao, data: dataStr, militarId: escolhido.id, origem: 'gerada' });
    contagem.set(escolhido.id, (contagem.get(escolhido.id) ?? 0) + 1);
    ultimoServico.set(escolhido.id, dataStr);
    dataAtual = addDays(dataAtual, 1);
  }

  return resultado;
}

/** Dias de folga acumulados por militar dentro de uma função, no período informado. */
export function calcularDiasFolga(
  militarId: string,
  funcao: FuncaoOperacional,
  periodoInicio: string,
  periodoFim: string,
  escalasOrdinarias: EscalaOrdinaria[],
): number {
  const diasNoPeriodo = differenceInCalendarDays(parseISO(periodoFim), parseISO(periodoInicio)) + 1;
  const diasEscalado = escalasOrdinarias.filter(
    (e) => e.militarId === militarId && e.funcao === funcao && e.data >= periodoInicio && e.data <= periodoFim,
  ).length;
  return Math.max(0, diasNoPeriodo - diasEscalado);
}

/**
 * Sugere o militar para uma escala extraordinária: dentro do rodízio da
 * função solicitada, prioriza quem está há mais tempo sem ser escalado em
 * extraordinária (estatística baseada em `militarSugeridoId`, não no
 * `militarId` final — ver nota do módulo).
 */
export function sugerirMilitarExtraordinario(params: {
  ubmId: string;
  funcao: FuncaoOperacional;
  data: string;
  militares: Militar[];
  afastamentos: Afastamento[];
  extraordinariasAnteriores: EscalaExtraordinaria[];
}): Militar | null {
  const { ubmId, funcao, data, afastamentos, extraordinariasAnteriores } = params;
  const elegiveis = militaresDaFuncao(params.militares, ubmId, funcao).filter(
    (m) => !estaAfastado(m.id, data, afastamentos),
  );
  if (elegiveis.length === 0) return null;

  const ultimaVezPorMilitar = new Map<string, string>();
  for (const e of extraordinariasAnteriores) {
    if (e.funcao !== funcao) continue;
    const atual = ultimaVezPorMilitar.get(e.militarSugeridoId);
    if (!atual || e.data > atual) ultimaVezPorMilitar.set(e.militarSugeridoId, e.data);
  }

  // Quem nunca foi escalado em extraordinária vem primeiro (data "infinitamente" antiga);
  // entre os demais, o que está há mais tempo sem reforço extraordinário.
  const comOrdenacao = elegiveis
    .map((m) => ({ militar: m, ultimaData: ultimaVezPorMilitar.get(m.id) ?? '' }))
    .sort((a, b) => a.ultimaData.localeCompare(b.ultimaData));

  return comOrdenacao[0]?.militar ?? null;
}

/** Contagem de reforços extraordinários por militar (estatística — seção 8). */
export function contarExtraordinariasPorMilitar(
  extraordinarias: EscalaExtraordinaria[],
): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const e of extraordinarias) {
    contagem.set(e.militarSugeridoId, (contagem.get(e.militarSugeridoId) ?? 0) + 1);
  }
  return contagem;
}
