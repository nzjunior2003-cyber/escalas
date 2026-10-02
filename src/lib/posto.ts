/**
 * Abreviação de posto/graduação pra exibição compacta (cartões da escala).
 * A planilha pública de efetivo não padroniza esse campo (vem como texto
 * livre — "1 SARGENTO", "SUB - TENENTE", "STEN", "SARGENTO 1º" etc.), então
 * o reconhecimento é por padrão (regex tolerante), não por igualdade exata.
 * Quando nada bate, devolve o texto original sem alterar — nunca esconde
 * informação por não reconhecer o formato.
 */
const REGRAS_ABREVIACAO_POSTO: { padrao: RegExp; abreviado: string }[] = [
  { padrao: /CORONEL/i, abreviado: 'CEL' },
  { padrao: /TEN[\s.-]*CEL|TENENTE[\s-]*CORONEL/i, abreviado: 'TEN CEL' },
  { padrao: /MAJOR/i, abreviado: 'MAJ' },
  { padrao: /CAPIT[AÃ]O/i, abreviado: 'CAP' },
  { padrao: /\b1[ºO.\s]*TEN(ENTE)?\b/i, abreviado: '1º TEN' },
  { padrao: /\b2[ºO.\s]*TEN(ENTE)?\b/i, abreviado: '2º TEN' },
  { padrao: /ASPIRANTE/i, abreviado: 'ASP' },
  { padrao: /SUB[\s-]*TEN(ENTE)?|SUBTENENTE|\bSTEN\b/i, abreviado: 'ST' },
  { padrao: /\b1[ºO.\s]*S(AR)?G(ENTO)?\b/i, abreviado: '1º SGT' },
  { padrao: /\b2[ºO.\s]*S(AR)?G(ENTO)?\b/i, abreviado: '2º SGT' },
  { padrao: /\b3[ºO.\s]*S(AR)?G(ENTO)?\b/i, abreviado: '3º SGT' },
  { padrao: /\bCABO\b|\bCB\b/i, abreviado: 'CB' },
  { padrao: /SOLDADO|\bSD\b/i, abreviado: 'SD' },
];

export function abreviarPosto(posto: string | undefined): string {
  if (!posto) return '';
  const bruto = posto.trim();
  if (!bruto) return '';

  const temRR = /\bRR\b/i.test(bruto);
  const semRR = bruto.replace(/\bRR\b/gi, ' ').replace(/\s+/g, ' ').trim();

  const regra = REGRAS_ABREVIACAO_POSTO.find((r) => r.padrao.test(semRR));
  const base = regra ? regra.abreviado : bruto;
  return temRR ? `${base} RR` : base;
}
