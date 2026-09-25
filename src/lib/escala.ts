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
 * - Escala extraordinária: sugestão automática priorizando quem tem MENOS
 *   serviços no total — ordinária E extraordinária somadas, não só
 *   extraordinária — na função (o "mais folgado" dos dois tipos juntos),
 *   desempatando por quem está há mais tempo sem reforço extraordinário.
 *   Ninguém é sugerido (nem aceito manualmente) acima de
 *   `LIMITE_EXTRAORDINARIAS_POR_MES` reforços no mesmo mês — teto de
 *   sobrecarga por militar, contado em qualquer função. A alteração manual
 *   pelo escalante NÃO deve corromper essa contagem: a estatística conta
 *   sempre o `militarSugeridoId` original, mesmo que `militarId` (o
 *   efetivamente escalado) seja outro — a exceção fica registrada em
 *   separado (militarId !== militarSugeridoId).
 *
 * Afastamento e recuperação depois: um militar afastado nunca é escalado
 * nesse período (`estaAfastado`), mas isso sozinho faria QUALQUER motivo de
 * afastamento gerar uma "fila de recuperação" quando ele volta — o algoritmo
 * de equalização, sem mais nada, sempre prioriza quem tem menos serviços, e
 * quem esteve afastado naturalmente tem menos. Isso só é o comportamento
 * certo pros motivos em `MOTIVOS_COM_FILA_DE_RECUPERACAO` (missão externa e
 * atestado médico avulso): a pessoa continuou "devendo" o serviço — na
 * missão, porque seguiu trabalhando pelo CBMPA fora da rotação normal; no
 * atestado, porque é uma dispensa pontual sem passar pela junta médica.
 * Férias, licença e dispensa médica (essa sim autorizada pela junta) são
 * afastamento reconhecido — não geram fila de recuperação, a pessoa serve
 * proporcionalmente menos nesse período e pronto, sem ficar "devendo" nem
 * sendo priorizada depois disso. `diasIsentosAteData` credita esses dias
 * como se já tivessem sido servidos (só pra fins de comparação de
 * equalização), neutralizando a recuperação; os motivos com fila não
 * recebem esse crédito, então continuam gerando prioridade normalmente.
 */
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import {
  MOTIVOS_COM_FILA_DE_RECUPERACAO,
  type Afastamento,
  type EscalaExtraordinaria,
  type EscalaOrdinaria,
  type FuncaoUbm,
  type Militar,
} from '../types';

export const FORMATO_DATA = 'yyyy-MM-dd';

export function formatarDataISO(data: Date): string {
  return format(data, FORMATO_DATA);
}

/** Segunda-feira (yyyy-MM-dd) da semana à qual `data` (yyyy-MM-dd) pertence — usado pra achar o fechamento da semana. */
export function semanaInicioDe(data: string): string {
  return formatarDataISO(startOfWeek(parseISO(data), { weekStartsOn: 1 }));
}

/**
 * A geração automática de previsões futuras só libera depois que o
 * escalante confirma ter terminado de cadastrar o efetivo (`ubm.efetivoCompleto`)
 * E a primeira semana com lançamentos (a mais antiga que já tem qualquer
 * escala ordinária na UBM) está com TODAS as funções ativas preenchidas nos
 * 7 dias — ou seja, montada manualmente antes do sistema assumir.
 */
export function previsaoLiberada(
  ubm: { efetivoCompleto?: boolean } | undefined,
  funcoesAtivas: FuncaoUbm[],
  escalasOrdinariasDaUbm: EscalaOrdinaria[],
): boolean {
  if (!ubm?.efetivoCompleto) return false;
  if (funcoesAtivas.length === 0) return false;
  if (escalasOrdinariasDaUbm.length === 0) return false;

  const dataMaisAntiga = escalasOrdinariasDaUbm.reduce((min, e) => (e.data < min ? e.data : min), escalasOrdinariasDaUbm[0].data);
  const semanaBase = semanaInicioDe(dataMaisAntiga);
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => formatarDataISO(addDays(parseISO(semanaBase), i)));

  return funcoesAtivas.every((f) =>
    diasDaSemana.every((dia) => escalasOrdinariasDaUbm.some((e) => e.funcao === f.id && e.data === dia)),
  );
}

