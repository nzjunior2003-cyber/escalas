/**
 * Geração real de PDF (download direto, sem depender do diálogo de
 * impressão do navegador) para o relatório semanal de escala — seção 9 do
 * PRD. Usa jsPDF + jspdf-autotable, no padrão visual institucional
 * (brasão, título, tabela).
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { carregarImagemPublicaComoDataUrl } from './imagem';

export interface LinhaRelatorioEscala {
  data: string; // yyyy-MM-dd
  militarNome: string;
  motivo?: string;
}

export interface DadosRelatorioEscala {
  tipo: 'ordinaria' | 'extraordinaria';
  /** Nome da função (já resolvido — não é mais uma chave fixa). */
  funcaoNome: string;
  ubmNome: string;
  /** Brasão da UBM, já como data URL — quando ausente, usa o brasão institucional do CBMPA. */
  ubmLogoDataUrl?: string;
  /** Segunda-feira da semana do relatório (yyyy-MM-dd). */
  semanaInicio: string;
  linhas: LinhaRelatorioEscala[];
}

function nomeArquivo(dados: DadosRelatorioEscala): string {
  const funcaoSlug = dados.funcaoNome
    .toLowerCase()
    .replace(/[^a-z0-9À-ÿ]+/gi, '-');
  return `escala-${dados.tipo}-${funcaoSlug}-${dados.semanaInicio}.pdf`;
}

export async function gerarPdfEscala(dados: DadosRelatorioEscala): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const centroX = larguraPagina / 2;
  let y = 48;

  const logoDataUrl = dados.ubmLogoDataUrl ?? (await carregarImagemPublicaComoDataUrl('/logo-cbmpa.png'));
  if (logoDataUrl) {
    const tamanhoLogo = 48;
    doc.addImage(logoDataUrl, 'PNG', centroX - tamanhoLogo / 2, y, tamanhoLogo, tamanhoLogo);
    y += tamanhoLogo + 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CORPO DE BOMBEIROS MILITAR DO PARÁ', centroX, y, { align: 'center' });
  y += 18;

  doc.setFontSize(11);
  doc.text(dados.ubmNome, centroX, y, { align: 'center' });
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const tituloEscala = `Escala ${dados.tipo === 'ordinaria' ? 'Ordinária' : 'Extraordinária'} — ${dados.funcaoNome}`;
  doc.text(tituloEscala, centroX, y, { align: 'center' });
  y += 14;

  const inicio = new Date(dados.semanaInicio + 'T00:00:00');
  const fim = new Date(dados.semanaInicio + 'T00:00:00');
  fim.setDate(fim.getDate() + 6);
  doc.setTextColor(120);
  doc.text(
    `Semana de ${format(inicio, 'dd/MM/yyyy')} a ${format(fim, 'dd/MM/yyyy')}`,
    centroX,
    y,
    { align: 'center' },
  );
  doc.setTextColor(0);
  y += 16;

  doc.setDrawColor(127, 29, 29);
  doc.setLineWidth(1.2);
  doc.line(40, y, larguraPagina - 40, y);
  y += 12;

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dados.semanaInicio + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return format(d, 'yyyy-MM-dd');
  });

  const cabecalho =
    dados.tipo === 'extraordinaria'
      ? ['Data', 'Dia', 'Militar Escalado', 'Motivo']
      : ['Data', 'Dia', 'Militar Escalado'];

  const corpo = dias.flatMap((dia) => {
    const doDia = dados.linhas.filter((l) => l.data === dia);
    const dataFormatada = format(new Date(dia + 'T00:00:00'), 'dd/MM');
    const diaSemana = format(new Date(dia + 'T00:00:00'), 'EEEE', { locale: ptBR });

    if (doDia.length === 0) {
      return [
        dados.tipo === 'extraordinaria'
          ? [dataFormatada, diaSemana, 'Sem escala', '—']
          : [dataFormatada, diaSemana, 'Sem escala'],
      ];
    }

    return doDia.map((l) =>
      dados.tipo === 'extraordinaria'
        ? [dataFormatada, diaSemana, l.militarNome, l.motivo ?? '—']
        : [dataFormatada, diaSemana, l.militarNome],
    );
  });

  autoTable(doc, {
    startY: y,
    head: [cabecalho],
    body: corpo,
    margin: { left: 40, right: 40 },
    headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 6 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  const alturaFinal = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'Documento gerado pelo Sistema de Gerenciamento de Jornada de Trabalho — CBMPA.',
    40,
    alturaFinal + 24,
  );

  doc.save(nomeArquivo(dados));
}
