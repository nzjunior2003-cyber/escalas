/**
 * Registro de notificações push (Firebase Cloud Messaging) no navegador.
 * Sempre disparado por um clique explícito do usuário (nunca automático
 * no carregamento) — navegadores bloqueiam ou tratam com desconfiança
 * pedidos de permissão de notificação sem gesto do usuário, e é o padrão
 * mais respeitoso de qualquer forma.
 *
 * Exige `VITE_FIREBASE_VAPID_KEY` no `.env` (par de chaves Web Push,
 * gerado em Firebase Console → Configurações do projeto → Cloud
 * Messaging → Certificados push da Web) — sem ela, a função devolve
 * `null` silenciosamente e o app segue funcionando normalmente com
 * alerta interno + e-mail, só sem o push do navegador.
 */
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { firebaseConfig, getFirebaseApp } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let mensagensEmPrimeiroPlanoLigadas = false;

/** Mostra uma notificação do navegador quando o push chega com a aba já aberta e focada (o service worker só entra em ação em segundo plano). */
function ligarMensagensEmPrimeiroPlano(): void {
  if (mensagensEmPrimeiroPlanoLigadas) return;
  const app = getFirebaseApp();
  if (!app) return;
  mensagensEmPrimeiroPlanoLigadas = true;
  const messaging = getMessaging(app);
  onMessage(messaging, (payload) => {
    const dados = payload.data ?? {};
    if (Notification.permission !== 'granted') return;
    const notificacao = new Notification(dados.title || 'GESOP', { body: dados.body || '', icon: '/icons/icon-192.png' });
    notificacao.onclick = () => {
      window.focus();
      if (dados.link) window.location.href = dados.link;
    };
  });
}

/**
 * Pede permissão e devolve o token do dispositivo, ou `null` se o
 * usuário negar, o navegador não suportar, ou a VAPID key não estiver
 * configurada. Chame só a partir de um clique do usuário.
 */
export async function ativarNotificacoesPush(): Promise<string | null> {
  if (!VAPID_KEY) return null;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;
  if (!(await isSupported())) return null;

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return null;

  const app = getFirebaseApp();
  if (!app) return null;

  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? '',
    authDomain: firebaseConfig.authDomain ?? '',
    projectId: firebaseConfig.projectId ?? '',
    storageBucket: firebaseConfig.storageBucket ?? '',
    messagingSenderId: firebaseConfig.messagingSenderId ?? '',
    appId: firebaseConfig.appId ?? '',
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);

  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  ligarMensagensEmPrimeiroPlano();
  return token || null;
}

/** Estado atual da permissão — pra UI mostrar "ativar" vs "já ativado" vs "bloqueado no navegador". */
export function statusPermissaoPush(): NotificationPermission | 'indisponivel' {
  if (!('Notification' in window)) return 'indisponivel';
  return Notification.permission;
}

/** iPhone/iPad (qualquer navegador — todos usam o motor do Safari por exigência da Apple). iPadOS 13+ se disfarça de "Macintosh", daí o teste extra por multitoque. */
function estaNoIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/** O app já foi aberto a partir do ícone instalado na tela de início (modo standalone), não como aba comum do navegador. */
function estaInstaladoComoPwa(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true;
}

/**
 * No iPhone/iPad, a Apple só entrega push pra quem instalou o app na tela
 * de início (e mesmo assim, só a partir do iOS 16.4) — uma aba comum do
 * Safari nunca recebe, não importa a versão. Use isso pra avisar o usuário
 * ANTES de ele clicar em ativar e receber uma falha sem explicação.
 */
export function precisaInstalarNoIOS(): boolean {
  return estaNoIOS() && !estaInstaladoComoPwa();
}

export const pushConfigurado = Boolean(VAPID_KEY);
