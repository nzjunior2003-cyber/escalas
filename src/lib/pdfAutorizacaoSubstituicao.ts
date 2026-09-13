/**
 * Geração do PDF "Autorização de Serviço Extraordinário" — documento que
 * autoriza dois militares a trocar (permutar) o serviço entre si num evento
 * extraordinário específico. O documento sai com os campos de assinatura em
 * branco: a assinatura em si acontece fora do sistema (gov.br/token), e o
 * PDF assinado é o que fica arquivado como comprovante.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { carregarImagemPublicaComoDataUrl } from './imagem';

export interface DadosAutorizacaoSubstituicao {
  ubmNome: string;
  ubmSigla: string;
  /** Brasão da UBM, já como data URL — quando ausente, usa o brasão institucional do CBMPA. */
  ubmLogoDataUrl?: string;
  eventoExtraordinario: string;
  dataEvento: string; // yyyy-MM-dd
  localEvento: string;
  horario: string;
  militarSubstituidoNomeGuerra: string;
  militarSubstitutoNomeCompleto: string;
  militarSubstitutoMatricula: string;
  observacao: string;
  responsavelNome: string;
  responsavelPosto: string;
  responsavelCargo: string;
}

function nomeArquivo(dados: DadosAutorizacaoSubstituicao): string {
  return `autorizacao-servico-extraordinario-${dados.dataEvento}.pdf`;
}

export async function gerarPdfAutorizacaoSubstituicao(dados: DadosAutorizacaoSubstituicao): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const margemLateral = 40;
  const larguraUtil = larguraPagina - margemLateral * 2;
  const centroX = larguraPagina / 2;
  let y = 44;

  const logoDataUrl = dados.ubmLogoDataUrl ?? (await carregarImagemPublicaComoDataUrl('/brasao-duplo-cbmpa-cedec.png'));
  if (logoDataUrl) {
    if (dados.ubmLogoDataUrl) {
      const tamanhoLogo = 42;
      doc.addImage(logoDataUrl, 'PNG', centroX - tamanhoLogo / 2, y, tamanhoLogo, tamanhoLogo);
      y += tamanhoLogo + 8;
    } else {
      const larguraLogo = 80;
      const alturaLogo = larguraLogo / (316 / 159);
      doc.addImage(logoDataUrl, 'PNG', centroX - larguraLogo / 2, y, larguraLogo, alturaLogo);
      y += alturaLogo + 8;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('CORPO DE BOMBEIROS MILITAR DO PARÁ E', centroX, y, { align: 'center' });
  y += 13;
  doc.text('COORDENADORIA ESTADUAL DE DEFESA CIVIL', centroX, y, { align: 'center' });
  y += 15;
  doc.setFontSize(10.5);
  doc.text(dados.ubmNome.toUpperCase(), centroX, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('SEÇÃO ADMINISTRATIVA', centroX, y, { align: 'center' });
  y += 11;
  doc.text('SUBSEÇÃO DE PESSOAL', centroX, y, { align: 'center' });
  y += 16;

  doc.setDrawColor(127, 29, 29);
  doc.setLineWidth(1.2);
  doc.line(margemLateral, y, larguraPagina - margemLateral, y);
  y += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('AUTORIZAÇÃO DE SERVIÇO EXTRAORDINÁRIO', centroX, y, { align: 'center' });
  const larguraTitulo = doc.getTextWidth('AUTORIZAÇÃO DE SERVIÇO EXTRAORDINÁRIO');
  doc.setLineWidth(0.6);
  doc.line(centroX - larguraTitulo / 2, y + 3, centroX + larguraTitulo / 2, y + 3);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const intro =
    'Tem autorização deste oficial ou graduado os militares abaixo a realizarem a substituição do serviço entre si:';
  const introLinhas = doc.splitTextToSize(intro, larguraUtil);
  doc.text(introLinhas, margemLateral, y);
  y += introLinhas.length * 12 + 8;

  const dataFormatada = format(new Date(`${dados.dataEvento}T00:00:00`), "dd 'de' MMMM 'de' yyyy, EEEE", {
    locale: ptBR,
  });

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margemLateral, right: margemLateral },
    styles: { fontSize: 9, cellPadding: 6, valign: 'middle', textColor: [0, 0, 0] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 150 },
      1: { cellWidth: larguraUtil - 150 },
    },
    body: [
      ['EVENTO EXTRAORDINÁRIO', dados.eventoExtraordinario || '—'],
      ['DATA DO EVENTO', dataFormatada],
      ['LOCAL DO EVENTO', dados.localEvento || '—'],
      ['HORÁRIO', dados.horario || '—'],
      ['MILITAR SUBSTITUÍDO (SAI)\n(somente nome de guerra)', dados.militarSubstituidoNomeGuerra || '—'],
      [
        'MILITAR SUBSTITUTO (ENTRA)\n(nome completo e MF)',
        `${dados.militarSubstitutoNomeCompleto || '—'} - MF: ${dados.militarSubstitutoMatricula || '—'}`,
      ],
      ['OBSERVAÇÃO', dados.observacao || '—'],
    ],
  });

  let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  autoTable(doc, {
    startY: finalY,
    theme: 'grid',
    margin: { left: margemLateral, right: margemLateral },
    head: [[{ content: 'ASSINATURAS', colSpan: 2 }]],
    headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8.5, cellPadding: 6, valign: 'middle', textColor: [0, 0, 0], minCellHeight: 46 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 260 },
      1: { cellWidth: larguraUtil - 260 },
    },
    body: [
      ['ASSINATURA GOV.BR OU TOKEN DO\nMILITAR SUBSTITUTO (ENTRA)', ''],
      ['ASSINATURA GOV.BR OU TOKEN DO\nMILITAR SUBSTITUÍDO (SAI)', ''],
      ['ASSINATURA GOV.BR OU TOKEN DO RESPONSÁVEL\nPELA SUBSEÇÃO DE PESSOAL DA UBM', ''],
    ],
  });

  finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const linhaAssinaturaResponsavel = dados.responsavelPosto
    ? `${dados.responsavelNome || '_____________________'} – ${dados.responsavelPosto}`
    : dados.responsavelNome || '_____________________';
  doc.text(linhaAssinaturaResponsavel, centroX, finalY, { align: 'center' });
  finalY += 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(dados.responsavelCargo || `Chefe da Subseção de Pessoal do ${dados.ubmSigla}`, centroX, finalY, {
    align: 'center',
  });

  const hoje = new Date();
  doc.text(`Belém, ${format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, larguraPagina - margemLateral, finalY, {
    align: 'right',
  });

  finalY += 30;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'Documento gerado pelo Sistema de Gerenciamento de Jornada de Trabalho — CBMPA.',
    margemLateral,
    finalY,
  );

  doc.save(nomeArquivo(dados));
}
