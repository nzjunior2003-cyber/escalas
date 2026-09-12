import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  criarContaAuthIsolada,
  getDb,
  getFirebaseAuth,
  isFirebaseConfigured,
  mensagemErroAuth,
  requireDb,
  requireFirebaseAuth,
} from '../lib/firebase';
import { enviarEmail } from '../lib/emailService';
import { gerarEscalaOrdinaria, sugerirMilitarExtraordinario } from '../lib/escala';
import { buscarMilitarPorMatricula, normalizarMatricula } from '../lib/planilhaEfetivo';
import type { LinhaMilitar } from '../lib/csvMilitares';
import {
  Afastamento,
  Alerta,
  EscalaDiferenciada,
  EscalaExtraordinaria,
  EscalaOrdinaria,
  FuncaoOperacional,
  Militar,
  RegistroPresenca,
  SolicitacaoAlteracaoDiferenciada,
  SolicitacaoServico,
  StatusSolicitacaoServico,
  TipoEscalaServico,
  TipoSolicitacaoServico,
  Ubm,
  Usuario,
} from '../types';

interface AppContextData {
  ubms: Ubm[];
  usuarios: Usuario[];
  militares: Militar[];
  escalasOrdinarias: EscalaOrdinaria[];
  escalasExtraordinarias: EscalaExtraordinaria[];
  escalasDiferenciadas: EscalaDiferenciada[];
  solicitacoesAlteracaoDiferenciada: SolicitacaoAlteracaoDiferenciada[];
  afastamentos: Afastamento[];
  presencas: RegistroPresenca[];
  solicitacoesServico: SolicitacaoServico[];
  alertas: Alerta[];

  usuarioAtual: Usuario | null;
  isAuthenticated: boolean;
  carregandoAuth: boolean;
  firebaseConfigurado: boolean;

  /** `identificador` aceita e-mail ou matrícula (resolvida via coleção `matriculas`). */
  login: (identificador: string, senha?: string) => Promise<void>;
  logout: () => Promise<void>;
  solicitarAcesso: (dados: { nome: string; email: string; senha: string; ubmId: string; cargo?: string }) => Promise<void>;
  enviarResetSenha: (email: string) => Promise<void>;
  /** Confere a matrícula contra a planilha ao vivo do efetivo do CBMPA. */
  validarMatriculaEfetivo: (matricula: string) => Promise<LinhaMilitar | null>;
  /** Completa o primeiro acesso de um militar já validado pela matrícula. */
  primeiroAcessoPorMatricula: (dados: {
    matricula: string;
    nomeCompleto: string;
    cargo?: string;
    nomeGuerra: string;
    email: string;
    senha: string;
    ubmId: string;
  }) => Promise<void>;

  addUbm: (dados: Omit<Ubm, 'id'>) => Promise<string>;
  updateUbm: (id: string, dados: Partial<Ubm>) => Promise<void>;

  updateUsuario: (id: string, dados: Partial<Usuario>) => Promise<void>;
  addUsuario: (dados: Omit<Usuario, 'id' | 'criado_em'> & { senha: string }) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;

  addMilitar: (dados: Omit<Militar, 'id' | 'historicoUbm' | 'criado_em' | 'atualizado_em'>) => Promise<string>;
  importarMilitaresCsv: (ubmId: string, linhas: LinhaMilitar[]) => Promise<{ criados: number; ignorados: number }>;
  updateMilitar: (id: string, dados: Partial<Militar>) => Promise<void>;
  transferirMilitarDeUbm: (militarId: string, novaUbmId: string) => Promise<void>;
  deleteMilitar: (id: string) => Promise<void>;

  gerarEPersistirEscalaOrdinaria: (params: { ubmId: string; funcao: FuncaoOperacional; dataInicio: string; dataFim: string }) => Promise<number>;
  updateEscalaOrdinaria: (id: string, militarId: string) => Promise<void>;
  deleteEscalaOrdinaria: (id: string) => Promise<void>;

  criarEscalaExtraordinaria: (dados: { ubmId: string; funcao: FuncaoOperacional; data: string; motivo: string; militarIdEscolhido?: string }) => Promise<string>;
  alterarMilitarExtraordinaria: (id: string, militarId: string) => Promise<void>;

  solicitarEscalaDiferenciada: (dados: { militarId: string; ubmId: string; data: string; observacao?: string }) => Promise<void>;
  removerEscalaDiferenciada: (id: string) => Promise<void>;
  solicitarAlteracaoDiferenciada: (dados: { escalaDiferenciadaId: string; motivo: string }) => Promise<void>;
  responderAlteracaoDiferenciada: (id: string, aprovar: boolean) => Promise<void>;

