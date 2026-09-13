/**
 * Geração real de PDF (download direto, sem depender do diálogo de
 * impressão do navegador) para o relatório semanal de escala. Paisagem, no
 * padrão visual institucional único: brasão CBMPA+CEDEC à esquerda no
 * cabeçalho (com o nome do CRB e da UBM por extenso), linha dos dias em
 * amarelo ouro, corpo em zebra branco/cinza claro, assinatura do escalante
 * e rodapé com o brasão e o endereço da UBM — igual pra ordinária e
 * extraordinária.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { carregarImagemPublicaComoDataUrl } from './imagem';

/** Proporção largura/altura do brasão institucional duplo (316×159px). */
const PROPORCAO_BRASAO_DUPLO = 316 / 159;
/** "Amarelo ouro" institucional usado na linha dos dias da semana. */
const COR_OURO: [number, number, number] = [212, 175, 55];

export interface FuncaoEscala {
  id: string;
  nome: string;
}

export interface LinhaRelatorioEscala {
  funcaoId: string;
  data: string; // yyyy-MM-dd
  militarNome: string;
  motivo?: string;
}

export interface DadosRelatorioEscala {
  tipo: 'ordinaria' | 'extraordinaria';
  ubmNome: string;
  /** Brasão da UBM, já como data URL — mostrado no rodapé, à esquerda. */
  ubmLogoDataUrl?: string;
  ubmEndereco?: string;
  ubmCep?: string;
  ubmBairro?: string;
  ubmCidade?: string;
  ubmEmail?: string;
  ubmTelefone?: string;
  /** Nome do CRB ao qual a UBM está vinculada, quando já cadastrado. */
  crbNome?: string;
  /** Segunda-feira da semana do relatório (yyyy-MM-dd). */
  semanaInicio: string;
  /** Funções da UBM que compõem as linhas da matriz, na ordem desejada. */
  funcoes: FuncaoEscala[];
  linhas: LinhaRelatorioEscala[];
  escalanteNome: string;
  escalanteCargo?: string;
}

function nomeArquivo(dados: DadosRelatorioEscala): string {
  const ubmSlug = dados.ubmNome.toLowerCase().replace(/[^a-z0-9À-ÿ]+/gi, '-');
  return `escala-${dados.tipo}-${ubmSlug}-${dados.semanaInicio}.pdf`;
}

