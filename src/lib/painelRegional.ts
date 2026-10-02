/**
 * Agregações usadas pelo Painel Regional (CRB/COP) — cruzamentos de efetivo
 * por cargo (posto) e função, médias de folga, volume de trabalho e
 * afastamentos, sempre a partir dos mesmos arrays já carregados no
 * AppContext (não são coleções novas, só leitura agregada client-side).
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { calcularDiasFolga } from './escala';
import type { Afastamento, EscalaExtraordinaria, EscalaOrdinaria, FuncaoUbm, Militar, MotivoAfastamento } from '../types';

const SEM_POSTO = 'Sem posto informado';

function normalizarPosto(posto: string): string {
  return posto?.trim() || SEM_POSTO;
}

export interface MatrizEfetivo {
  cargos: string[];
  funcoes: FuncaoUbm[];
  /** linha[cargo][funcaoId] = quantidade de militares daquele cargo com aquela função. */
  linhas: { cargo: string; porFuncao: Record<string, number>; total: number }[];
  totalGeral: number;
}

/** Cruzamento cargo (posto) x função para o efetivo ativo de uma UBM. */
export function efetivoPorCargoEFuncao(militares: Militar[], funcoes: FuncaoUbm[], ubmId: string): MatrizEfetivo {
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo);
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const cargos = Array.from(new Set(militaresDaUbm.map((m) => normalizarPosto(m.posto)))).sort();

  const linhas = cargos.map((cargo) => {
    const militaresDoCargo = militaresDaUbm.filter((m) => normalizarPosto(m.posto) === cargo);
    const porFuncao: Record<string, number> = {};
    funcoesDaUbm.forEach((f) => {
      porFuncao[f.id] = militaresDoCargo.filter((m) => m.funcoes.includes(f.id)).length;
    });
    return { cargo, porFuncao, total: militaresDoCargo.length };
  });

  return { cargos, funcoes: funcoesDaUbm, linhas, totalGeral: militaresDaUbm.length };
}

export interface LinhaMediaFolga {
  cargo: string;
  funcaoId: string;
  funcaoNome: string;
  mediaFolgas: number;
  militares: number;
}

/**
 * Média de dias de folga por cargo e função, no período informado — média
 * simples de `calcularDiasFolga` entre os militares daquele cargo que têm
 * aquela função na UBM.
 */
export function mediaFolgasPorCargoEFuncao(
  militares: Militar[],
  funcoes: FuncaoUbm[],
  escalasOrdinarias: EscalaOrdinaria[],
  ubmId: string,
  periodoInicio: string,
  periodoFim: string,
): LinhaMediaFolga[] {
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo);
  const funcoesDaUbm = funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  const resultado: LinhaMediaFolga[] = [];

  const cargos = Array.from(new Set(militaresDaUbm.map((m) => normalizarPosto(m.posto)))).sort();
  for (const cargo of cargos) {
    for (const funcao of funcoesDaUbm) {
      const militaresDoGrupo = militaresDaUbm.filter((m) => normalizarPosto(m.posto) === cargo && m.funcoes.includes(funcao.id));
      if (militaresDoGrupo.length === 0) continue;
      const folgas = militaresDoGrupo.map((m) => calcularDiasFolga(m.id, funcao.id, periodoInicio, periodoFim, escalasOrdinarias));
      const media = folgas.reduce((soma, f) => soma + f, 0) / folgas.length;
      resultado.push({ cargo, funcaoId: funcao.id, funcaoNome: funcao.nome, mediaFolgas: Math.round(media * 10) / 10, militares: militaresDoGrupo.length });
    }
  }
  return resultado;
}

export interface LinhaVolumeTrabalho {
  cargo: string;
  servicosOrdinarios: number;
  servicosExtraordinarios: number;
  total: number;
}

/** Volume de trabalho (serviços ordinários + extraordinários) por cargo, no período. */
export function volumeTrabalhoPorCargo(
  militares: Militar[],
  escalasOrdinarias: EscalaOrdinaria[],
  escalasExtraordinarias: EscalaExtraordinaria[],
  ubmId: string,
  periodoInicio: string,
  periodoFim: string,
): LinhaVolumeTrabalho[] {
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo);
  const cargos = Array.from(new Set(militaresDaUbm.map((m) => normalizarPosto(m.posto)))).sort();
  const idsPorCargo = new Map<string, Set<string>>();
  cargos.forEach((cargo) => idsPorCargo.set(cargo, new Set(militaresDaUbm.filter((m) => normalizarPosto(m.posto) === cargo).map((m) => m.id))));

  return cargos.map((cargo) => {
    const ids = idsPorCargo.get(cargo)!;
    const servicosOrdinarios = escalasOrdinarias.filter((e) => e.ubmId === ubmId && e.data >= periodoInicio && e.data <= periodoFim && ids.has(e.militarId)).length;
    const servicosExtraordinarios = escalasExtraordinarias.filter((e) => e.ubmId === ubmId && e.data >= periodoInicio && e.data <= periodoFim && ids.has(e.militarSugeridoId)).length;
    return { cargo, servicosOrdinarios, servicosExtraordinarios, total: servicosOrdinarios + servicosExtraordinarios };
  });
}

export interface LinhaAfastamento {
  motivo: MotivoAfastamento;
  quantidade: number;
  diasTotal: number;
}

/** Afastamentos (contagem e total de dias) por motivo, dentro do período, pra uma UBM. */
export function afastamentosPorMotivo(
  afastamentos: Afastamento[],
  ubmId: string,
  periodoInicio: string,
  periodoFim: string,
): LinhaAfastamento[] {
  const doPeriodo = afastamentos.filter(
    (a) => a.ubmId === ubmId && a.dataInicio <= periodoFim && a.dataFim >= periodoInicio,
  );
  const porMotivo = new Map<MotivoAfastamento, { quantidade: number; diasTotal: number }>();
  for (const a of doPeriodo) {
    const inicio = a.dataInicio > periodoInicio ? a.dataInicio : periodoInicio;
    const fim = a.dataFim < periodoFim ? a.dataFim : periodoFim;
    const dias = differenceInCalendarDays(parseISO(fim), parseISO(inicio)) + 1;
    const atual = porMotivo.get(a.motivo) ?? { quantidade: 0, diasTotal: 0 };
    porMotivo.set(a.motivo, { quantidade: atual.quantidade + 1, diasTotal: atual.diasTotal + Math.max(0, dias) });
  }
  return Array.from(porMotivo.entries()).map(([motivo, v]) => ({ motivo, ...v }));
}