  addAfastamento: (dados: Omit<Afastamento, 'id' | 'criado_em' | 'criadoPorId'>) => Promise<void>;
  deleteAfastamento: (id: string) => Promise<void>;

  registrarPresenca: (dados: Omit<RegistroPresenca, 'id' | 'criado_em' | 'registradoPorId'>) => Promise<void>;

  criarSolicitacaoServico: (dados: { ubmId: string; tipo: TipoSolicitacaoServico; escalaOrigemId: string; tipoEscalaOrigem: TipoEscalaServico; escalaDestinoId?: string; indicadoId: string; motivo?: string }) => Promise<void>;
  responderSolicitacaoIndicado: (id: string, aceitar: boolean) => Promise<void>;
  responderSolicitacaoEscalante: (id: string, aprovar: boolean) => Promise<void>;

  marcarAlertaLida: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextData>({} as AppContextData);

/**
 * O Firestore rejeita `undefined` como valor de campo (`setDoc`/`addDoc`
 * lançam "Unsupported field value: undefined"). Campos opcionais do domínio
 * (ex.: `militarId` quando o usuário desvincula o efetivo) chegam aqui como
 * `undefined` — para `create`, basta omitir a chave; para `update`, é
 * preciso `deleteField()` para de fato remover o campo do documento
 * existente, e não deixar o valor antigo intacto.
 */
function semIndefinidosParaCriar<T extends object>(dados: T): Partial<T> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function semIndefinidosParaAtualizar<T extends object>(dados: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, v === undefined ? deleteField() : v]));
}

/**
 * `filtro` aplica um `where(campo, '==', valor)` na query — necessário
 * sempre que as firestore.rules da coleção exigem uma condição de leitura
 * baseada em documento (ex.: `usuarioId == request.auth.uid`): sem o filtro
 * correspondente na própria query, o Firestore recusa a leitura da coleção
 * inteira por não conseguir provar a regra para todo documento possível.
 */
