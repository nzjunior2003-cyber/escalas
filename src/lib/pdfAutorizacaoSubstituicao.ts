/**
 * Geração do PDF "Autorização" — documento que autoriza um militar substituto
 * a cobrir o serviço de outro (via de mão única, sem obrigação de troca).
 * Formato replicado do sistema ExtraDocs (parágrafo corrido com o nome de
 * guerra em negrito, caixas de assinatura "Autorizado"/"Substituído" e
 * assinatura final de quem autoriza). O documento sai com os campos de
 * assinatura em branco: a assinatura em si acontece fora do sistema
 * (gov.br/token), e o PDF assinado é o que fica arquivado como comprovante.
 */
import { jsPDF } from 'jspdf';
import { carregarImagemPublicaComoDataUrl } from './imagem';

export interface DadosAutorizacaoSubstituicao {
  ubmNome: string;
  ubmSigla: string;
  /** Brasão da UBM, já como data URL — quando ausente, usa o brasão institucional do CBMPA. */
  ubmLogoDataUrl?: string;
  /** Aparece após "para montar serviço de". */
  servico: string;
  dataServico: string; // yyyy-MM-dd
  /** Texto livre da faixa de horário (ex.: "19h às 07h") — quando ausente, o serviço é tratado como integral (24h). */
  horarioParcial?: string;
  autorizadoPosto: string;
  autorizadoNome: string;
  autorizadoNomeGuerra: string;
  autorizadoMatricula: string;
  substituidoPosto: string;
  substituidoNome: string;
  substituidoNomeGuerra: string;
  substituidoMatricula: string;
  assinanteNome: string;
  assinanteNomeGuerra: string;
  assinantePosto: string;
  assinanteCargo: string;
}

function nomeArquivo(dados: DadosAutorizacaoSubstituicao): string {
  return `autorizacao-servico-extraordinario-${dados.dataServico}.pdf`;
}

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      if (['ii', 'iii', 'iv'].includes(word)) return word.toUpperCase();
      if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

type Segmento = { text: string; bold: boolean };

