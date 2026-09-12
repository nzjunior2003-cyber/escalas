/**
 * Núcleo das regras de escala (PRD seção 5).
 *
 * - Escala ordinária: corrida, agrupada por função, rodízio round-robin —
 *   garante o mesmo número de dias de folga para todos dentro da mesma
 *   função e nunca escala dois dias seguidos para o mesmo militar quando há
 *   mais de um militar na função (respeita as 24h mínimas de folga).
 * - Escala extraordinária: sugestão automática priorizando quem está há
 *   mais tempo sem reforço extraordinário (o "mais folgado"). A alteração
 *   manual pelo escalante NÃO deve corromper o rodízio: a estatística conta
 *   sempre o `militarSugeridoId` original para fins de rodízio, mesmo que
 *   `militarId` (o efetivamente escalado) seja outro — a exceção fica
 *   registrada em separado (militarId !== militarSugeridoId).
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
 * Gera a previsão de escala ordinária corrida para uma função, distribuindo
 * os dias em round-robin entre os militares ativos daquela função — cada um
 * assume um dia por vez, na mesma ordem, pulando quem estiver afastado
 * naquele dia. Isso garante contagem de folga igual dentro da função e, com
 * 2+ militares, sempre pelo menos 24h de folga entre serviços de cada um.
 */
export function gerarEscalaOrdinaria(params: {
  ubmId: string;
  funcao: FuncaoOperacional;
  militares: Militar[];
  afastamentos: Afastamento[];
  dataInicio: string;
  dataFim: string;
  /** Ponto de partida do rodízio (índice do próximo militar a ser escalado). */
  indiceInicial?: number;
}): Omit<EscalaOrdinaria, 'id' | 'criado_em'>[] {
  const { ubmId, funcao, afastamentos, dataInicio, dataFim } = params;
  const elegiveis = militaresDaFuncao(params.militares, ubmId, funcao);
  if (elegiveis.length === 0) return [];

  const resultado: Omit<EscalaOrdinaria, 'id' | 'criado_em'>[] = [];
  let indice = params.indiceInicial ?? 0;
  let dataAtual = parseISO(dataInicio);
  const fim = parseISO(dataFim);
  let tentativasSemEscala = 0;

  while (differenceInCalendarDays(fim, dataAtual) >= 0) {
    const dataStr = formatarDataISO(dataAtual);
    const candidato = elegiveis[indice % elegiveis.length];
    indice++;

    if (estaAfastado(candidato.id, dataStr, afastamentos)) {
      // Militar afastado nesse dia: pula para o próximo do rodízio sem
      // avançar a data, até achar alguém disponível ou esgotar a rodada.
      tentativasSemEscala++;
      if (tentativasSemEscala < elegiveis.length) continue;
      tentativasSemEscala = 0;
      dataAtual = addDays(dataAtual, 1);
      continue;
    }

    tentativasSemEscala = 0;
    resultado.push({ ubmId, funcao, data: dataStr, militarId: candidato.id, origem: 'gerada' });
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
