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