export async function gerarPdfEscala(dados: DadosRelatorioEscala): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margemLateral = 40;
  const larguraUtil = larguraPagina - margemLateral * 2;
  let y = 32;

  // --- Cabeçalho: brasão institucional à esquerda; à direita, só o
  // essencial — instituição, CRB (quando houver) e a UBM por extenso ------
  const logoInstitucionalDataUrl = await carregarImagemPublicaComoDataUrl('/brasao-duplo-cbmpa-cedec.png');
  const larguraLogo = 74;
  const alturaLogo = larguraLogo / PROPORCAO_BRASAO_DUPLO;
  if (logoInstitucionalDataUrl) {
    doc.addImage(logoInstitucionalDataUrl, 'PNG', margemLateral, y, larguraLogo, alturaLogo);
  }

  const centroTextoX = margemLateral + larguraLogo + (larguraUtil - larguraLogo) / 2;
  let yTexto = y + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Corpo de Bombeiros Militar do Pará e', centroTextoX, yTexto, { align: 'center' });
  yTexto += 14;
  doc.text('Coordenadoria Estadual de Proteção e Defesa Civil', centroTextoX, yTexto, { align: 'center' });
  yTexto += 16;

  if (dados.crbNome) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(dados.crbNome, centroTextoX, yTexto, { align: 'center' });
    yTexto += 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(dados.ubmNome, centroTextoX, yTexto, { align: 'center' });
  yTexto += 15;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.setFontSize(9.5);
  const inicio = new Date(`${dados.semanaInicio}T00:00:00`);
  const fim = new Date(`${dados.semanaInicio}T00:00:00`);
  fim.setDate(fim.getDate() + 6);
  const tituloEscala = `Escala ${dados.tipo === 'ordinaria' ? 'Ordinária' : 'Extraordinária'} — Semana de ${format(inicio, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}`;
  doc.text(tituloEscala, centroTextoX, yTexto, { align: 'center' });
  doc.setTextColor(0);

  y = Math.max(y + alturaLogo, yTexto) + 10;

  doc.setDrawColor(127, 29, 29);
  doc.setLineWidth(1.2);
  doc.line(margemLateral, y, larguraPagina - margemLateral, y);
  y += 14;

  // --- Matriz: função nas linhas, dias da semana (com data) nas colunas --
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${dados.semanaInicio}T00:00:00`);
    d.setDate(d.getDate() + i);
    return format(d, 'yyyy-MM-dd');
  });

  const cabecalho = [
    'Função',
    ...dias.map((dia) => {
      const d = new Date(`${dia}T00:00:00`);
      return `${format(d, 'EEEE', { locale: ptBR }).toUpperCase()}\n${format(d, 'dd/MM')}`;
    }),
  ];

  const celula = (funcaoId: string, dia: string): string => {
    const doDia = dados.linhas.filter((l) => l.funcaoId === funcaoId && l.data === dia);
    if (doDia.length === 0) return '—';
    return doDia
      .map((l) => (dados.tipo === 'extraordinaria' && l.motivo ? `${l.militarNome} (${l.motivo})` : l.militarNome))
      .join('\n');
  };

  const corpo = dados.funcoes.map((f) => [f.nome, ...dias.map((dia) => celula(f.id, dia))]);

  autoTable(doc, {
    startY: y,
    head: [cabecalho],
    body: corpo,
    margin: { left: margemLateral, right: margemLateral },
    headStyles: { fillColor: COR_OURO, textColor: [40, 30, 0], fontStyle: 'bold', halign: 'center', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 6, valign: 'middle' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 } },
    alternateRowStyles: { fillColor: [237, 237, 237] },
    bodyStyles: { fillColor: [255, 255, 255] },
  });

  let yAtual = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;

  // --- Cidade e data de expedição -----------------------------------------
  const hoje = new Date();
  const cidadeExpedicao = dados.ubmCidade || 'Belém';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(0);
  doc.text(`${cidadeExpedicao}, ${format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, larguraPagina - margemLateral, yAtual, {
    align: 'right',
  });
  yAtual += 26;

  // --- Assinatura do escalante ---------------------------------------------
  const centroX = larguraPagina / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  const linhaAssinatura = dados.escalanteCargo ? `${dados.escalanteNome} – ${dados.escalanteCargo}` : dados.escalanteNome;
  doc.text(linhaAssinatura, centroX, yAtual, { align: 'center' });
  yAtual += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Escalante do ${dados.ubmNome}`, centroX, yAtual, { align: 'center' });

  // --- Rodapé: brasão da UBM à esquerda, endereço/contato ao lado, em
  // itálico e fonte menor ---------------------------------------------------
  const temContato = dados.ubmEndereco || dados.ubmBairro || dados.ubmCep || dados.ubmCidade || dados.ubmEmail || dados.ubmTelefone;
  const yRodape = alturaPagina - 44;
  let xRodapeTexto = margemLateral;

  if (dados.ubmLogoDataUrl) {
    const tamanhoBrasaoUbm = 34;
    doc.addImage(dados.ubmLogoDataUrl, 'PNG', margemLateral, yRodape - tamanhoBrasaoUbm / 2, tamanhoBrasaoUbm, tamanhoBrasaoUbm);
    xRodapeTexto = margemLateral + tamanhoBrasaoUbm + 8;
  }

  if (temContato) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    const linha1 = [dados.ubmNome].filter(Boolean).join(' — ');
    const linha2 = [dados.ubmEndereco, dados.ubmBairro].filter(Boolean).join(', ');
    const linha3 = [dados.ubmCep, dados.ubmCidade].filter(Boolean).join(' — ');
    const linha4 = [dados.ubmEmail, dados.ubmTelefone].filter(Boolean).join(' · ');
    const linhasRodape = [linha1, linha2, linha3, linha4].filter((l) => l.length > 0);
    let yLinha = yRodape - ((linhasRodape.length - 1) * 9) / 2;
    linhasRodape.forEach((linha) => {
      doc.text(linha, xRodapeTexto, yLinha);
      yLinha += 9;
    });
    doc.setTextColor(0);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text(
    'Documento gerado pelo Sistema de Gerenciamento de Jornada de Trabalho — CBMPA.',
    larguraPagina - margemLateral,
    alturaPagina - 18,
    { align: 'right' },
  );

  doc.save(nomeArquivo(dados));
}
