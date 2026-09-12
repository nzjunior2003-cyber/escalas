/**
 * Redimensiona uma imagem (Blob/File) num canvas antes de usá-la — evita
 * embutir um arquivo de alta resolução (vários MB) num documento do
 * Firestore ou de um PDF gerado no cliente. Ver uso em `pdfEscala.ts` (logo
 * institucional) e no cadastro de UBM (brasão da unidade).
 */
export async function redimensionarImagemParaDataUrl(origem: Blob, tamanhoMax = 160): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(origem);

    const escala = Math.min(1, tamanhoMax / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext('2d');
    if (!contexto) return null;
    contexto.drawImage(bitmap, 0, 0, largura, altura);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Mesmo redimensionamento, buscando a imagem de uma URL pública (ex.: `/logo-cbmpa.png`). */
export async function carregarImagemPublicaComoDataUrl(url: string, tamanhoMax = 160): Promise<string | null> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    return redimensionarImagemParaDataUrl(await resposta.blob(), tamanhoMax);
  } catch {
    return null;
  }
}
