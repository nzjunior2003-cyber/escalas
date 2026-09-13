/**
 * Geração real de PDF (download direto, sem depender do diálogo de
 * impressão do navegador) para o relatório semanal de escala — seção 9 do
 * PRD. Usa jsPDF + jspdf-autotable, no padrão visual institucional único
 * (brasão CBMPA + CEDEC à esquerda no cabeçalho, brasão da UBM à direita no
 * rodapé, matriz função × dia da semana), igual pra ordinária e
 * extraordinária.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { carregarImagemPublicaComoDataUrl } from './imagem';

/** Proporção largura/altura do brasão institucional duplo (316×159px). */
const PROPORCAO_BRASAO_DUPLO = 316 / 159;

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
  /** Brasão da UBM, já como data URL — mostrado no rodapé, à direita. */
  ubmLogoDataUrl?: string;
  /** Nome do CRB ao qual a UBM está vinculada, quando já cadastrado. */
  crbNome?: string;
  /** Segunda-feira da semana do relatório (yyyy-MM-dd). */
  semanaInicio: string;
  /** Funções da UBM que compõem as linhas da matriz, na ordem desejada. */
  funcoes: FuncaoEscala[];
  linhas: LinhaRelatorioEscala[];
}

function nomeArquivo(dados: DadosRelatorioEscala): string {
  const ubmSlug = dados.ubmNome.toLowerCase().replace(/[^a-z0-9À-ÿ]+/gi, '-');
  return `escala-${dados.tipo}-${ubmSlug}-${dados.semanaInicio}.pdf`;
}

export async function gerarPdfEscala(dados: DadosRelatorioEscala): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const margemLateral = 40;
  const larguraUtil = larguraPagina - margemLateral * 2;
  let y = 40;

  // --- Cabeçalho: brasão institucional à esquerda, textos centralizados na
  // faixa restante --------------------------------------------------------
  const logoInstitucionalDataUrl = await carregarImagemPublicaComoDataUrl('/brasao-duplo-cbmpa-cedec.png');
  const larguraLogo = 78;
  const alturaLogo = larguraLogo / PROPORCAO_BRASAO_DUPLO;
  if (logoInstitucionalDataUrl) {
    doc.addImage(logoInstitucionalDataUrl, 'PNG', margemLateral, y, larguraLogo, alturaLogo);
  }

  const centroTextoX = margemLateral + larguraLogo + (larguraUtil - larguraLogo) / 2;
  let yTexto = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CORPO DE BOMBEIROS MILITAR DO PARÁ', centroTextoX, yTexto, { align: 'center' });
  yTexto += 16;

  if (dados.crbNome) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(dados.crbNome, centroTextoX, yTexto, { align: 'center' });
    yTexto += 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(dados.ubmNome, centroTextoX, yTexto, { align: 'center' });
  yTexto += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const tituloEscala = `Escala ${dados.tipo === 'ordinaria' ? 'Ordinária' : 'Extraordinária'}`;
  doc.text(tituloEscala, centroTextoX, yTexto, { align: 'center' });
  yTexto += 13;

  const inicio = new Date(dados.semanaInicio + 'T00:00:00');
  const fim = new Date(dados.semanaInicio + 'T00:00:00');
  fim.setDate(fim.getDate() + 6);
  doc.setTextColor(120);
  doc.text(`Semana de ${format(inicio, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}`, centroTextoX, yTexto, {
    align: 'center',
  });
  doc.setTextColor(0);

  y = Math.max(y + alturaLogo, yTexto) + 10;

  doc.setDrawColor(127, 29, 29);
  doc.setLineWidth(1.2);
  doc.line(margemLateral, y, larguraPagina - margemLateral, y);
  y += 14;

  // --- Matriz: função nas linhas, dias da semana (com data) nas colunas --
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dados.semanaInicio + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return format(d, 'yyyy-MM-dd');
  });

  const cabecalho = [
    'Função',
    ...dias.map((dia) => {
      const d = new Date(dia + 'T00:00:00');
      return `${format(d, 'EEE', { locale: ptBR }).toUpperCase()}\n${format(d, 'dd/MM')}`;
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
    headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
    styles: { fontSize: 8.5, cellPadding: 5, valign: 'middle' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  // --- Rodapé: brasão da UBM à direita, texto institucional à esquerda ---
  const alturaFinal = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let yRodape = alturaFinal + 24;

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Documento gerado pelo Sistema de Gerenciamento de Jornada de Trabalho — CBMPA.', margemLateral, yRodape);
  doc.setTextColor(0);

  if (dados.ubmLogoDataUrl) {
    const tamanhoBrasaoUbm = 40;
    const yBrasaoUbm = Math.min(yRodape - 10, alturaPagina - margemLateral - tamanhoBrasaoUbm);
    doc.addImage(
      dados.ubmLogoDataUrl,
      'PNG',
      larguraPagina - margemLateral - tamanhoBrasaoUbm,
      yBrasaoUbm,
      tamanhoBrasaoUbm,
      tamanhoBrasaoUbm,
    );
  }

  doc.save(nomeArquivo(dados));
}