/** Monta posto + nome completo (com o nome de guerra em negrito) + MF, para o corpo do texto. */
function montarSegmentosMilitar(posto: string, nomeCompleto: string, nomeGuerra: string, matricula: string): Segmento[] {
  const segs: Segmento[] = [];
  if (posto) segs.push({ text: posto.toUpperCase(), bold: true });

  const tokensGuerra = (nomeGuerra || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean);
  const palavrasNome = (nomeCompleto || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  palavrasNome.forEach((word, idx) => {
    const limpo = word.replace(/[,.]/g, '');
    const negrito = tokensGuerra.length > 0 && tokensGuerra.includes(limpo);
    const sufixo = idx === palavrasNome.length - 1 ? ',' : '';
    segs.push({ text: word + sufixo, bold: negrito });
  });

  segs.push({ text: 'MF:', bold: true });
  segs.push({ text: `${matricula || '________'},`, bold: true });
  return segs;
}

/** Desenha um parágrafo justificado (bordas alinhadas à esquerda e à direita, exceto a última linha). Retorna o Y final. */
function desenharParagrafoJustificado(
  doc: jsPDF,
  segmentos: Segmento[],
  x: number,
  y: number,
  larguraMax: number,
  alturaLinha = 5.5,
  tamanhoFonte = 11,
): number {
  doc.setFontSize(tamanhoFonte);

  const palavras: Segmento[] = [];
  segmentos.forEach((seg) => {
    seg.text.split(' ').forEach((w) => {
      if (w.length > 0) palavras.push({ text: w, bold: seg.bold });
    });
  });

  doc.setFont('helvetica', 'normal');
  const larguraEspaco = doc.getTextWidth(' ') * 1.3;

  const linhas: Segmento[][] = [];
  let linhaAtual: Segmento[] = [];
  let larguraAtual = 0;

  palavras.forEach((palavra) => {
    doc.setFont('helvetica', palavra.bold ? 'bold' : 'normal');
    const larguraPalavra = doc.getTextWidth(palavra.text);
    const larguraProjetada = linhaAtual.length === 0 ? larguraPalavra : larguraAtual + larguraEspaco + larguraPalavra;
    if (larguraProjetada > larguraMax && linhaAtual.length > 0) {
      linhas.push(linhaAtual);
      linhaAtual = [palavra];
      larguraAtual = larguraPalavra;
    } else {
      linhaAtual.push(palavra);
      larguraAtual = larguraProjetada;
    }
  });
  if (linhaAtual.length > 0) linhas.push(linhaAtual);

  let cursorY = y;
  linhas.forEach((linha, idxLinha) => {
    const ultimaLinha = idxLinha === linhas.length - 1;

    let larguraTotalPalavras = 0;
    linha.forEach((w) => {
      doc.setFont('helvetica', w.bold ? 'bold' : 'normal');
      larguraTotalPalavras += doc.getTextWidth(w.text);
    });

    const espacamento =
      !ultimaLinha && linha.length > 1 ? (larguraMax - larguraTotalPalavras) / (linha.length - 1) : larguraEspaco;

    let cursorX = x;
    linha.forEach((w) => {
      doc.setFont('helvetica', w.bold ? 'bold' : 'normal');
      doc.text(w.text, cursorX, cursorY);
      cursorX += doc.getTextWidth(w.text) + espacamento;
    });

    cursorY += alturaLinha;
  });

  return cursorY;
}

function desenharAssinaturaComNegrito(doc: jsPDF, nome: string, nomeGuerra: string, posto: string, x: number, y: number) {
  const postoMaiusculo = posto.toUpperCase();
  const nomeTitleCase = toTitleCase(nome.trim());
  const nomeGuerraLimpo = nomeGuerra.trim().replace(/\./g, '');

  const palavrasCompletas = nomeTitleCase.split(' ');
  const tokensGuerra = nomeGuerraLimpo.toLowerCase().split(' ');

  const segmentos: Segmento[] = [];

  palavrasCompletas.forEach((word, index) => {
    if (index > 0) segmentos.push({ text: ' ', bold: false });
    const lowerWord = word.toLowerCase();
    const tokenCorrespondente = tokensGuerra.find((token) => {
      if (token === lowerWord) return true;
      if (token.length === 1 && lowerWord.startsWith(token)) return true;
      return false;
    });

    if (tokenCorrespondente) {
      if (tokenCorrespondente.length === 1 && lowerWord.length > 1) {
        segmentos.push({ text: word.charAt(0), bold: true });
        segmentos.push({ text: word.slice(1), bold: false });
      } else {
        segmentos.push({ text: word, bold: true });
      }
    } else {
      segmentos.push({ text: word, bold: false });
    }
  });

  segmentos.push({ text: ' – ', bold: false });
  segmentos.push({ text: postoMaiusculo, bold: true });

  doc.setFontSize(11);
  let larguraTotal = 0;
  segmentos.forEach((seg) => {
    doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
    larguraTotal += doc.getTextWidth(seg.text);
  });

  let cursorX = x - larguraTotal / 2;
  segmentos.forEach((seg) => {
    doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
    doc.text(seg.text, cursorX, y);
    cursorX += doc.getTextWidth(seg.text);
  });
}

const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
const DIAS_SEMANA = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

function formatarDataCompleta(dataStr: string) {
  if (!dataStr) return { dia: '____', mes: '________', ano: '____', diaSemana: '________' };
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const dataObj = new Date(ano, mes - 1, dia);
  return {
    dia: String(dia).padStart(2, '0'),
    mes: MESES[mes - 1],
    ano: String(ano),
    diaSemana: DIAS_SEMANA[dataObj.getDay()],
  };
}

function montarFraseHorario(horarioParcial: string | undefined): string {
  if (!horarioParcial) return '';
  return ` das ${horarioParcial}`;
}

export async function gerarPdfAutorizacaoSubstituicao(dados: DadosAutorizacaoSubstituicao): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const centroX = 105;
  const margemEsquerda = 20;
  let y = 15;

  const logoDataUrl = dados.ubmLogoDataUrl ?? (await carregarImagemPublicaComoDataUrl('/brasao-duplo-cbmpa-cedec.png'));
  if (logoDataUrl) {
    try {
      if (dados.ubmLogoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margemEsquerda, y - 3.5, 30, 30);
      } else {
        doc.addImage(logoDataUrl, 'PNG', margemEsquerda, y - 3.5, 30, 30 / (316 / 159));
      }
    } catch {
      // segue sem o logo se a imagem falhar ao carregar
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('CORPO DE BOMBEIROS MILITAR DO PARÁ E', centroX, y, { align: 'center' });
  y += 5;
  doc.text('COORDENADORIA ESTADUAL DE DEFESA CIVIL', centroX, y, { align: 'center' });
  y += 5;
  doc.setFontSize(10);
  doc.text(dados.ubmNome.toUpperCase(), centroX, y, { align: 'center' });
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('AUTORIZAÇÃO', centroX, y, { align: 'center' });
  y += 20;

  const dataServico = formatarDataCompleta(dados.dataServico);
  const fraseHorario = montarFraseHorario(dados.horarioParcial);
  const servicoTexto = (dados.servico || '________').trim();

  const segmentosCorpo: Segmento[] = [
    { text: 'Tem autorização deste oficial o', bold: false },
    ...montarSegmentosMilitar(dados.autorizadoPosto, dados.autorizadoNome, dados.autorizadoNomeGuerra, dados.autorizadoMatricula),
    {
      text: `para montar serviço de ${servicoTexto}, no dia ${dataServico.dia} de ${dataServico.mes} de ${dataServico.ano} ( ${dataServico.diaSemana} )${fraseHorario}, em substituição ao`,
      bold: false,
    },
    ...montarSegmentosMilitar(dados.substituidoPosto, dados.substituidoNome, dados.substituidoNomeGuerra, dados.substituidoMatricula),
    { text: 'sem prejuízo na escala de serviço.', bold: false },
  ];

  const yFimCorpo = desenharParagrafoJustificado(doc, segmentosCorpo, margemEsquerda, y, 170, 5.5, 11);

  const yCaixas = yFimCorpo + 15;
  const alturaCaixa = 18;
  const larguraCaixa = 75;
  const espacoCaixas = 20;
  const xCaixaEsquerda = margemEsquerda;
  const xCaixaDireita = xCaixaEsquerda + larguraCaixa + espacoCaixas;

  doc.setDrawColor(0);
  doc.rect(xCaixaEsquerda, yCaixas, larguraCaixa, alturaCaixa);
  doc.rect(xCaixaDireita, yCaixas, larguraCaixa, alturaCaixa);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Autorizado', xCaixaEsquerda + larguraCaixa / 2, yCaixas + alturaCaixa + 5, { align: 'center' });
  doc.text('Substituído', xCaixaDireita + larguraCaixa / 2, yCaixas + alturaCaixa + 5, { align: 'center' });

  const yAposCaixas = yCaixas + alturaCaixa + 5;

  const hoje = new Date();
  const dataHojeStr = `${hoje.getDate()} DE ${MESES[hoje.getMonth()]} DE ${hoje.getFullYear()}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Belém-PA, ${dataHojeStr}.`, 190, yAposCaixas + 15, { align: 'right' });

  const ySig = yAposCaixas + 55;
  desenharAssinaturaComNegrito(doc, dados.assinanteNome, dados.assinanteNomeGuerra, dados.assinantePosto, centroX, ySig);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(dados.assinanteCargo || '', centroX, ySig + 5, { align: 'center' });

  doc.save(nomeArquivo(dados));
}