export function militaresDaFuncao(militares: Militar[], ubmId: string, funcao: string): Militar[] {
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
 * Dias de afastamento (até `ateData`, inclusive) que NÃO geram fila de
 * recuperação — todo motivo fora de `MOTIVOS_COM_FILA_DE_RECUPERACAO`
 * (ver nota do módulo).
 */
export function diasIsentosAteData(militarId: string, ateData: string, afastamentos: Afastamento[]): number {
  let dias = 0;
  for (const a of afastamentos) {
    if (a.militarId !== militarId || MOTIVOS_COM_FILA_DE_RECUPERACAO.includes(a.motivo) || a.dataInicio > ateData) continue;
    const fimEfetivo = a.dataFim < ateData ? a.dataFim : ateData;
    dias += differenceInCalendarDays(parseISO(fimEfetivo), parseISO(a.dataInicio)) + 1;
  }
  return dias;
}

/**
 * Gera a previsão de escala ordinária corrida para TODAS as funções ativas
 * de uma UBM de uma vez (nunca uma função isolada): um militar vinculado a
 * mais de uma função só pode estar em UMA por dia, e a prioridade de quem
 * tem múltiplas funções vai sempre para a função com MENOS militares
 * vinculados — é ela que sofre mais com a ausência dele, então equaliza-la
 * primeiro é o que mantém a folga de todo mundo parecida. Na prática: as
 * funções são processadas em ordem crescente de tamanho a cada dia, e quem
 * já foi escalado em uma função naquele dia sai do páreo das demais.
 *
 * A contagem de equidade é por MILITAR, não por função: um dia de serviço
 * conta pro total dele independente de qual função ele cobriu naquele dia —
 * a função só decide QUEM PODE ser escalado nela (precisa ter a função
 * atribuída), nunca separa a contagem em filas por função. Entre os
 * elegíveis e disponíveis de uma função, vence quem tem MENOS serviços
 * acumulados no total (qualquer função), desempatando por quem serviu há
 * mais tempo (ou nunca serviu). Precisa do histórico já persistido
 * (`escalasOrdinariasExistentes`, de QUALQUER função da UBM) pra contar
 * certo — sem ele, cada geração recomeçaria do zero e favoreceria sempre
 * os primeiros da lista.
 */
export function gerarEscalaOrdinariaUbm(params: {
  ubmId: string;
  funcoes: FuncaoUbm[];
  militares: Militar[];
  afastamentos: Afastamento[];
  escalasOrdinariasExistentes: EscalaOrdinaria[];
  dataInicio: string;
  dataFim: string;
}): Omit<EscalaOrdinaria, 'id' | 'criado_em'>[] {
  const { ubmId, afastamentos, escalasOrdinariasExistentes, dataInicio, dataFim } = params;
  const funcoesAtivas = params.funcoes.filter((f) => f.ubmId === ubmId && f.ativa);
  if (funcoesAtivas.length === 0) return [];

  const elegiveisPorFuncao = new Map<string, Militar[]>(
    funcoesAtivas.map((f) => [f.id, militaresDaFuncao(params.militares, ubmId, f.id)]),
  );
  // Funções mais escassas primeiro — quem acumula funções é priorizado nelas.
  const funcoesOrdenadas = [...funcoesAtivas].sort(
    (a, b) => (elegiveisPorFuncao.get(a.id)?.length ?? 0) - (elegiveisPorFuncao.get(b.id)?.length ?? 0),
  );

  // Contagem e último serviço por militar (não por função) — todo mundo que
  // aparece em pelo menos uma função ativa entra aqui uma única vez.
  const todosElegiveis = new Map<string, Militar>();
  elegiveisPorFuncao.forEach((lista) => lista.forEach((m) => todosElegiveis.set(m.id, m)));

  const contagem = new Map<string, number>();
  const ultimoServico = new Map<string, string>();
  todosElegiveis.forEach((_m, militarId) => {
    contagem.set(militarId, diasIsentosAteData(militarId, dataFim, afastamentos));
  });

  const diasJaEscaladosPorFuncao = new Map<string, Set<string>>(funcoesAtivas.map((f) => [f.id, new Set<string>()]));
  const militarOcupadoNoDia = new Map<string, Set<string>>();
  for (const e of escalasOrdinariasExistentes) {
    if (e.ubmId !== ubmId) continue;
    diasJaEscaladosPorFuncao.get(e.funcao)?.add(e.data);
    if (!militarOcupadoNoDia.has(e.data)) militarOcupadoNoDia.set(e.data, new Set());
    militarOcupadoNoDia.get(e.data)!.add(e.militarId);
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
    const ocupadosHoje = new Set(militarOcupadoNoDia.get(dataStr) ?? []);

    for (const funcao of funcoesOrdenadas) {
      const jaEscalados = diasJaEscaladosPorFuncao.get(funcao.id)!;
      if (jaEscalados.has(dataStr)) continue;

      const elegiveis = elegiveisPorFuncao.get(funcao.id) ?? [];
      const disponiveis = elegiveis.filter((m) => !estaAfastado(m.id, dataStr, afastamentos) && !ocupadosHoje.has(m.id));
      if (disponiveis.length === 0) continue;

      disponiveis.sort((a, b) => {
        const diferenca = (contagem.get(a.id) ?? 0) - (contagem.get(b.id) ?? 0);
        if (diferenca !== 0) return diferenca;
        return (ultimoServico.get(a.id) ?? '').localeCompare(ultimoServico.get(b.id) ?? '');
      });
      const escolhido = disponiveis[0];

      resultado.push({ ubmId, funcao: funcao.id, data: dataStr, militarId: escolhido.id, origem: 'gerada' });
      contagem.set(escolhido.id, (contagem.get(escolhido.id) ?? 0) + 1);
      ultimoServico.set(escolhido.id, dataStr);
      ocupadosHoje.add(escolhido.id);
      jaEscalados.add(dataStr);
    }

    dataAtual = addDays(dataAtual, 1);
  }

  return resultado;
}

/** Dias de folga acumulados por militar dentro de uma função, no período informado. */
export function calcularDiasFolga(
  militarId: string,
  funcao: string,
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

/** Teto mensal de reforços extraordinários por militar (item 7 do pedido do CBMPA) — protege contra sobrecarga e força a equalização a girar entre mais gente. */
export const LIMITE_EXTRAORDINARIAS_POR_MES = 12;

/**
 * Quantas extraordinárias (qualquer função, da própria UBM) o militar já tem
 * no mesmo mês/ano de `data`, SOMADAS aos reforços de CRB/COP atendidos
 * nesse mês (motivo 'reforco_crb_cop' em `Afastamento`) — pro teto mensal
 * (`LIMITE_EXTRAORDINARIAS_POR_MES`) valer pra sobrecarga real do militar,
 * não só pro que a própria UBM lançou. `afastamentos` é opcional só pra não
 * quebrar chamadas antigas que ainda não tinham esse dado à mão; sempre que
 * disponível, deve ser passado.
 */
export function extraordinariasNoMes(
  militarId: string,
  data: string,
  extraordinarias: EscalaExtraordinaria[],
  afastamentos: Afastamento[] = [],
): number {
  const mes = data.slice(0, 7); // yyyy-MM
  const daPropriaUbm = extraordinarias.filter((e) => e.militarId === militarId && e.data.slice(0, 7) === mes).length;
  const reforcosCrbCop = afastamentos.filter(
    (a) => a.militarId === militarId && a.motivo === 'reforco_crb_cop' && a.dataInicio.slice(0, 7) === mes,
  ).length;
  return daPropriaUbm + reforcosCrbCop;
}

/**
 * Um militar só pode ser escalado numa extraordinária se tiver pelo menos
 * 24h de folga desde o serviço (ordinária OU extraordinária, de qualquer
 * função) imediatamente anterior — como o serviço é um turno de 24h corrido,
 * isso equivale a: não ter servido no dia de calendário imediatamente
 * anterior a `data`.
 */
export function temFolga24hAntes(
  militarId: string,
  data: string,
  escalasOrdinarias: EscalaOrdinaria[],
  extraordinariasAnteriores: EscalaExtraordinaria[],
): boolean {
  const diaAnterior = formatarDataISO(addDays(parseISO(data), -1));
  const serviuOrdinaria = escalasOrdinarias.some((e) => e.militarId === militarId && e.data === diaAnterior);
  const serviuExtraordinaria = extraordinariasAnteriores.some((e) => e.militarId === militarId && e.data === diaAnterior);
  return !serviuOrdinaria && !serviuExtraordinaria;
}

/**
 * Hierarquia dos praças, do mais antigo pro mais moderno — usada só como
 * desempate entre militares já empatados em "mais folgado" (nunca decide
 * sozinha: ver `ordenarCandidatosExtraordinario`). Índice menor = mais
 * antigo. Postos fora dessa lista (oficiais, texto não reconhecido) voltam
 * -1 — tratados como mais antigos que qualquer praça, então nunca "sobram"
 * como os mais modernos num empate.
 */
const HIERARQUIA_PRACAS_MAIS_ANTIGO_PRIMEIRO = [
  ['subtenente'],
  ['1 sgt', '1o sgt', 'primeiro sgt', 'primeiro sargento'],
  ['2 sgt', '2o sgt', 'segundo sgt', 'segundo sargento'],
  ['3 sgt', '3o sgt', 'terceiro sgt', 'terceiro sargento'],
  ['cb', 'cabo'],
  ['sd', 'soldado'],
];

function normalizarPosto(posto: string): string {
  return posto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[º°]/g, 'o')
    .trim();
}

/** Posição na hierarquia (0 = mais antigo). -1 pra postos não reconhecidos (oficiais etc.), tratados como mais antigos que qualquer praça listada. */
export function posicaoNaHierarquia(posto: string): number {
  const normalizado = normalizarPosto(posto);
  return HIERARQUIA_PRACAS_MAIS_ANTIGO_PRIMEIRO.findIndex((sinonimos) =>
    sinonimos.some((s) => normalizado === s || normalizado.includes(s)),
  );
}

/**
 * Ordena os elegíveis pra uma escala extraordinária (função + data): dentro
 * do rodízio da função solicitada, prioriza quem está mais "folgado" —
 * considerando o total de serviços já feitos (ordinária + extraordinária
 * juntas, não só extraordinária). Só entre EMPATADOS em folga, desempata por
 * hierarquia (mais moderno primeiro) e, ainda empatado, por há-mais-tempo-
 * sem-reforço-extraordinário. Nunca inclui quem já bateu o teto mensal de
 * `LIMITE_EXTRAORDINARIAS_POR_MES` reforços, nem quem não tem 24h de folga
 * desde o serviço anterior (ver `temFolga24hAntes`) — únicos impedimentos
 * de elegibilidade.
 *
 * Usada tanto pra sugestão automática (índice 0 — ver `sugerirMilitarExtraordinario`)
 * quanto pra montar a lista prévia de uma vaga voluntária (os N primeiros
 * dessa ordem, ver `dispararVagaVoluntariaExtraordinaria`).
 */
export function ordenarCandidatosExtraordinario(params: {
  ubmId: string;
  funcao: string;
  data: string;
  militares: Militar[];
  afastamentos: Afastamento[];
  escalasOrdinarias: EscalaOrdinaria[];
  extraordinariasAnteriores: EscalaExtraordinaria[];
}): Militar[] {
  const { ubmId, funcao, data, afastamentos, escalasOrdinarias, extraordinariasAnteriores } = params;
  const elegiveis = militaresDaFuncao(params.militares, ubmId, funcao)
    .filter((m) => !estaAfastado(m.id, data, afastamentos))
    .filter((m) => extraordinariasNoMes(m.id, data, extraordinariasAnteriores, afastamentos) < LIMITE_EXTRAORDINARIAS_POR_MES)
    .filter((m) => temFolga24hAntes(m.id, data, escalasOrdinarias, extraordinariasAnteriores));
  if (elegiveis.length === 0) return [];

  const ultimaVezPorMilitar = new Map<string, string>();
  for (const e of extraordinariasAnteriores) {
    if (e.funcao !== funcao) continue;
    const atual = ultimaVezPorMilitar.get(e.militarSugeridoId);
    if (!atual || e.data > atual) ultimaVezPorMilitar.set(e.militarSugeridoId, e.data);
  }

  // Prioridade principal: menor total de serviços (ordinária + extraordinária,
  // até a data) na função — o mais folgado dos dois tipos combinados vem
  // primeiro. Só entre empatados, desempata por hierarquia (mais moderno
  // primeiro — CB e SD antes de Sargento/Subtenente) e, ainda empatado, por
  // há-mais-tempo-sem-reforço-extraordinário — descontando dias de
  // férias/licença/dispensa médica/outro que caíram depois do último
  // reforço (não geram fila de recuperação: empurram a "última vez" pra
  // frente, como se tivessem sido servidos naquele meio tempo). Missão
  // externa não desconta nada — o tempo afastado nessa continua contando a
  // favor da prioridade de recuperação depois.
  return elegiveis
    .map((m) => {
      const servicosOrdinaria = escalasOrdinarias.filter(
        (e) => e.ubmId === ubmId && e.funcao === funcao && e.militarId === m.id && e.data <= data,
      ).length;
      const servicosExtraordinaria = extraordinariasAnteriores.filter(
        (e) => e.funcao === funcao && e.militarSugeridoId === m.id && e.data <= data,
      ).length;
      const totalServicos = servicosOrdinaria + servicosExtraordinaria;

      const ultimaReal = ultimaVezPorMilitar.get(m.id);
      let ultimaData = '';
      if (ultimaReal) {
        const isentosNoIntervalo = diasIsentosAteData(m.id, data, afastamentos) - diasIsentosAteData(m.id, ultimaReal, afastamentos);
        ultimaData = isentosNoIntervalo > 0 ? formatarDataISO(addDays(parseISO(ultimaReal), isentosNoIntervalo)) : ultimaReal;
      }
      return { militar: m, totalServicos, hierarquia: posicaoNaHierarquia(m.posto), ultimaData };
    })
    .sort((a, b) => {
      const diferencaServicos = a.totalServicos - b.totalServicos;
      if (diferencaServicos !== 0) return diferencaServicos;
      const diferencaHierarquia = b.hierarquia - a.hierarquia; // maior índice (mais moderno) primeiro
      if (diferencaHierarquia !== 0) return diferencaHierarquia;
      return a.ultimaData.localeCompare(b.ultimaData);
    })
    .map((c) => c.militar);
}

/**
 * Sugestão automática (índice 0 de `ordenarCandidatosExtraordinario`) —
 * mantida como função separada porque é o caso de uso mais comum (criação
 * direta e resolução compulsória). Estatística de recorrência baseada em
 * `militarSugeridoId`, não no `militarId` final — ver nota do módulo.
 */
export function sugerirMilitarExtraordinario(params: {
  ubmId: string;
  funcao: string;
  data: string;
  militares: Militar[];
  afastamentos: Afastamento[];
  escalasOrdinarias: EscalaOrdinaria[];
  extraordinariasAnteriores: EscalaExtraordinaria[];
}): Militar | null {
  return ordenarCandidatosExtraordinario(params)[0] ?? null;
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

/**
 * Distribui `total` proporcionalmente entre os pesos informados (ex.:
 * efetivo ativo de cada UBM), pelo método dos maiores restos — garante que
 * a soma das cotas bate exatamente com `total` (diferente de um
 * arredondamento simples, que pode sobrar ou faltar unidade). Pesos zerados
 * ficam de fora (não recebem cota). Itera pela lista de entrada, então
 * chame com uma ordem já estável se o desempate por resto importar.
 */
export function distribuirProporcional(total: number, pesos: { id: string; peso: number }[]): { id: string; quantidade: number }[] {
  const validos = pesos.filter((p) => p.peso > 0);
  const somaPesos = validos.reduce((acc, p) => acc + p.peso, 0);
  if (total <= 0 || somaPesos <= 0) return validos.map((p) => ({ id: p.id, quantidade: 0 }));

  const brutos = validos.map((p) => {
    const exato = (total * p.peso) / somaPesos;
    return { id: p.id, base: Math.floor(exato), resto: exato - Math.floor(exato) };
  });

  let distribuido = brutos.reduce((acc, b) => acc + b.base, 0);
  let faltam = total - distribuido;

  const porResto = [...brutos].sort((a, b) => b.resto - a.resto);
  for (let i = 0; i < porResto.length && faltam > 0; i++, faltam--) {
    porResto[i].base += 1;
  }

  return brutos.map((b) => ({ id: b.id, quantidade: b.base }));
}
