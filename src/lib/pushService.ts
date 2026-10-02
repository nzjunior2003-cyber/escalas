/**
 * Envio de push via o endpoint /api/send-push (server.ts, firebase-admin).
 * Mesmo padrão de autenticação do emailService.ts — exige um ID token do
 * Firebase Auth, senão qualquer um na internet poderia disparar push em
 * nome do sistema.
 */
import { getFirebaseAuth } from './firebase';

export interface DadosPush {
  tokens: string[];
  title: string;
  body: string;
  link?: string;
}

/** Nunca lança — falha de push não pode derrubar a ação que a originou (o alerta interno já foi gravado). Loga no console em caso de erro. */
export async function enviarPush(dados: DadosPush): Promise<void> {
  if (dados.tokens.length === 0) return;
  try {
    const idToken = await getFirebaseAuth()?.currentUser?.getIdToken();
    if (!idToken) return;

    const resposta = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(dados),
    });
    if (!resposta.ok) {
      console.error('Falha ao enviar push:', await resposta.text().catch(() => resposta.statusText));
    }
  } catch (erro) {
    console.error('Erro ao enviar push:', erro);
  }
}