function useColecao<T extends { id: string }>(
  nome: string,
  ativo: boolean,
  filtro?: { campo: string; valor: string },
): T[] {
  const [dados, setDados] = useState<T[]>([]);
  const filtroCampo = filtro?.campo;
  const filtroValor = filtro?.valor;

  useEffect(() => {
    const db = getDb();
    if (!ativo || !db || (filtroCampo && !filtroValor)) {
      setDados([]);
      return;
    }

    const referencia =
      filtroCampo && filtroValor ? query(collection(db, nome), where(filtroCampo, '==', filtroValor)) : collection(db, nome);

    const cancelar = onSnapshot(
      referencia,
      (snapshot) => {
        setDados(
          snapshot.docs.map((documento) => ({
            ...(documento.data() as object),
            id: documento.id,
          })) as T[],
        );
      },
      (erro) => {
        console.error(`Erro ao carregar a coleção "${nome}":`, erro);
      },
    );

    return () => cancelar();
  }, [nome, ativo, filtroCampo, filtroValor]);

  return dados;
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(isFirebaseConfigured);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setCarregandoAuth(false);
      return;
    }
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setPerfil(null);
        setCarregandoAuth(false);
      }
    });
  }, []);

  useEffect(() => {
    const db = getDb();
    if (!authUser || !db) {
      setPerfil(null);
      return;
    }
    setCarregandoAuth(true);
    const cancelar = onSnapshot(
      doc(db, 'usuarios', authUser.uid),
      (snapshot) => {
        setPerfil(
          snapshot.exists() ? ({ ...(snapshot.data() as object), id: snapshot.id } as Usuario) : null,
        );
        setCarregandoAuth(false);
      },
      (erro) => {
        console.error('Erro ao carregar o perfil do usuário:', erro);
        setPerfil(null);
        setCarregandoAuth(false);
      },
    );
    return () => cancelar();
  }, [authUser]);

  const usuarioAtual = perfil && perfil.ativo ? perfil : null;
  const isAuthenticated = !!usuarioAtual;

  // Lida mesmo sem login: a tela de "Solicitar Acesso" precisa listar as
  // UBMs para quem ainda não tem conta (ver firestore.rules).
  const ubms = useColecao<Ubm>('ubms', isFirebaseConfigured);
  const usuarios = useColecao<Usuario>('usuarios', isAuthenticated);
  const militares = useColecao<Militar>('militares', isAuthenticated);
  const escalasOrdinarias = useColecao<EscalaOrdinaria>('escalas_ordinarias', isAuthenticated);
  const escalasExtraordinarias = useColecao<EscalaExtraordinaria>('escalas_extraordinarias', isAuthenticated);
  const escalasDiferenciadas = useColecao<EscalaDiferenciada>('escalas_diferenciadas', isAuthenticated);
  const solicitacoesAlteracaoDiferenciada = useColecao<SolicitacaoAlteracaoDiferenciada>(
    'solicitacoes_alteracao_diferenciada',
    isAuthenticated,
  );
  const afastamentos = useColecao<Afastamento>('afastamentos', isAuthenticated);
  const presencas = useColecao<RegistroPresenca>('presencas', isAuthenticated);
  const solicitacoesServico = useColecao<SolicitacaoServico>('solicitacoes_servico', isAuthenticated);
  const alertas = useColecao<Alerta>('alertas', isAuthenticated, {
    campo: 'usuarioId',
    valor: usuarioAtual?.id ?? '',
  });

  // --- Autenticação ---------------------------------------------------------
  const registrarLogAcesso = useCallback(async (userId: string | null, email: string, sucesso: boolean) => {
    try {
      const db = getDb();
      if (!db) return;
      await addDoc(collection(db, 'logs_acesso'), {
        userId,
        email,
        sucesso,
        dataHora: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
    } catch (erro) {
      console.error('Erro ao registrar log de acesso:', erro);
    }
  }, []);

  const login = useCallback(
    async (identificador: string, senha?: string) => {
      let userIdParaLog: string | null = null;
      let email = identificador;
      try {
        const auth = requireFirebaseAuth();
        const db = requireDb();

        if (!identificador.includes('@')) {
          const chave = normalizarMatricula(identificador);
          const matriculaSnap = chave ? await getDoc(doc(db, 'matriculas', chave)) : null;
          if (!matriculaSnap?.exists()) {
            throw new Error('Matrícula não encontrada. Verifique o número ou use seu e-mail para entrar.');
          }
          email = (matriculaSnap.data() as { email: string }).email;
        }

        const credencial = await signInWithEmailAndPassword(auth, email, senha ?? '');
        userIdParaLog = credencial.user.uid;
        const perfilSnap = await getDoc(doc(db, 'usuarios', credencial.user.uid));

        if (!perfilSnap.exists()) {
          await signOut(auth);
          throw new Error('Perfil de usuário não encontrado no sistema. Solicite acesso ao escalante/comandante.');
        }
        const perfilCarregado = { ...(perfilSnap.data() as object), id: perfilSnap.id } as Usuario;
        if (!perfilCarregado.ativo) {
          await signOut(auth);
          throw new Error('Seu usuário ainda não foi aprovado.');
        }

        setPerfil(perfilCarregado);
        await registrarLogAcesso(userIdParaLog, email, true);
      } catch (erro) {
        await registrarLogAcesso(userIdParaLog, email, false);
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [registrarLogAcesso],
  );

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setPerfil(null);
    setAuthUser(null);
  }, []);

  const notificar = useCallback(
    async (usuarioId: string, tipo: Alerta['tipo'], mensagem: string, link?: string) => {
      try {
        const db = getDb();
        if (!db) return;
        await addDoc(collection(db, 'alertas'), {
          usuarioId,
          tipo,
          mensagem,
          link: link ?? null,
          lida: false,
          criado_em: new Date().toISOString(),
        });
      } catch (erro) {
        console.error('Erro ao criar alerta:', erro);
      }
    },
    [],
  );

  /** Notifica por e-mail o(s) Comandante/Escalante de uma UBM sobre uma nova solicitação de acesso. */
  const notificarAprovadoresDaUbm = useCallback(
    async (ubmId: string, nome: string, email: string, cargo?: string) => {
      try {
        const db = requireDb();
        const aprovadoresSnap = await getDocs(
          query(collection(db, 'usuarios'), where('ubmId', '==', ubmId)),
        );
        const aprovadores = aprovadoresSnap.docs
          .map((d) => ({ ...(d.data() as object), id: d.id }) as Usuario)
          .filter((u) => u.papeis?.includes('comandante') || u.papeis?.includes('escalante'));

        await Promise.all(
          aprovadores.map((destinatario) =>
            enviarEmail({
              to: destinatario.email,
              subject: `Nova solicitação de acesso — ${nome}`,
              html: `<h2>Nova Solicitação de Acesso</h2><p><b>${nome}</b>${cargo ? ` (${cargo})` : ''} solicitou acesso ao Sistema de Jornada de Trabalho com o e-mail <b>${email}</b>.</p><p>Acesse o módulo <b>Usuários</b> para revisar e ativar o acesso.</p>`,
            }).catch((erroEnvio) => console.error('Erro ao notificar aprovador:', erroEnvio)),
          ),
        );
      } catch (erroNotificacao) {
        console.error('Erro ao buscar aprovadores para notificar solicitação de acesso:', erroNotificacao);
      }
    },
    [],
  );

  const solicitarAcesso = useCallback(
    async ({ nome, email, senha, ubmId, cargo }: { nome: string; email: string; senha: string; ubmId: string; cargo?: string }) => {
      try {
        const auth = requireFirebaseAuth();
        const db = requireDb();
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);

        await setDoc(doc(db, 'usuarios', credencial.user.uid), {
          nome,
          email,
          cargo: cargo ?? '',
          ubmId,
          papeis: ['militar'],
          ativo: false,
          criado_em: new Date().toISOString(),
        });

        await notificarAprovadoresDaUbm(ubmId, nome, email, cargo);
        await signOut(auth);
      } catch (erro) {
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [notificarAprovadoresDaUbm],
  );

  const validarMatriculaEfetivo = useCallback(async (matricula: string) => {
    return buscarMilitarPorMatricula(matricula);
  }, []);

  /**
   * Primeiro acesso por matrícula: a matrícula já foi validada contra a
   * planilha ao vivo (ver `validarMatriculaEfetivo`) antes de chegar aqui.
   * Cria a conta e o perfil (sempre inativo, papel 'militar' — igual ao
   * autocadastro por UBM) e registra `matriculas/{matricula}` para permitir
   * login por matrícula depois. Nunca envia a senha por e-mail: a pessoa
   * acabou de digitá-la e confirmá-la duas vezes, só confirma o cadastro.
   */
  const primeiroAcessoPorMatricula = useCallback(
    async ({
      matricula,
      nomeCompleto,
      cargo,
      nomeGuerra,
      email,
      senha,
      ubmId,
    }: {
      matricula: string;
      nomeCompleto: string;
      cargo?: string;
      nomeGuerra: string;
      email: string;
      senha: string;
      ubmId: string;
    }) => {
      try {
        const auth = requireFirebaseAuth();
        const db = requireDb();
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);

        await setDoc(
          doc(db, 'usuarios', credencial.user.uid),
          semIndefinidosParaCriar({
            nome: nomeCompleto,
            nomeGuerra,
            matricula,
            cargo,
            email,
            ubmId,
            papeis: ['militar'],
            ativo: false,
            criado_em: new Date().toISOString(),
          }),
        );

        try {
          await setDoc(doc(db, 'matriculas', normalizarMatricula(matricula)), { email });
        } catch (erroMatricula) {
          // Não impede o cadastro — sem isso, a pessoa ainda consegue entrar pelo e-mail.
          console.error('Erro ao registrar matrícula para login:', erroMatricula);
        }

        try {
          await enviarEmail({
            to: email,
            subject: 'Cadastro recebido — Sistema de Jornada de Trabalho',
            html: `<h2>Cadastro recebido</h2><p>Olá, ${nomeGuerra}. Seu cadastro (matrícula ${matricula}) foi recebido e está aguardando aprovação do Comandante/Escalante da sua UBM. Você será avisado quando puder acessar o sistema.</p>`,
          });
        } catch (erroEnvio) {
          console.error('Erro ao enviar e-mail de confirmação de cadastro:', erroEnvio);
        }

        await notificarAprovadoresDaUbm(ubmId, nomeCompleto, email, cargo);
        await signOut(auth);
      } catch (erro) {
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [notificarAprovadoresDaUbm],
  );

  const enviarResetSenha = useCallback(async (email: string) => {
    try {
      const auth = requireFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
    } catch (erro) {
      throw new Error(mensagemErroAuth(erro));
    }
  }, []);

  // --- UBMs -------------------------------------------------------------
  const addUbm = useCallback(async (dados: Omit<Ubm, 'id'>) => {
    const db = requireDb();
    const ref = await addDoc(collection(db, 'ubms'), semIndefinidosParaCriar(dados));
    return ref.id;
  }, []);

  const updateUbm = useCallback(async (id: string, dados: Partial<Ubm>) => {
    const db = requireDb();
    await updateDoc(doc(db, 'ubms', id), semIndefinidosParaAtualizar(dados));
  }, []);

  // --- Usuários (aprovação de cadastro, perfis) -----------------------------
  const updateUsuario = useCallback(async (id: string, dados: Partial<Usuario>) => {
    const db = requireDb();
    const campos: Record<string, unknown> = { ...dados };
    delete campos.id;
    delete (campos as { senha?: unknown }).senha;
    await updateDoc(doc(db, 'usuarios', id), semIndefinidosParaAtualizar(campos));
  }, []);

  /**
   * Cria a conta no Firebase Auth (instância isolada, para não derrubar a
   * sessão de quem está cadastrando) e o documento de perfil correspondente.
   * A senha nunca é gravada no Firestore.
   */
  const addUsuario = useCallback(
    async (dados: Omit<Usuario, 'id' | 'criado_em'> & { senha: string }) => {
      try {
        const db = requireDb();
        const { senha, ...perfilNovo } = dados;
        const uid = await criarContaAuthIsolada(perfilNovo.email, senha);
        await setDoc(doc(db, 'usuarios', uid), semIndefinidosParaCriar({ ...perfilNovo, criado_em: new Date().toISOString() }));
      } catch (erro) {
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [],
  );

  const deleteUsuario = useCallback(
    async (id: string) => {
      const db = requireDb();
      await deleteDoc(doc(db, 'usuarios', id));
      if (usuarioAtual?.id === id) await logout();
    },
    [usuarioAtual, logout],
  );

  // --- Efetivo / Militares -------------------------------------------------
  const addMilitar = useCallback(
    async (dados: Omit<Militar, 'id' | 'historicoUbm' | 'criado_em' | 'atualizado_em'>) => {
      const db = requireDb();
      const agora = new Date().toISOString();
      const ref = await addDoc(collection(db, 'militares'), {
        ...dados,
        historicoUbm: [{ ubmId: dados.ubmId, dataInicio: agora, dataFim: null }],
        criado_em: agora,
        atualizado_em: agora,
      });
      return ref.id;
    },
    [],
  );

  const importarMilitaresCsv = useCallback(
    async (ubmId: string, linhas: LinhaMilitar[]) => {
      const db = requireDb();
      const agora = new Date().toISOString();
      let criados = 0;
      let ignorados = 0;

      for (let inicio = 0; inicio < linhas.length; inicio += 400) {
        const lote = writeBatch(db);
        linhas.slice(inicio, inicio + 400).forEach((linha) => {
          if (!linha.nome) {
            ignorados++;
            return;
          }
          const ref = doc(collection(db, 'militares'));
          lote.set(ref, {
            nome: linha.nome,
            posto: linha.posto ?? '',
            matricula: linha.matricula ?? '',
            ubmId,
            historicoUbm: [{ ubmId, dataInicio: agora, dataFim: null }],
            funcoes: [],
            ativo: true,
            origemCadastro: 'planilha',
            criado_em: agora,
            atualizado_em: agora,
          });
          criados++;
        });
        await lote.commit();
      }

      return { criados, ignorados };
    },
    [],
  );

  const updateMilitar = useCallback(async (id: string, dados: Partial<Militar>) => {
    const db = requireDb();
    await updateDoc(doc(db, 'militares', id), { ...dados, atualizado_em: new Date().toISOString() });
  }, []);

  const transferirMilitarDeUbm = useCallback(
    async (militarId: string, novaUbmId: string) => {
      const db = requireDb();
      const militar = militares.find((m) => m.id === militarId);
      if (!militar) throw new Error('Militar não encontrado.');
      const agora = new Date().toISOString();
      const historicoAtualizado = militar.historicoUbm.map((v) =>
        v.dataFim === null ? { ...v, dataFim: agora } : v,
      );
      historicoAtualizado.push({ ubmId: novaUbmId, dataInicio: agora, dataFim: null });
      await updateDoc(doc(db, 'militares', militarId), {
        ubmId: novaUbmId,
        historicoUbm: historicoAtualizado,
        atualizado_em: agora,
      });
    },
    [militares],
  );

  const deleteMilitar = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'militares', id));
  }, []);

  // --- Escala ordinária ------------------------------------------------
  const gerarEPersistirEscalaOrdinaria = useCallback(
    async (params: { ubmId: string; funcao: FuncaoOperacional; dataInicio: string; dataFim: string }) => {
      const db = requireDb();
      const geradas = gerarEscalaOrdinaria({ ...params, militares, afastamentos });
      const agora = new Date().toISOString();

      for (let inicio = 0; inicio < geradas.length; inicio += 400) {
        const lote = writeBatch(db);
        geradas.slice(inicio, inicio + 400).forEach((item) => {
          const ref = doc(collection(db, 'escalas_ordinarias'));
          lote.set(ref, { ...item, criado_em: agora });
        });
        await lote.commit();
      }

      return geradas.length;
    },
    [militares, afastamentos],
  );

  const updateEscalaOrdinaria = useCallback(async (id: string, militarId: string) => {
    const db = requireDb();
    await updateDoc(doc(db, 'escalas_ordinarias', id), { militarId, origem: 'manual' });
  }, []);

  const deleteEscalaOrdinaria = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'escalas_ordinarias', id));
  }, []);

  // --- Escala extraordinária ---------------------------------------------
  const criarEscalaExtraordinaria = useCallback(
    async (dados: { ubmId: string; funcao: FuncaoOperacional; data: string; motivo: string; militarIdEscolhido?: string }) => {
      const db = requireDb();
      const sugerido = sugerirMilitarExtraordinario({
        ubmId: dados.ubmId,
        funcao: dados.funcao,
        data: dados.data,
        militares,
        afastamentos,
        extraordinariasAnteriores: escalasExtraordinarias,
      });
      if (!sugerido) throw new Error('Nenhum militar disponível nessa função para sugerir.');

      const ref = await addDoc(collection(db, 'escalas_extraordinarias'), {
        ubmId: dados.ubmId,
        funcao: dados.funcao,
        data: dados.data,
        motivo: dados.motivo,
        militarSugeridoId: sugerido.id,
        militarId: dados.militarIdEscolhido ?? sugerido.id,
        criadoPorId: usuarioAtual?.id ?? '',
        criado_em: new Date().toISOString(),
      });
      return ref.id;
    },
    [militares, afastamentos, escalasExtraordinarias, usuarioAtual],
  );

  const alterarMilitarExtraordinaria = useCallback(async (id: string, militarId: string) => {
    const db = requireDb();
    // O militarSugeridoId nunca é sobrescrito — a estatística de rodízio
    // continua contando como se a sugestão tivesse sido seguida.
    await updateDoc(doc(db, 'escalas_extraordinarias', id), { militarId });
  }, []);

  // --- Escala diferenciada -------------------------------------------------
  const solicitarEscalaDiferenciada = useCallback(
    async (dados: { militarId: string; ubmId: string; data: string; observacao?: string }) => {
      const db = requireDb();
      await addDoc(collection(db, 'escalas_diferenciadas'), {
        ...dados,
        criado_em: new Date().toISOString(),
      });
    },
    [],
  );

  const removerEscalaDiferenciada = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'escalas_diferenciadas', id));
  }, []);

  const solicitarAlteracaoDiferenciada = useCallback(
    async (dados: { escalaDiferenciadaId: string; motivo: string }) => {
      const db = requireDb();
      const escala = escalasDiferenciadas.find((e) => e.id === dados.escalaDiferenciadaId);
      if (!escala) throw new Error('Escala diferenciada não encontrada.');

      await addDoc(collection(db, 'solicitacoes_alteracao_diferenciada'), {
        escalaDiferenciadaId: dados.escalaDiferenciadaId,
        militarId: escala.militarId,
        ubmId: escala.ubmId,
        solicitanteId: usuarioAtual?.id ?? '',
        motivo: dados.motivo,
        status: 'pendente',
        criado_em: new Date().toISOString(),
      });

      const militar = militares.find((m) => m.id === escala.militarId);
      const usuarioMilitar = usuarios.find((u) => u.militarId === escala.militarId);
      const comandantes = usuarios.filter((u) => u.ubmId === escala.ubmId && u.papeis?.includes('comandante'));

      if (usuarioMilitar) {
        await notificar(
          usuarioMilitar.id,
          'alteracao_diferenciada',
          `O escalante solicitou alterar sua escala diferenciada de ${escala.data}. Motivo: ${dados.motivo}`,
        );
      }
      await Promise.all(
        comandantes.map((c) =>
          notificar(
            c.id,
            'alteracao_diferenciada',
            `Alteração de escala diferenciada de ${militar?.nome ?? 'um militar'} em ${escala.data} aguarda sua autorização.`,
          ),
        ),
      );
    },
    [escalasDiferenciadas, militares, usuarios, usuarioAtual, notificar],
  );

  const responderAlteracaoDiferenciada = useCallback(
    async (id: string, aprovar: boolean) => {
      const db = requireDb();
      const solicitacao = solicitacoesAlteracaoDiferenciada.find((s) => s.id === id);
      if (!solicitacao) throw new Error('Solicitação não encontrada.');

      await updateDoc(doc(db, 'solicitacoes_alteracao_diferenciada', id), {
        status: aprovar ? 'aprovada' : 'recusada',
        resolvido_em: new Date().toISOString(),
        resolvidoPorId: usuarioAtual?.id ?? '',
      });

      if (aprovar) {
        await deleteDoc(doc(db, 'escalas_diferenciadas', solicitacao.escalaDiferenciadaId));
      }

      const usuarioMilitar = usuarios.find((u) => u.militarId === solicitacao.militarId);
      if (usuarioMilitar) {
        await notificar(
          usuarioMilitar.id,
          'alteracao_diferenciada',
          aprovar
            ? 'O Comandante autorizou a alteração da sua escala diferenciada.'
            : 'O Comandante negou a alteração da sua escala diferenciada — ela permanece como estava.',
        );
      }
    },
    [solicitacoesAlteracaoDiferenciada, usuarios, usuarioAtual, notificar],
  );

  // --- Afastamentos ---------------------------------------------------------
  const addAfastamento = useCallback(
    async (dados: Omit<Afastamento, 'id' | 'criado_em' | 'criadoPorId'>) => {
      const db = requireDb();
      await addDoc(collection(db, 'afastamentos'), {
        ...dados,
        criadoPorId: usuarioAtual?.id ?? '',
        criado_em: new Date().toISOString(),
      });
    },
    [usuarioAtual],
  );

  const deleteAfastamento = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'afastamentos', id));
  }, []);

  // --- Presença (CMT de SOS) -----------------------------------------------
  const registrarPresenca = useCallback(
    async (dados: Omit<RegistroPresenca, 'id' | 'criado_em' | 'registradoPorId'>) => {
      const db = requireDb();
      const existente = presencas.find(
        (p) => p.escalaId === dados.escalaId && p.militarId === dados.militarId,
      );
      if (existente) {
        await updateDoc(doc(db, 'presencas', existente.id), {
          status: dados.status,
          observacao: dados.observacao ?? '',
        });
        return;
      }
      await addDoc(collection(db, 'presencas'), {
        ...dados,
        registradoPorId: usuarioAtual?.id ?? '',
        criado_em: new Date().toISOString(),
      });
    },
    [presencas, usuarioAtual],
  );

  // --- Solicitações de serviço (substituição / permuta) --------------------
  const criarSolicitacaoServico = useCallback(
    async (dados: {
      ubmId: string;
      tipo: TipoSolicitacaoServico;
      escalaOrigemId: string;
      tipoEscalaOrigem: TipoEscalaServico;
      escalaDestinoId?: string;
      indicadoId: string;
      motivo?: string;
    }) => {
      const db = requireDb();
      const ref = await addDoc(collection(db, 'solicitacoes_servico'), {
        ...dados,
        solicitanteId: usuarioAtual?.id ?? '',
        status: 'aguardando_indicado' as StatusSolicitacaoServico,
        criado_em: new Date().toISOString(),
      });

      const indicado = usuarios.find((u) => u.id === dados.indicadoId);
      if (indicado) {
        await notificar(
          indicado.id,
          'solicitacao_servico',
          `Você recebeu um pedido de ${dados.tipo === 'permuta' ? 'permuta' : 'substituição'} de escala.`,
          `/sistema/solicitacoes/${ref.id}`,
        );
      }
    },
    [usuarioAtual, usuarios, notificar],
  );

  const responderSolicitacaoIndicado = useCallback(
    async (id: string, aceitar: boolean) => {
      const db = requireDb();
      const solicitacao = solicitacoesServico.find((s) => s.id === id);
      if (!solicitacao) throw new Error('Solicitação não encontrada.');

      await updateDoc(doc(db, 'solicitacoes_servico', id), {
        status: aceitar ? 'aguardando_escalante' : 'recusada_indicado',
        respondido_em: new Date().toISOString(),
      });

      const escalantes = usuarios.filter(
        (u) => u.ubmId === solicitacao.ubmId && u.papeis?.includes('escalante'),
      );
      const solicitante = usuarios.find((u) => u.id === solicitacao.solicitanteId);

      if (aceitar) {
        await Promise.all(
          escalantes.map((e) =>
            notificar(e.id, 'aprovacao_escalante', 'Uma solicitação de serviço aguarda sua aprovação.', `/sistema/solicitacoes/${id}`),
          ),
        );
      } else if (solicitante) {
        await notificar(solicitante.id, 'solicitacao_servico', 'Sua solicitação de serviço foi recusada pelo militar indicado.');
      }
    },
    [solicitacoesServico, usuarios, notificar],
  );

  const responderSolicitacaoEscalante = useCallback(
    async (id: string, aprovar: boolean) => {
      const db = requireDb();
      const solicitacao = solicitacoesServico.find((s) => s.id === id);
      if (!solicitacao) throw new Error('Solicitação não encontrada.');

      await updateDoc(doc(db, 'solicitacoes_servico', id), {
        status: aprovar ? 'aprovada' : 'recusada_escalante',
        aprovadoPorId: usuarioAtual?.id ?? '',
        respondido_em: new Date().toISOString(),
      });

      if (aprovar) {
        const colecaoOrigem = solicitacao.tipoEscalaOrigem === 'ordinaria' ? 'escalas_ordinarias' : 'escalas_extraordinarias';
        // Substituição: a vaga do solicitante passa a ser do indicado.
        await updateDoc(doc(db, colecaoOrigem, solicitacao.escalaOrigemId), {
          militarId: solicitacao.indicadoId,
        });

        // Permuta: também troca a vaga do indicado para o solicitante.
        if (solicitacao.tipo === 'permuta' && solicitacao.escalaDestinoId) {
          await updateDoc(doc(db, colecaoOrigem, solicitacao.escalaDestinoId), {
            militarId: solicitacao.solicitanteId,
          });
        }
      }

      const solicitante = usuarios.find((u) => u.id === solicitacao.solicitanteId);
      const indicado = usuarios.find((u) => u.id === solicitacao.indicadoId);
      const mensagem = aprovar
        ? 'Sua solicitação de serviço foi aprovada pelo escalante e já está refletida na escala.'
        : 'Sua solicitação de serviço foi recusada pelo escalante.';
      if (solicitante) await notificar(solicitante.id, 'solicitacao_servico', mensagem);
      if (indicado) await notificar(indicado.id, 'solicitacao_servico', mensagem);
    },
    [solicitacoesServico, usuarios, usuarioAtual, notificar],
  );

  // --- Alertas ---------------------------------------------------------------
  const marcarAlertaLida = useCallback(async (id: string) => {
    const db = requireDb();
    await updateDoc(doc(db, 'alertas', id), { lida: true });
  }, []);

  const valor = useMemo<AppContextData>(
    () => ({
      ubms,
      usuarios,
      militares,
      escalasOrdinarias,
      escalasExtraordinarias,
      escalasDiferenciadas,
      solicitacoesAlteracaoDiferenciada,
      afastamentos,
      presencas,
      solicitacoesServico,
      alertas,
      usuarioAtual,
      isAuthenticated,
      carregandoAuth,
      firebaseConfigurado: isFirebaseConfigured,
      login,
      logout,
      solicitarAcesso,
      enviarResetSenha,
      validarMatriculaEfetivo,
      primeiroAcessoPorMatricula,
      addUbm,
      updateUbm,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addMilitar,
      importarMilitaresCsv,
      updateMilitar,
      transferirMilitarDeUbm,
      deleteMilitar,
      gerarEPersistirEscalaOrdinaria,
      updateEscalaOrdinaria,
      deleteEscalaOrdinaria,
      criarEscalaExtraordinaria,
      alterarMilitarExtraordinaria,
      solicitarEscalaDiferenciada,
      removerEscalaDiferenciada,
      solicitarAlteracaoDiferenciada,
      responderAlteracaoDiferenciada,
      addAfastamento,
      deleteAfastamento,
      registrarPresenca,
      criarSolicitacaoServico,
      responderSolicitacaoIndicado,
      responderSolicitacaoEscalante,
      marcarAlertaLida,
    }),
    [
      ubms,
      usuarios,
      militares,
      escalasOrdinarias,
      escalasExtraordinarias,
      escalasDiferenciadas,
      solicitacoesAlteracaoDiferenciada,
      afastamentos,
      presencas,
      solicitacoesServico,
      alertas,
      usuarioAtual,
      isAuthenticated,
      carregandoAuth,
      login,
      logout,
      solicitarAcesso,
      enviarResetSenha,
      validarMatriculaEfetivo,
      primeiroAcessoPorMatricula,
      addUbm,
      updateUbm,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addMilitar,
      importarMilitaresCsv,
      updateMilitar,
      transferirMilitarDeUbm,
      deleteMilitar,
      gerarEPersistirEscalaOrdinaria,
      updateEscalaOrdinaria,
      deleteEscalaOrdinaria,
      criarEscalaExtraordinaria,
      alterarMilitarExtraordinaria,
      solicitarEscalaDiferenciada,
      removerEscalaDiferenciada,
      solicitarAlteracaoDiferenciada,
      responderAlteracaoDiferenciada,
      addAfastamento,
      deleteAfastamento,
      registrarPresenca,
      criarSolicitacaoServico,
      responderSolicitacaoIndicado,
      responderSolicitacaoEscalante,
      marcarAlertaLida,
    ],
  );

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
