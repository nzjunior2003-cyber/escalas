/**
 * Service worker do Firebase Cloud Messaging — recebe push em segundo
 * plano (app fechado ou aba não focada). Registrado separadamente do
 * service worker do PWA (gerado pelo vite-plugin-pwa em /sw.js); os dois
 * coexistem sem conflito, cada um cuidando de um evento diferente.
 *
 * A config do Firebase não pode vir de `import.meta.env` aqui (é um
 * arquivo estático em /public, fora do bundle do Vite) — por isso é
 * passada via query string na URL de registro (ver
 * src/lib/pushNotifications.ts), um padrão documentado do próprio
 * Firebase para esse caso. Os valores (apiKey etc.) não são segredo: são
 * a config pública do app web, protegida pelas Security Rules, não por
 * sigilo.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const dados = payload.data || {};
  self.registration.showNotification(dados.title || 'GESOP', {
    body: dados.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link: dados.link || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate(link);
          return janela.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
