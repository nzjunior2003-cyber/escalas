/**
 * Layout esperado da planilha de efetivo (seção 3.1 do PRD): colunas
 * Nome, Posto/Graduação e Matrícula, em qualquer ordem, identificadas pelo
 * cabeçalho (aceita variações comuns de grafia/acentuação). Ajustar aqui
 * caso o layout real fornecido pela unidade seja diferente.
 */
export interface LinhaMilitar {
  nome: string;
  posto: string;
  matricula: string;
}

const ALIAS_COLUNAS: Record<keyof LinhaMilitar, string[]> = {
  nome: ['nome', 'militar', 'nome completo'],
  posto: ['posto', 'graduacao', 'graduação', 'posto/graduacao', 'posto/graduação'],
  matricula: ['matricula', 'matrícula', 'matr', 'registro'],
};

function normalizarCabecalho(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Mapeia uma linha bruta (objeto por cabeçalho da planilha) para o formato interno. */
export function mapLinhaMilitar(linha: Record<string, string>): LinhaMilitar | null {
  const porCabecalhoNormalizado = new Map<string, string>();
  for (const [chave, valor] of Object.entries(linha)) {
    porCabecalhoNormalizado.set(normalizarCabecalho(chave), (valor ?? '').toString().trim());
  }

  const obterCampo = (campo: keyof LinhaMilitar): string => {
    for (const alias of ALIAS_COLUNAS[campo]) {
      const valor = porCabecalhoNormalizado.get(normalizarCabecalho(alias));
      if (valor) return valor;
    }
    return '';
  };

  const nome = obterCampo('nome');
  const posto = obterCampo('posto');
  const matricula = obterCampo('matricula');

  if (!nome) return null;
  return { nome, posto, matricula };
}
