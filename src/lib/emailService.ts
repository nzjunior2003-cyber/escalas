/**
 * Envio de e-mail via o endpoint /api/send-email (server.ts, nodemailer).
 * O endpoint exige um ID token do Firebase Auth (ver server.ts) — sem
 * isso, qualquer um na internet poderia disparar e-mail em nome do
 * sistema, então sempre autentica a chamada com o usuário logado.
 */
import { getFirebaseAuth } from './firebase';

export interface DadosEmail {
  to: string;
  subject: string;
  html: string;
}

export async function enviarEmail(dados: DadosEmail): Promise<void> {
  const idToken = await getFirebaseAuth()?.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('Sessão expirada. Faça login novamente para enviar e-mails.');
  }

  const resposta = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => null);
    throw new Error(erro?.error || 'Não foi possível enviar o e-mail.');
  }
}
