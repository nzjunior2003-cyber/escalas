/**
 * Planilha pública de efetivo do CBMPA ("Militares e matrícula bm") como
 * fonte viva de busca — em vez de importar um retrato estático, o
 * Escalante digita o nome e seleciona o militar direto da planilha (que a
 * unidade mantém atualizada, inclusive após promoções). Nenhum dado pessoal
 * fica versionado no repositório: a busca é sempre feita em tempo real
 * contra a planilha pública.
 */
import Papa from 'papaparse';
import { mapLinhaMilitar, type LinhaMilitar } from './csvMilitares';

const URL_PLANILHA_EFETIVO =
  'https://docs.google.com/spreadsheets/d/1Ja9mQVJ4KWkFtjNBjuoSONnKoj2GIT7ltUYAByLetrg/gviz/tq?tqx=out:csv';

export async function buscarEfetivoDaPlanilha(): Promise<LinhaMilitar[]> {
  const resposta = await fetch(URL_PLANILHA_EFETIVO);
  if (!resposta.ok) {
    throw new Error(
      "Não foi possível acessar a planilha de efetivo. Verifique se ela continua pública ('Qualquer pessoa com o link').",
    );
  }

  const csv = await resposta.text();
  const resultado = await new Promise<Record<string, string>[]>((resolve) => {
    Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data),
    });
  });

  return resultado
    .map((linha) => mapLinhaMilitar(linha))
    .filter((linha): linha is LinhaMilitar => linha !== null);
}

/**
 * Chave canônica de uma matrícula (MF): sem espaços nem zeros à esquerda —
 * usada tanto para casar contra a planilha quanto como id do documento em
 * `matriculas/{chave}` (login por matrícula), para que "057189387" e
 * "57189387" sempre resolvam para o mesmo registro.
 *
 * Retorna '' para matrícula vazia ou só de zeros ("0000..."), em vez de um
 * valor-sentinela — a planilha tem linhas com MF em branco (ex.: alunos),
 * e um sentinela fixo faria "00000000" digitado por engano casar com
 * qualquer uma delas.
 */
export function normalizarMatricula(matricula: string): string {
  return matricula.trim().replace(/^0+/, '');
}

/**
 * Valida uma matrícula (MF) contra a planilha ao vivo — usado no fluxo de
 * primeiro acesso: só quem está no efetivo do CBMPA consegue completar o
 * cadastro. Nunca casa contra uma linha com matrícula em branco.
 */
export async function buscarMilitarPorMatricula(matricula: string): Promise<LinhaMilitar | null> {
  const alvo = normalizarMatricula(matricula);
  if (!alvo) return null;
  const linhas = await buscarEfetivoDaPlanilha();
  return linhas.find((l) => l.matricula && normalizarMatricula(l.matricula) === alvo) ?? null;
}

function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Busca por nome (sem precisar da matrícula) contra a planilha ao vivo —
 * usada na tela de solicitar acesso, quando a pessoa não sabe/não tem a
 * matrícula em mãos. Casamento por "contém" (não precisa ser o nome
 * completo exato), pode retornar mais de um resultado.
 */
export async function buscarMilitaresPorNome(nome: string): Promise<LinhaMilitar[]> {
  const alvo = normalizarNome(nome);
  if (!alvo) return [];
  const linhas = await buscarEfetivoDaPlanilha();
  return linhas.filter((l) => normalizarNome(l.nome).includes(alvo));
}
