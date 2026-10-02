/**
 * Inicialização centralizada do Firebase (App / Auth / Firestore).
 *
 * A configuração vem exclusivamente de variáveis de ambiente `VITE_FIREBASE_*`
 * (arquivo `.env`, veja `.env.example`). Nada de chaves versionadas.
 *
 * Nada é inicializado enquanto a configuração não estiver presente: as funções
 * `get*` devolvem `null` e as `require*` lançam um erro em português com
 * instruções, para que a aplicação mostre uma mensagem clara em vez de quebrar.
 */
import {
  deleteApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  type Auth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Liga a instância local (Firebase Local Emulator Suite) em vez do projeto
 * real — útil para desenvolvimento/testes sem depender de um projeto
 * Firebase configurado. Ver `firebase emulators:start` e `.env.example`.
 */
const USAR_EMULADOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const authEmuladorConectado = new Set<string>();
const dbEmuladorConectado = new Set<string>();

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const ERRO_FIREBASE_NAO_CONFIGURADO =
  'Firebase não configurado. Defina as variáveis VITE_FIREBASE_* no arquivo .env.';

/**
 * Devolve a instância do Firebase App, criando-a sob demanda.
 * `nome` permite instâncias secundárias isoladas (ex.: criação de usuários
 * pelo módulo Usuários, sem derrubar a sessão de quem está criando).
 */
export function getFirebaseApp(nome?: string): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  const existente = getApps().find((app) => app.name === (nome ?? '[DEFAULT]'));
  if (existente) return existente;
  return nome ? initializeApp(firebaseConfig, nome) : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(nome?: string): Auth | null {
  const app = getFirebaseApp(nome);
  if (!app) return null;
  const auth = getAuth(app);
  if (USAR_EMULADOR && !authEmuladorConectado.has(app.name)) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    authEmuladorConectado.add(app.name);
  }
  return auth;
}

export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  const db = getFirestore(app);
  if (USAR_EMULADOR && !dbEmuladorConectado.has(app.name)) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    dbEmuladorConectado.add(app.name);
  }
  return db;
}

export function requireFirebaseAuth(nome?: string): Auth {
  const auth = getFirebaseAuth(nome);
  if (!auth) throw new Error(ERRO_FIREBASE_NAO_CONFIGURADO);
  return auth;
}

export function requireDb(): Firestore {
  const db = getDb();
  if (!db) throw new Error(ERRO_FIREBASE_NAO_CONFIGURADO);
  return db;
}

/**
 * Cria uma conta no Firebase Authentication usando uma instância secundária
 * e descartável, sem afetar a sessão atual. Usado pelo Escalante/Comandante
 * para cadastrar outros usuários pelo módulo Usuários.
 *
 * Retorna o UID da conta criada (usado como id do documento em `usuarios`).
 */
export async function criarContaAuthIsolada(email: string, senha: string): Promise<string> {
  if (!isFirebaseConfigured) throw new Error(ERRO_FIREBASE_NAO_CONFIGURADO);
  const nome = `admin-worker-${Date.now()}`;
  const app = initializeApp(firebaseConfig, nome);
  try {
    const auth = getAuth(app);
    if (USAR_EMULADOR) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    const credencial = await createUserWithEmailAndPassword(auth, email, senha);
    await signOut(auth);
    return credencial.user.uid;
  } finally {
    await deleteApp(app).catch(() => undefined);
  }
}

/** Traduz os códigos de erro do Firebase Auth para mensagens em português. */
export function mensagemErroAuth(erro: unknown): string {
  const codigo =
    typeof erro === 'object' && erro !== null && 'code' in erro
      ? String((erro as { code: unknown }).code)
      : '';

  switch (codigo) {
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-disabled':
      return 'Este usuário foi desativado.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este e-mail.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Falha de rede ao contatar o Firebase. Verifique sua conexão.';
    case 'auth/operation-not-allowed':
      return 'O provedor de E-mail/Senha não está habilitado no Firebase Console.';
    case 'auth/configuration-not-found':
      return 'Projeto Firebase sem Authentication configurado.';
    default:
      return erro instanceof Error && erro.message
        ? erro.message
        : 'Não foi possível concluir a operação. Tente novamente.';
  }
}
