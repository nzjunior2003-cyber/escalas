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
import {
  LIMITE_EXTRAORDINARIAS_POR_MES,
  extraordinariasNoMes,
  gerarEscalaOrdinariaUbm,
  ordenarCandidatosExtraordinario,
  sugerirMilitarExtraordinario,
  temFolga24hAntes,
} from '../lib/escala';
import { buscarMilitarPorMatricula, buscarMilitaresPorNome, normalizarMatricula } from '../lib/planilhaEfetivo';
import type { LinhaMilitar } from '../lib/csvMilitares';
import {
  Afastamento,
  Alerta,
  Comando,
  EscalaDiferenciada,
  EscalaExtraordinaria,
  EscalaOrdinaria,
  FUNCOES_PADRAO,
  FuncaoUbm,
  EscalaComando,
  FechamentoEscala,
  HistoricoEscala,
  Militar,
  ModalidadeSolicitacaoServico,
  RegistroPresenca,
  SolicitacaoReforco,
  SolicitacaoServico,
  StatusSolicitacaoReforco,
  StatusSolicitacaoServico,
  StatusVagaVoluntaria,
  TipoEscalaServico,
  Ubm,
  Usuario,
  VagaVoluntariaExtraordinaria,
} from '../types';

interface AppContextData {
  ubms: Ubm[];
  comandos: Comando[];
  usuarios: Usuario[];
  militares: Militar[];
  funcoes: FuncaoUbm[];
  escalasOrdinarias: EscalaOrdinaria[];
  escalasExtraordinarias: EscalaExtraordinaria[];
  escalasDiferenciadas: EscalaDiferenciada[];
  vagasVoluntariasExtraordinarias: VagaVoluntariaExtraordinaria[];
  afastamentos: Afastamento[];
  presencas: RegistroPresenca[];
  solicitacoesServico: SolicitacaoServico[];
  solicitacoesReforco: SolicitacaoReforco[];
  escalasComando: EscalaComando[];
  fechamentosEscala: FechamentoEscala[];
  historicoEscalas: HistoricoEscala[];
  alertas: Alerta[];

  usuarioAtual: Usuario | null;
  isAuthenticated: boolean;
  carregandoAuth: boolean;
  firebaseConfigurado: boolean;

  /** `identificador` aceita e-mail ou matrícula (resolvida via coleção `matriculas`). */
  login: (identificador: string, senha?: string) => Promise<void>;
  logout: () => Promise<void>;
  solicitarAcesso: (dados: {
    nome: string;
    nomeGuerra?: string;
    matricula?: string;
    email: string;
    senha: string;
    ubmId: string;
    cargo?: string;
    naoEncontradoNaPlanilha?: boolean;
  }) => Promise<void>;
  enviarResetSenha: (email: string) => Promise<void>;
  /** Confere a matrícula contra a planilha ao vivo do efetivo do CBMPA. */
  validarMatriculaEfetivo: (matricula: string) => Promise<LinhaMilitar | null>;
  buscarMilitaresEfetivoPorNome: (nome: string) => Promise<LinhaMilitar[]>;
  /** Completa o primeiro acesso de um militar já validado pela matrícula. */
  primeiroAcessoPorMatricula: (dados: {
    matricula: string;
    nomeCompleto: string;
    cargo?: string;
    nomeGuerra: string;
    email: string;
    senha: string;
    ubmId: string;
  }) => Promise<{ autoVinculado: boolean }>;

  addUbm: (dados: Omit<Ubm, 'id'>) => Promise<string>;
  updateUbm: (id: string, dados: Partial<Ubm>) => Promise<void>;

  /** Cadastro de Comandos (CRB/COP) — exclusivo do master. */
  addComando: (dados: Omit<Comando, 'id'>) => Promise<string>;
  updateComando: (id: string, dados: Partial<Comando>) => Promise<void>;
  deleteComando: (id: string) => Promise<void>;
  vincularUbmAoComando: (ubmId: string, novoComandoId: string | null) => Promise<void>;

  updateUsuario: (id: string, dados: Partial<Usuario>) => Promise<void>;
  addUsuario: (dados: Omit<Usuario, 'id' | 'criado_em'> & { senha: string }) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;

  addMilitar: (dados: Omit<Militar, 'id' | 'historicoUbm' | 'criado_em' | 'atualizado_em'>) => Promise<string>;
  importarMilitaresCsv: (ubmId: string, linhas: LinhaMilitar[]) => Promise<{ criados: number; ignorados: number }>;
  updateMilitar: (id: string, dados: Partial<Militar>) => Promise<void>;
  transferirMilitarDeUbm: (militarId: string, novaUbmId: string) => Promise<void>;
  deleteMilitar: (id: string) => Promise<void>;

  /** Cadastro de funções operacionais da própria UBM (escalante/comandante). */
  addFuncao: (dados: { ubmId: string; nome: string }) => Promise<string>;
  updateFuncao: (id: string, dados: Partial<Pick<FuncaoUbm, 'nome' | 'ativa'>>) => Promise<void>;
  deleteFuncao: (id: string) => Promise<void>;
  moverOrdemFuncao: (ubmId: string, funcaoId: string, direcao: 'cima' | 'baixo') => Promise<void>;

  gerarEPersistirEscalaOrdinaria: (params: { ubmId: string; dataInicio: string; dataFim: string }) => Promise<number>;
  updateEscalaOrdinaria: (id: string, militarId: string) => Promise<void>;
  moverDataEscalaOrdinaria: (id: string, novaData: string) => Promise<void>;
  adicionarEscalaOrdinaria: (dados: { ubmId: string; funcao: string; data: string; militarId: string }) => Promise<void>;
  deleteEscalaOrdinaria: (id: string) => Promise<void>;

  criarEscalaExtraordinaria: (dados: { ubmId: string; funcao: string; data: string; motivo: string; militarIdEscolhido?: string }) => Promise<string>;
  alterarMilitarExtraordinaria: (id: string, militarId: string) => Promise<void>;
  deleteEscalaExtraordinaria: (id: string) => Promise<void>;
  dispararVagaVoluntariaExtraordinaria: (dados: { ubmId: string; funcao: string; data: string; motivo: string; prazo: string; quantidade: number }) => Promise<string>;
  voluntariarParaVaga: (vagaId: string) => Promise<void>;
  resolverVagaCompulsoriamente: (vagaId: string) => Promise<void>;

  /** Só o escalante cadastra — cria o registro e já espelha em EscalaOrdinaria (origem 'diferenciada'). */
  criarEscalaDiferenciada: (dados: { militarId: string; ubmId: string; funcao: string; data: string; observacao?: string }) => Promise<void>;
  /** Só o Comandante da UBM altera depois de cadastrada. */
  atualizarEscalaDiferenciada: (id: string, dados: { militarId?: string; funcao?: string; data?: string; observacao?: string }) => Promise<void>;
  removerEscalaDiferenciada: (id: string) => Promise<void>;

  /** Libera o PDF da semana e grava uma versão no histórico com o que estava escalado no momento. */
  fecharEscalaSemana: (params: { ubmId: string; tipo: TipoEscalaServico; semanaInicio: string }) => Promise<void>;
  /** O próprio escalante pode reabrir pra editar de novo — a próxima vez que fechar gera nova versão no histórico. */
  reabrirEscalaSemana: (params: { ubmId: string; tipo: TipoEscalaServico; semanaInicio: string }) => Promise<void>;

  addAfastamento: (dados: Omit<Afastamento, 'id' | 'criado_em' | 'criadoPorId'>) => Promise<void>;
  deleteAfastamento: (id: string) => Promise<void>;

  registrarPresenca: (dados: Omit<RegistroPresenca, 'id' | 'criado_em' | 'registradoPorId'>) => Promise<void>;

  criarSolicitacaoServico: (dados: {
    ubmId: string;
    modalidade: ModalidadeSolicitacaoServico;
    horarioParcial?: string;
    localEvento?: string;
    escalaOrigemId: string;
    tipoEscalaOrigem: TipoEscalaServico;
    indicadoId: string;
    motivo?: string;
  }) => Promise<void>;
  responderSolicitacaoIndicado: (id: string, aceitar: boolean) => Promise<void>;
  /** Aprovação final — Comandante OU Escalante da UBM. */
  responderSolicitacaoAprovador: (id: string, aprovar: boolean) => Promise<void>;

  /** Solicitação de reforço de militar — disparada por CRB/COP pra uma UBM vinculada. */
  criarSolicitacaoReforco: (dados: {
    comandoId: string;
    ubmId: string;
    funcao: string;
    postoDesejado?: string;
    data: string;
    motivo: string;
  }) => Promise<string>;
  /** Escalante/Comandante da UBM atende (empenha o militar) ou recusa. */
  responderSolicitacaoReforco: (id: string, decisao: { atender: boolean; militarId?: string }) => Promise<void>;

  marcarAlertaLida: (id: string) => Promise<void>;
  deleteAlerta: (id: string) => Promise<void>;
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
  const comandos = useColecao<Comando>('comandos', isAuthenticated);
  const usuarios = useColecao<Usuario>('usuarios', isAuthenticated);
  const militares = useColecao<Militar>('militares', isAuthenticated);
  const funcoes = useColecao<FuncaoUbm>('funcoes', isAuthenticated);
  const escalasOrdinarias = useColecao<EscalaOrdinaria>('escalas_ordinarias', isAuthenticated);
  const escalasExtraordinarias = useColecao<EscalaExtraordinaria>('escalas_extraordinarias', isAuthenticated);
  const escalasDiferenciadas = useColecao<EscalaDiferenciada>('escalas_diferenciadas', isAuthenticated);
  const vagasVoluntariasExtraordinarias = useColecao<VagaVoluntariaExtraordinaria>('vagas_voluntarias_extraordinarias', isAuthenticated);
  const afastamentos = useColecao<Afastamento>('afastamentos', isAuthenticated);
  const presencas = useColecao<RegistroPresenca>('presencas', isAuthenticated);
  const solicitacoesServico = useColecao<SolicitacaoServico>('solicitacoes_servico', isAuthenticated);
  const solicitacoesReforco = useColecao<SolicitacaoReforco>('solicitacoes_reforco', isAuthenticated);
  const escalasComando = useColecao<EscalaComando>('escalas_comando', isAuthenticated);
  const fechamentosEscala = useColecao<FechamentoEscala>('fechamentos_escala', isAuthenticated);
  const historicoEscalas = useColecao<HistoricoEscala>('historico_escalas', isAuthenticated);
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
              html: `<h2>Nova Solicitação de Acesso</h2><p><b>${nome}</b>${cargo ? ` (${cargo})` : ''} solicitou acesso ao GESOP com o e-mail <b>${email}</b>.</p><p>Acesse o módulo <b>Usuários</b> para revisar e ativar o acesso.</p>`,
            }).catch((erroEnvio) => console.error('Erro ao notificar aprovador:', erroEnvio)),
          ),
        );
      } catch (erroNotificacao) {
        console.error('Erro ao buscar aprovadores para notificar solicitação de acesso:', erroNotificacao);
      }
    },
    [],
  );

  /**
   * Avisa por e-mail todo mundo com papel 'master' quando alguém pede acesso
   * mas não foi encontrado na planilha de efetivo — pra incluírem a pessoa
   * lá. Por e-mail (não alerta in-app via `notificar`) pelo mesmo motivo de
   * `notificarAprovadoresDaUbm`: nesse momento a conta recém-criada ainda
   * está com `ativo: false`, e a regra do Firestore para criar alertas
   * exige `ativo()` — só e-mail funciona antes da aprovação.
   */
  const notificarMasterSobreNaoEncontrado = useCallback(
    async (dados: { nome: string; matricula?: string; cargo?: string; email: string }) => {
      try {
        const db = requireDb();
        const mastersSnap = await getDocs(
          query(collection(db, 'usuarios'), where('papeis', 'array-contains', 'master')),
        );
        const masters = mastersSnap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Usuario);
        const detalhes = [dados.cargo, dados.matricula ? `MF ${dados.matricula}` : undefined].filter(Boolean).join(' — ');
        await Promise.all(
          masters.map((m) =>
            enviarEmail({
              to: m.email,
              subject: `Militar não encontrado na planilha — ${dados.nome}`,
              html: `<h2>Solicitação de acesso sem correspondência na planilha</h2><p><b>${dados.nome}</b>${detalhes ? ` (${detalhes})` : ''} pediu acesso ao GESOP com o e-mail <b>${dados.email}</b>, mas não foi encontrado na planilha de efetivo.</p><p>Inclua a pessoa na planilha e/ou aprove o acesso manualmente no módulo <b>Usuários</b>.</p>`,
            }).catch((erroEnvio) => console.error('Erro ao notificar master:', erroEnvio)),
          ),
        );
      } catch (erroNotificacao) {
        console.error('Erro ao buscar masters para notificar militar não encontrado na planilha:', erroNotificacao);
      }
    },
    [],
  );

  const solicitarAcesso = useCallback(
    async ({
      nome,
      nomeGuerra,
      matricula,
      email,
      senha,
      ubmId,
      cargo,
      naoEncontradoNaPlanilha,
    }: {
      nome: string;
      nomeGuerra?: string;
      matricula?: string;
      email: string;
      senha: string;
      ubmId: string;
      cargo?: string;
      naoEncontradoNaPlanilha?: boolean;
    }) => {
      try {
        const auth = requireFirebaseAuth();
        const db = requireDb();
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);

        await setDoc(doc(db, 'usuarios', credencial.user.uid), {
          nome,
          ...(nomeGuerra ? { nomeGuerra } : {}),
          ...(matricula ? { matricula } : {}),
          email,
          cargo: cargo ?? '',
          ubmId,
          papeis: ['militar'],
          ativo: false,
          criado_em: new Date().toISOString(),
        });

        await notificarAprovadoresDaUbm(ubmId, nome, email, cargo);
        if (naoEncontradoNaPlanilha) {
          await notificarMasterSobreNaoEncontrado({ nome, matricula, cargo, email });
        }
        await signOut(auth);
      } catch (erro) {
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [notificarAprovadoresDaUbm, notificarMasterSobreNaoEncontrado],
  );

  const validarMatriculaEfetivo = useCallback(async (matricula: string) => {
    return buscarMilitarPorMatricula(matricula);
  }, []);

  const buscarMilitaresEfetivoPorNome = useCallback(async (nome: string) => {
    return buscarMilitaresPorNome(nome);
  }, []);

  /**
   * Primeiro acesso por matrícula: a matrícula já foi validada contra a
   * planilha ao vivo (ver `validarMatriculaEfetivo`) antes de chegar aqui.
   * Cria a conta e o perfil, sempre com papel 'militar', e registra
   * `matriculas/{matricula}` para permitir login por matrícula depois.
   * Nunca envia a senha por e-mail: a pessoa acabou de digitá-la e
   * confirmá-la duas vezes, só confirma o cadastro.
   *
   * Auto-vínculo: se o escalante já cadastrou essa pessoa no Efetivo da
   * mesma UBM (mesma matrícula normalizada), a conta já nasce ATIVA e
   * vinculada a esse `Militar` — a existência do registro é a própria
   * verificação, sem precisar de aprovação manual. Senão, nasce inativa e
   * segue o fluxo de sempre (notifica o escalante/comandante pra aprovar E
   * incluir no efetivo). Retorna se ficou auto-vinculada, pra ajustar a
   * mensagem mostrada.
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
    }): Promise<{ autoVinculado: boolean }> => {
      try {
        const auth = requireFirebaseAuth();
        const db = requireDb();
        const matriculaNormalizada = normalizarMatricula(matricula);
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);

        await setDoc(
          doc(db, 'usuarios', credencial.user.uid),
          semIndefinidosParaCriar({
            nome: nomeCompleto,
            nomeGuerra,
            matricula: matriculaNormalizada,
            cargo,
            email,
            ubmId,
            papeis: ['militar'],
            ativo: false,
            criado_em: new Date().toISOString(),
          }),
        );

        try {
          await setDoc(doc(db, 'matriculas', matriculaNormalizada), { email });
        } catch (erroMatricula) {
          // Não impede o cadastro — sem isso, a pessoa ainda consegue entrar pelo e-mail.
          console.error('Erro ao registrar matrícula para login:', erroMatricula);
        }

        let autoVinculado = false;
        try {
          const militarSnap = await getDocs(
            query(
              collection(db, 'militares'),
              where('ubmId', '==', ubmId),
              where('matricula', '==', matriculaNormalizada),
            ),
          );
          if (!militarSnap.empty) {
            await updateDoc(doc(db, 'usuarios', credencial.user.uid), {
              ativo: true,
              militarId: militarSnap.docs[0].id,
            });
            autoVinculado = true;
          }
        } catch (erroVinculo) {
          // Sem vínculo automático, segue pro fluxo normal de aprovação —
          // nunca deixa a pessoa sem conseguir se cadastrar por causa disso.
          console.error('Erro ao checar vínculo automático com o Efetivo:', erroVinculo);
        }

        try {
          await enviarEmail({
            to: email,
            subject: autoVinculado ? 'Acesso liberado — GESOP' : 'Cadastro recebido — GESOP',
            html: autoVinculado
              ? `<h2>Acesso liberado</h2><p>Olá, ${nomeGuerra}. Seu cadastro (matrícula ${matricula}) já está vinculado ao efetivo da sua UBM — pode entrar no sistema normalmente com o e-mail e a senha que você cadastrou.</p>`
              : `<h2>Cadastro recebido</h2><p>Olá, ${nomeGuerra}. Seu cadastro (matrícula ${matricula}) foi recebido e está aguardando aprovação do Comandante/Escalante da sua UBM. Você será avisado quando puder acessar o sistema.</p>`,
          });
        } catch (erroEnvio) {
          console.error('Erro ao enviar e-mail de confirmação de cadastro:', erroEnvio);
        }

        if (!autoVinculado) {
          await notificarAprovadoresDaUbm(ubmId, nomeCompleto, email, cargo);
        }
        await signOut(auth);
        return { autoVinculado };
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
    // Toda UBM nova já nasce com as funções padrão cadastradas — o
    // escalante edita os nomes, cria outras ou inativa o que não servir
    // pra unidade dele a partir daí (ver nota em `FUNCOES_PADRAO`).
    const agora = new Date().toISOString();
    const lote = writeBatch(db);
    FUNCOES_PADRAO.forEach((nome) => {
      const funcaoRef = doc(collection(db, 'funcoes'));
      lote.set(funcaoRef, { ubmId: ref.id, nome, ativa: true, criado_em: agora });
    });
    await lote.commit();
    return ref.id;
  }, []);

  const updateUbm = useCallback(async (id: string, dados: Partial<Ubm>) => {
    const db = requireDb();
    await updateDoc(doc(db, 'ubms', id), semIndefinidosParaAtualizar(dados));
  }, []);

  // --- Comandos (CRB/COP) — cadastrados pelo master --------------------------
  const addComando = useCallback(async (dados: Omit<Comando, 'id'>) => {
    const db = requireDb();
    const ref = await addDoc(collection(db, 'comandos'), semIndefinidosParaCriar(dados));
    return ref.id;
  }, []);

  const updateComando = useCallback(async (id: string, dados: Partial<Comando>) => {
    const db = requireDb();
    await updateDoc(doc(db, 'comandos', id), semIndefinidosParaAtualizar(dados));
  }, []);

  const deleteComando = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'comandos', id));
  }, []);

  /**
   * Vincula a própria UBM a um CRB/COP (ou desvincula, passando `null`) —
   * usado pelo Comandante/Escalante na tela de UBMs, sem precisar do módulo
   * Comandos (exclusivo do master). Só mexe no array `ubmIds` de cada
   * comando afetado, um de cada vez, tirando do antigo (se houver) e
   * pondo no novo — a regra do Firestore só permite mexer no próprio id
   * dentro desse array, nunca no de outra UBM.
   */
  const vincularUbmAoComando = useCallback(
    async (ubmId: string, novoComandoId: string | null) => {
      const db = requireDb();
      const lote = writeBatch(db);
      let algumaMudanca = false;
      comandos.forEach((c) => {
        const temAgora = c.ubmIds.includes(ubmId);
        const deveTer = c.id === novoComandoId;
        if (temAgora && !deveTer) {
          lote.update(doc(db, 'comandos', c.id), { ubmIds: c.ubmIds.filter((id) => id !== ubmId) });
          algumaMudanca = true;
        } else if (!temAgora && deveTer) {
          lote.update(doc(db, 'comandos', c.id), { ubmIds: [...c.ubmIds, ubmId] });
          algumaMudanca = true;
        }
      });
      if (algumaMudanca) await lote.commit();
    },
    [comandos],
  );

  // --- Funções operacionais (cadastro por UBM) ------------------------------
  const addFuncao = useCallback(
    async (dados: { ubmId: string; nome: string }) => {
      const db = requireDb();
      const ref = await addDoc(collection(db, 'funcoes'), {
        ubmId: dados.ubmId,
        nome: dados.nome,
        ativa: true,
        ordem: funcoes.filter((f) => f.ubmId === dados.ubmId).length,
        criado_em: new Date().toISOString(),
      });
      return ref.id;
    },
    [funcoes],
  );

  const updateFuncao = useCallback(async (id: string, dados: Partial<Pick<FuncaoUbm, 'nome' | 'ativa'>>) => {
    const db = requireDb();
    await updateDoc(doc(db, 'funcoes', id), semIndefinidosParaAtualizar(dados));
  }, []);

  const deleteFuncao = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'funcoes', id));
  }, []);

  /** Reordena as funções da UBM (setinhas pra cima/baixo no Kanban) — troca a posição com a vizinha e regrava `ordem` de todas, pra nunca depender de valores antigos/ausentes. */
  const moverOrdemFuncao = useCallback(
    async (ubmId: string, funcaoId: string, direcao: 'cima' | 'baixo') => {
      const db = requireDb();
      const daUbm = funcoes
        .filter((f) => f.ubmId === ubmId)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.criado_em ?? '').localeCompare(String(b.criado_em ?? '')));
      const indice = daUbm.findIndex((f) => f.id === funcaoId);
      const alvo = direcao === 'cima' ? indice - 1 : indice + 1;
      if (indice === -1 || alvo < 0 || alvo >= daUbm.length) return;

      const reordenada = [...daUbm];
      [reordenada[indice], reordenada[alvo]] = [reordenada[alvo], reordenada[indice]];

      const batch = writeBatch(db);
      reordenada.forEach((f, i) => batch.update(doc(db, 'funcoes', f.id), { ordem: i }));
      await batch.commit();
    },
    [funcoes],
  );

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
  // Gera sempre pra UBM inteira (todas as funções ativas de uma vez), nunca
  // uma função isolada — é o que garante que ninguém seja escalado em duas
  // funções no mesmo dia e que quem acumula funções seja priorizado na mais
  // escassa (ver nota em `gerarEscalaOrdinariaUbm`).
  const gerarEPersistirEscalaOrdinaria = useCallback(
    async (params: { ubmId: string; dataInicio: string; dataFim: string }) => {
      const db = requireDb();
      const geradas = gerarEscalaOrdinariaUbm({
        ...params,
        funcoes,
        militares,
        afastamentos,
        escalasOrdinariasExistentes: escalasOrdinarias,
      });
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
    [funcoes, militares, afastamentos, escalasOrdinarias],
  );

  const updateEscalaOrdinaria = useCallback(async (id: string, militarId: string) => {
    const db = requireDb();
    await updateDoc(doc(db, 'escalas_ordinarias', id), { militarId, origem: 'manual' });
  }, []);

  /**
   * Kanban por função: mais de um militar pode estar escalado na mesma
   * função no mesmo dia (cada um é o seu próprio cartão) — arrastar um
   * cartão pra outro dia sempre MOVE (nunca troca de lugar com quem já
   * estiver lá, já que os dois podem coexistir na célula de destino).
   */
  const moverDataEscalaOrdinaria = useCallback(async (id: string, novaData: string) => {
    const db = requireDb();
    await updateDoc(doc(db, 'escalas_ordinarias', id), { data: novaData, origem: 'manual' });
  }, []);

  const deleteEscalaOrdinaria = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'escalas_ordinarias', id));
  }, []);

  /** Kanban por função: adiciona mais um militar numa função+dia que já tem gente (ou começa vazia) — sem mexer nos cartões que já estavam lá. */
  const adicionarEscalaOrdinaria = useCallback(async (dados: { ubmId: string; funcao: string; data: string; militarId: string }) => {
    const db = requireDb();
    await addDoc(collection(db, 'escalas_ordinarias'), {
      ...dados,
      origem: 'manual' as EscalaOrdinaria['origem'],
      criado_em: new Date().toISOString(),
    });
  }, []);

  // --- Escala extraordinária ---------------------------------------------
  const criarEscalaExtraordinaria = useCallback(
    async (dados: { ubmId: string; funcao: string; data: string; motivo: string; militarIdEscolhido?: string }) => {
      const db = requireDb();
      const sugerido = sugerirMilitarExtraordinario({
        ubmId: dados.ubmId,
        funcao: dados.funcao,
        data: dados.data,
        militares,
        afastamentos,
        escalasOrdinarias,
        extraordinariasAnteriores: escalasExtraordinarias,
      });
      if (!sugerido) {
        throw new Error(
          'Nenhum militar disponível nessa função para sugerir (todos afastados ou já no teto de ' +
            `${LIMITE_EXTRAORDINARIAS_POR_MES} extraordinárias no mês).`,
        );
      }

      const militarFinal = dados.militarIdEscolhido ?? sugerido.id;
      if (
        dados.militarIdEscolhido &&
        extraordinariasNoMes(militarFinal, dados.data, escalasExtraordinarias, afastamentos) >= LIMITE_EXTRAORDINARIAS_POR_MES
      ) {
        throw new Error(`Esse militar já atingiu o limite de ${LIMITE_EXTRAORDINARIAS_POR_MES} extraordinárias no mês.`);
      }

      const ref = await addDoc(collection(db, 'escalas_extraordinarias'), {
        ubmId: dados.ubmId,
        funcao: dados.funcao,
        data: dados.data,
        motivo: dados.motivo,
        militarSugeridoId: sugerido.id,
        militarId: militarFinal,
        criadoPorId: usuarioAtual?.id ?? '',
        criado_em: new Date().toISOString(),
      });
      return ref.id;
    },
    [militares, afastamentos, escalasOrdinarias, escalasExtraordinarias, usuarioAtual],
  );

  const alterarMilitarExtraordinaria = useCallback(
    async (id: string, militarId: string) => {
      const db = requireDb();
      const atual = escalasExtraordinarias.find((e) => e.id === id);
      if (atual && extraordinariasNoMes(militarId, atual.data, escalasExtraordinarias, afastamentos) >= LIMITE_EXTRAORDINARIAS_POR_MES) {
        throw new Error(`Esse militar já atingiu o limite de ${LIMITE_EXTRAORDINARIAS_POR_MES} extraordinárias no mês.`);
      }
      // O militarSugeridoId nunca é sobrescrito — a estatística de rodízio
      // continua contando como se a sugestão tivesse sido seguida.
      await updateDoc(doc(db, 'escalas_extraordinarias', id), { militarId });
    },
    [escalasExtraordinarias],
  );

  const deleteEscalaExtraordinaria = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'escalas_extraordinarias', id));
  }, []);

  /**
   * Dispara uma vaga extraordinária (podendo pedir mais de um militar) pro
   * efetivo elegível se voluntariar, com prazo — em vez de já escalar
   * compulsoriamente. Elegibilidade: função ativa, sem afastamento na data,
   * sob o teto mensal e com 24h de folga desde o serviço anterior (ver nota
   * em types.ts) — todo elegível recebe alerta.
   */
  const dispararVagaVoluntariaExtraordinaria = useCallback(
    async (dados: { ubmId: string; funcao: string; data: string; motivo: string; prazo: string; quantidade: number }) => {
      const db = requireDb();
      const elegiveis = ordenarCandidatosExtraordinario({
        ubmId: dados.ubmId,
        funcao: dados.funcao,
        data: dados.data,
        militares,
        afastamentos,
        escalasOrdinarias,
        extraordinariasAnteriores: escalasExtraordinarias,
      });
      if (elegiveis.length === 0) {
        throw new Error(
          'Nenhum militar disponível nessa função pra chamar (todos afastados, sem 24h de folga do serviço anterior, ou já no teto de ' +
            `${LIMITE_EXTRAORDINARIAS_POR_MES} extraordinárias no mês).`,
        );
      }

      const ref = await addDoc(collection(db, 'vagas_voluntarias_extraordinarias'), {
        ubmId: dados.ubmId,
        funcao: dados.funcao,
        data: dados.data,
        motivo: dados.motivo,
        prazo: dados.prazo,
        quantidade: dados.quantidade,
        status: 'aberta' as StatusVagaVoluntaria,
        candidatosElegiveisIds: elegiveis.map((m) => m.id),
        voluntariosIds: [],
        criadoPorId: usuarioAtual?.id ?? '',
        criado_em: new Date().toISOString(),
      });

      const usuariosElegiveis = usuarios.filter((u) => u.militarId && elegiveis.some((m) => m.id === u.militarId));
      const funcaoNome = funcoes.find((f) => f.id === dados.funcao)?.nome ?? 'Função removida';
      const plural = dados.quantidade > 1 ? `${dados.quantidade} vagas` : '1 vaga';
      await Promise.all(
        usuariosElegiveis.map((u) =>
          notificar(
            u.id,
            'vaga_voluntaria_disponivel',
            `Escala extraordinária disponível pra voluntariado: ${plural} de ${funcaoNome} em ${dados.data}. Prazo pra se voluntariar: ${dados.prazo}.`,
            '/sistema/escala',
          ),
        ),
      );
      return ref.id;
    },
    [militares, afastamentos, escalasOrdinarias, escalasExtraordinarias, usuarios, funcoes, usuarioAtual, notificar],
  );

  /**
   * Voluntariado: cada elegível que se candidata ocupa uma das `quantidade`
   * posições na hora — sem esperar prazo nem os demais — até a vaga ficar
   * cheia. A vaga é atualizada ANTES de criar a escala definitiva; se outra
   * pessoa já tiver ocupado a última posição entre a leitura e a gravação,
   * esse update é rejeitado pela regra (haveria mais voluntários que
   * `quantidade`) e a escala nunca chega a ser criada.
   */
  const voluntariarParaVaga = useCallback(
    async (vagaId: string) => {
      const db = requireDb();
      const vaga = vagasVoluntariasExtraordinarias.find((v) => v.id === vagaId);
      const militarId = usuarioAtual?.militarId;
      if (!vaga) throw new Error('Vaga não encontrada.');
      if (!militarId) throw new Error('Seu usuário não está vinculado a um militar do efetivo.');
      if (vaga.status !== 'aberta') throw new Error('Essa vaga já foi preenchida.');
      if (vaga.voluntariosIds.length >= vaga.quantidade) throw new Error('Essa vaga já está completa.');
      if (vaga.voluntariosIds.includes(militarId)) throw new Error('Você já se voluntariou pra essa vaga.');
      if (!vaga.candidatosElegiveisIds.includes(militarId)) {
        throw new Error('Você não está na lista de elegíveis pra essa vaga.');
      }
      if (extraordinariasNoMes(militarId, vaga.data, escalasExtraordinarias, afastamentos) >= LIMITE_EXTRAORDINARIAS_POR_MES) {
        throw new Error(`Você já atingiu o limite de ${LIMITE_EXTRAORDINARIAS_POR_MES} extraordinárias no mês.`);
      }
      if (!temFolga24hAntes(militarId, vaga.data, escalasOrdinarias, escalasExtraordinarias)) {
        throw new Error('Você não tem 24h de folga desde o serviço anterior pra essa data.');
      }

      const novosVoluntarios = [...vaga.voluntariosIds, militarId];
      const novoStatus: StatusVagaVoluntaria = novosVoluntarios.length >= vaga.quantidade ? 'preenchida' : 'aberta';
      try {
        await updateDoc(doc(db, 'vagas_voluntarias_extraordinarias', vagaId), {
          status: novoStatus,
          voluntariosIds: novosVoluntarios,
        });
      } catch {
        throw new Error('Essa vaga já foi preenchida por outros voluntários.');
      }

      await addDoc(collection(db, 'escalas_extraordinarias'), {
        ubmId: vaga.ubmId,
        funcao: vaga.funcao,
        data: vaga.data,
        motivo: vaga.motivo,
        militarSugeridoId: militarId,
        militarId,
        vagaVoluntariaId: vagaId,
        criadoPorId: usuarioAtual?.id ?? '',
        criado_em: new Date().toISOString(),
      });

      const funcaoNome = funcoes.find((f) => f.id === vaga.funcao)?.nome ?? 'Função removida';
      await notificar(
        usuarioAtual!.id,
        'vaga_voluntaria_resolvida',
        `Você se voluntariou e foi confirmado pra escala extraordinária de ${funcaoNome} em ${vaga.data}.`,
        '/sistema/escala',
      );
      if (novoStatus === 'preenchida') {
        const gestaoDaUbm = usuarios.filter(
          (u) => u.ubmId === vaga.ubmId && (u.papeis?.includes('escalante') || u.papeis?.includes('comandante')),
        );
        await Promise.all(
          gestaoDaUbm.map((u) =>
            notificar(
              u.id,
              'vaga_voluntaria_resolvida',
              `A vaga de ${funcaoNome} em ${vaga.data} foi totalmente preenchida por voluntariado.`,
              '/sistema/escala',
            ),
          ),
        );
      }
    },
    [vagasVoluntariasExtraordinarias, escalasOrdinarias, escalasExtraordinarias, usuarios, funcoes, usuarioAtual, notificar],
  );

  /**
   * Prazo esgotado com posições sobrando: o escalante completa
   * compulsoriamente as vagas que faltam — mesmo motor de equidade de
   * sempre (menos serviços primeiro; empatados em folga, desempata por
   * hierarquia — mais moderno primeiro — e ainda empatado, por
   * há-mais-tempo-sem-reforço), dentre os elegíveis que não se voluntariaram.
   */
  const resolverVagaCompulsoriamente = useCallback(
    async (vagaId: string) => {
      const db = requireDb();
      const vaga = vagasVoluntariasExtraordinarias.find((v) => v.id === vagaId);
      if (!vaga) throw new Error('Vaga não encontrada.');
      if (vaga.status !== 'aberta') throw new Error('Essa vaga já foi resolvida.');

      const faltam = vaga.quantidade - vaga.voluntariosIds.length;
      if (faltam <= 0) throw new Error('Essa vaga já está completa.');

      const ranking = ordenarCandidatosExtraordinario({
        ubmId: vaga.ubmId,
        funcao: vaga.funcao,
        data: vaga.data,
        militares,
        afastamentos,
        escalasOrdinarias,
        extraordinariasAnteriores: escalasExtraordinarias,
      }).filter((m) => vaga.candidatosElegiveisIds.includes(m.id) && !vaga.voluntariosIds.includes(m.id));
      const escolhidos = ranking.slice(0, faltam);
      if (escolhidos.length < faltam) {
        throw new Error('Não há militares elegíveis suficientes pra completar essa vaga compulsoriamente.');
      }

      await updateDoc(doc(db, 'vagas_voluntarias_extraordinarias', vagaId), {
        status: 'expirada_compulsoria' as StatusVagaVoluntaria,
        militaresCompulsoriosIds: escolhidos.map((m) => m.id),
        resolvido_em: new Date().toISOString(),
      });

      const funcaoNome = funcoes.find((f) => f.id === vaga.funcao)?.nome ?? 'Função removida';
      await Promise.all(
        escolhidos.map(async (m) => {
          await addDoc(collection(db, 'escalas_extraordinarias'), {
            ubmId: vaga.ubmId,
            funcao: vaga.funcao,
            data: vaga.data,
            motivo: vaga.motivo,
            militarSugeridoId: m.id,
            militarId: m.id,
            vagaVoluntariaId: vagaId,
            criadoPorId: usuarioAtual?.id ?? '',
            criado_em: new Date().toISOString(),
          });
          const usuarioMilitar = usuarios.find((u) => u.militarId === m.id);
          if (usuarioMilitar) {
            await notificar(
              usuarioMilitar.id,
              'vaga_voluntaria_resolvida',
              `Ninguém se voluntariou a tempo — você foi escalado compulsoriamente pra ${funcaoNome} em ${vaga.data}.`,
              '/sistema/escala',
            );
          }
        }),
      );
    },
    [vagasVoluntariasExtraordinarias, militares, afastamentos, escalasOrdinarias, escalasExtraordinarias, usuarios, funcoes, usuarioAtual, notificar],
  );

  // --- Solicitação de Reforço (CRB/COP -> UBM) ------------------------------
  const criarSolicitacaoReforco = useCallback(
    async (dados: { comandoId: string; ubmId: string; funcao: string; postoDesejado?: string; data: string; motivo: string }) => {
      const db = requireDb();
      const sugerido = sugerirMilitarExtraordinario({
        ubmId: dados.ubmId,
        funcao: dados.funcao,
        data: dados.data,
        militares,
        afastamentos,
        escalasOrdinarias,
        extraordinariasAnteriores: escalasExtraordinarias,
      });

      const ref = await addDoc(collection(db, 'solicitacoes_reforco'), {
        ...semIndefinidosParaCriar(dados),
        status: 'pendente' as StatusSolicitacaoReforco,
        militarSugeridoId: sugerido?.id,
        criadoPorId: usuarioAtual?.id ?? '',
        criado_em: new Date().toISOString(),
      });

      const aprovadores = usuarios.filter(
        (u) => u.ubmId === dados.ubmId && (u.papeis?.includes('escalante') || u.papeis?.includes('comandante')),
      );
      await Promise.all(
        aprovadores.map((a) =>
          notificar(a.id, 'solicitacao_reforco', 'Chegou uma solicitação de reforço de militar pra sua UBM.', '/sistema/reforcos'),
        ),
      );
      return ref.id;
    },
    [militares, afastamentos, escalasOrdinarias, escalasExtraordinarias, usuarios, usuarioAtual, notificar],
  );

  /**
   * Atender NUNCA mexe na escala do sistema — gera um Afastamento (motivo
   * 'reforco_crb_cop') pro militar empenhado, que já o torna indisponível
   * na própria UBM nesse período e credita normalmente na equidade (fila de
   * recuperação, ver MOTIVOS_COM_FILA_DE_RECUPERACAO).
   */
  const responderSolicitacaoReforco = useCallback(
    async (id: string, decisao: { atender: boolean; militarId?: string }) => {
      const db = requireDb();
      const solicitacao = solicitacoesReforco.find((s) => s.id === id);
      if (!solicitacao) throw new Error('Solicitação de reforço não encontrada.');

      if (decisao.atender) {
        const militarFinal = decisao.militarId ?? solicitacao.militarSugeridoId;
        if (!militarFinal) throw new Error('Nenhum militar selecionado pra atender essa solicitação.');
        if (extraordinariasNoMes(militarFinal, solicitacao.data, escalasExtraordinarias, afastamentos) >= LIMITE_EXTRAORDINARIAS_POR_MES) {
          throw new Error(`Esse militar já atingiu o limite de ${LIMITE_EXTRAORDINARIAS_POR_MES} extraordinárias no mês.`);
        }

        const comando = comandos.find((c) => c.id === solicitacao.comandoId);
        await addDoc(collection(db, 'afastamentos'), {
          militarId: militarFinal,
          ubmId: solicitacao.ubmId,
          motivo: 'reforco_crb_cop',
          detalhe: `${comando ? `${comando.sigla} — ` : ''}${solicitacao.motivo}`,
          dataInicio: solicitacao.data,
          dataFim: solicitacao.data,
          origemReforcoId: id,
          criadoPorId: usuarioAtual?.id ?? '',
          criado_em: new Date().toISOString(),
        });

        await updateDoc(doc(db, 'solicitacoes_reforco', id), {
          status: 'atendida' as StatusSolicitacaoReforco,
          militarId: militarFinal,
          atendidoPorId: usuarioAtual?.id ?? '',
          atendido_em: new Date().toISOString(),
        });

        // Só a partir de agora o CRB/COP passa a enxergar o militar — antes
        // de atendida, a sugestão automática (militarSugeridoId) fica visível
        // só pra UBM. E o militar já entra na "escala do comando" com a
        // indicação de qual UBM o cedeu.
        const funcaoNome = funcoes.find((f) => f.id === solicitacao.funcao)?.nome ?? 'Função removida';
        await addDoc(collection(db, 'escalas_comando'), {
          comandoId: solicitacao.comandoId,
          militarId: militarFinal,
          ubmOrigemId: solicitacao.ubmId,
          funcaoNome,
          data: solicitacao.data,
          motivo: solicitacao.motivo,
          origemReforcoId: id,
          criado_em: new Date().toISOString(),
        });

        const usuarioMilitar = usuarios.find((u) => u.militarId === militarFinal);
        if (usuarioMilitar) {
          await notificar(
            usuarioMilitar.id,
            'reforco_atendido',
            'Você foi empenhado num reforço solicitado pelo CRB/COP.',
            '/sistema/afastamentos',
          );
        }
      } else {
        await updateDoc(doc(db, 'solicitacoes_reforco', id), {
          status: 'recusada' as StatusSolicitacaoReforco,
          atendidoPorId: usuarioAtual?.id ?? '',
          atendido_em: new Date().toISOString(),
        });
      }

      const comandoUsuarios = usuarios.filter(
        (u) => u.comandoId === solicitacao.comandoId && (u.papeis?.includes('crb') || u.papeis?.includes('cop')),
      );
      const mensagem = decisao.atender ? 'A UBM atendeu sua solicitação de reforço.' : 'A UBM recusou sua solicitação de reforço.';
      await Promise.all(comandoUsuarios.map((u) => notificar(u.id, 'reforco_atendido', mensagem, '/sistema/reforcos')));
    },
    [solicitacoesReforco, comandos, usuarios, funcoes, escalasExtraordinarias, usuarioAtual, notificar],
  );

  // --- Escala diferenciada ---------------------------------------------------
  const criarEscalaDiferenciada = useCallback(
    async (dados: { militarId: string; ubmId: string; funcao: string; data: string; observacao?: string }) => {
      const db = requireDb();
      const agora = new Date().toISOString();

      // Se já existe uma escala ordinária nesse dia/função (de uma geração
      // anterior), o dia diferenciado assume esse mesmo registro em vez de
      // duplicar — só um militar por dia/função.
      const existente = escalasOrdinarias.find(
        (e) => e.ubmId === dados.ubmId && e.funcao === dados.funcao && e.data === dados.data,
      );

      let escalaOrdinariaId: string;
      if (existente) {
        escalaOrdinariaId = existente.id;
        await updateDoc(doc(db, 'escalas_ordinarias', existente.id), {
          militarId: dados.militarId,
          origem: 'diferenciada',
        });
      } else {
        const refOrdinaria = await addDoc(collection(db, 'escalas_ordinarias'), {
          ubmId: dados.ubmId,
          funcao: dados.funcao,
          data: dados.data,
          militarId: dados.militarId,
          origem: 'diferenciada',
          criado_em: agora,
        });
        escalaOrdinariaId = refOrdinaria.id;
      }

      await addDoc(collection(db, 'escalas_diferenciadas'), {
        ...semIndefinidosParaCriar(dados),
        escalaOrdinariaId,
        criadoPorId: usuarioAtual?.id ?? '',
        criado_em: agora,
      });
    },
    [usuarioAtual, escalasOrdinarias],
  );

  const atualizarEscalaDiferenciada = useCallback(
    async (id: string, dados: { militarId?: string; funcao?: string; data?: string; observacao?: string }) => {
      const db = requireDb();
      const atual = escalasDiferenciadas.find((e) => e.id === id);
      if (!atual) throw new Error('Escala diferenciada não encontrada.');

      await updateDoc(doc(db, 'escalas_diferenciadas', id), semIndefinidosParaAtualizar(dados));
      await updateDoc(
        doc(db, 'escalas_ordinarias', atual.escalaOrdinariaId),
        semIndefinidosParaAtualizar({ militarId: dados.militarId, funcao: dados.funcao, data: dados.data }),
      );
    },
    [escalasDiferenciadas],
  );

  const removerEscalaDiferenciada = useCallback(
    async (id: string) => {
      const db = requireDb();
      const atual = escalasDiferenciadas.find((e) => e.id === id);
      if (atual) {
        await deleteDoc(doc(db, 'escalas_ordinarias', atual.escalaOrdinariaId)).catch(() => undefined);
      }
      await deleteDoc(doc(db, 'escalas_diferenciadas', id));
    },
    [escalasDiferenciadas],
  );

  // --- Fechamento / Histórico de escala --------------------------------------
  const fecharEscalaSemana = useCallback(
    async (params: { ubmId: string; tipo: TipoEscalaServico; semanaInicio: string }) => {
      const db = requireDb();
      const docId = `${params.ubmId}_${params.tipo}_${params.semanaInicio}`;
      const atual = fechamentosEscala.find((f) => f.id === docId);
      const novaVersao = (atual?.versaoAtual ?? 0) + 1;
      const agora = new Date().toISOString();

      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${params.semanaInicio}T00:00:00`);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
      const escalas = params.tipo === 'ordinaria' ? escalasOrdinarias : escalasExtraordinarias;
      const linhas = escalas
        .filter((e) => e.ubmId === params.ubmId && dias.includes(e.data))
        .map((e) => ({
          funcaoId: e.funcao,
          funcaoNome: funcoes.find((f) => f.id === e.funcao)?.nome ?? 'Função removida',
          data: e.data,
          militarNome: (() => {
            const militar = militares.find((m) => m.id === e.militarId);
            return militar ? `${militar.posto} ${militar.nome}`.trim() : 'Militar removido';
          })(),
          ...('motivo' in e && e.motivo ? { motivo: e.motivo } : {}),
        }));

      await setDoc(
        doc(db, 'fechamentos_escala', docId),
        {
          ubmId: params.ubmId,
          tipo: params.tipo,
          semanaInicio: params.semanaInicio,
          travada: true,
          versaoAtual: novaVersao,
          fechadoPorId: usuarioAtual?.id ?? '',
          fechado_em: agora,
        },
        { merge: true },
      );

      await addDoc(collection(db, 'historico_escalas'), {
        ubmId: params.ubmId,
        tipo: params.tipo,
        semanaInicio: params.semanaInicio,
        versao: novaVersao,
        linhas,
        fechadoPorId: usuarioAtual?.id ?? '',
        fechado_em: agora,
      });
    },
    [fechamentosEscala, escalasOrdinarias, escalasExtraordinarias, funcoes, militares, usuarioAtual],
  );

  const reabrirEscalaSemana = useCallback(
    async (params: { ubmId: string; tipo: TipoEscalaServico; semanaInicio: string }) => {
      const db = requireDb();
      const docId = `${params.ubmId}_${params.tipo}_${params.semanaInicio}`;
      await setDoc(
        doc(db, 'fechamentos_escala', docId),
        {
          ubmId: params.ubmId,
          tipo: params.tipo,
          semanaInicio: params.semanaInicio,
          travada: false,
          reabertoPorId: usuarioAtual?.id ?? '',
          reaberto_em: new Date().toISOString(),
        },
        { merge: true },
      );
    },
    [usuarioAtual],
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

  // --- Solicitações de serviço (Autorização de Substituição) ---------------
  const criarSolicitacaoServico = useCallback(
    async (dados: {
      ubmId: string;
      modalidade: ModalidadeSolicitacaoServico;
      horarioParcial?: string;
      localEvento?: string;
      escalaOrigemId: string;
      tipoEscalaOrigem: TipoEscalaServico;
      indicadoId: string;
      motivo?: string;
    }) => {
      const db = requireDb();
      const ref = await addDoc(collection(db, 'solicitacoes_servico'), {
        ...semIndefinidosParaCriar(dados),
        solicitanteId: usuarioAtual?.id ?? '',
        status: 'aguardando_indicado' as StatusSolicitacaoServico,
        criado_em: new Date().toISOString(),
      });

      const indicado = usuarios.find((u) => u.id === dados.indicadoId);
      if (indicado) {
        await notificar(
          indicado.id,
          'solicitacao_servico',
          'Você recebeu um pedido de autorização de substituição de escala.',
          `/sistema/solicitacoes`,
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
        status: aceitar ? 'aguardando_aprovacao' : 'recusada_indicado',
        respondido_em: new Date().toISOString(),
      });

      const aprovadores = usuarios.filter(
        (u) => u.ubmId === solicitacao.ubmId && (u.papeis?.includes('escalante') || u.papeis?.includes('comandante')),
      );
      const solicitante = usuarios.find((u) => u.id === solicitacao.solicitanteId);

      if (aceitar) {
        await Promise.all(
          aprovadores.map((a) =>
            notificar(a.id, 'aprovacao_escalante', 'Uma autorização de substituição aguarda sua aprovação.', `/sistema/solicitacoes`),
          ),
        );
      } else if (solicitante) {
        await notificar(solicitante.id, 'solicitacao_servico', 'Seu pedido de autorização de substituição foi recusado pelo militar indicado.');
      }
    },
    [solicitacoesServico, usuarios, notificar],
  );

  /** Aprovação final — pelo Comandante OU pelo Escalante da UBM. NUNCA altera o registro de escala gerado pelo sistema (ver nota em types.ts): só o escalante muda a escala, e sempre manualmente. */
  const responderSolicitacaoAprovador = useCallback(
    async (id: string, aprovar: boolean) => {
      const db = requireDb();
      const solicitacao = solicitacoesServico.find((s) => s.id === id);
      if (!solicitacao) throw new Error('Solicitação não encontrada.');

      await updateDoc(doc(db, 'solicitacoes_servico', id), {
        status: aprovar ? 'aprovada' : 'recusada_aprovacao',
        aprovadoPorId: usuarioAtual?.id ?? '',
        respondido_em: new Date().toISOString(),
      });

      const solicitante = usuarios.find((u) => u.id === solicitacao.solicitanteId);
      const indicado = usuarios.find((u) => u.id === solicitacao.indicadoId);
      const mensagem = aprovar
        ? 'Sua autorização de substituição foi aprovada — o PDF já pode ser gerado. A escala do sistema não muda automaticamente; no dia, o CMT de SOS registra a presença do substituto.'
        : 'Seu pedido de autorização de substituição foi recusado.';
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

  const deleteAlerta = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'alertas', id));
  }, []);

  const valor = useMemo<AppContextData>(
    () => ({
      ubms,
      comandos,
      usuarios,
      militares,
      funcoes,
      escalasOrdinarias,
      escalasExtraordinarias,
      escalasDiferenciadas,
      vagasVoluntariasExtraordinarias,
      afastamentos,
      presencas,
      solicitacoesServico,
      solicitacoesReforco,
      escalasComando,
      fechamentosEscala,
      historicoEscalas,
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
      buscarMilitaresEfetivoPorNome,
      primeiroAcessoPorMatricula,
      addUbm,
      updateUbm,
      addComando,
      updateComando,
      deleteComando,
      vincularUbmAoComando,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addMilitar,
      importarMilitaresCsv,
      updateMilitar,
      transferirMilitarDeUbm,
      deleteMilitar,
      addFuncao,
      updateFuncao,
      deleteFuncao,
      moverOrdemFuncao,
      gerarEPersistirEscalaOrdinaria,
      updateEscalaOrdinaria,
      moverDataEscalaOrdinaria,
      adicionarEscalaOrdinaria,
      deleteEscalaOrdinaria,
      criarEscalaExtraordinaria,
      alterarMilitarExtraordinaria,
      deleteEscalaExtraordinaria,
      dispararVagaVoluntariaExtraordinaria,
      voluntariarParaVaga,
      resolverVagaCompulsoriamente,
      criarEscalaDiferenciada,
      atualizarEscalaDiferenciada,
      removerEscalaDiferenciada,
      fecharEscalaSemana,
      reabrirEscalaSemana,
      addAfastamento,
      deleteAfastamento,
      registrarPresenca,
      criarSolicitacaoServico,
      responderSolicitacaoIndicado,
      responderSolicitacaoAprovador,
      criarSolicitacaoReforco,
      responderSolicitacaoReforco,
      marcarAlertaLida,
      deleteAlerta,
    }),
    [
      ubms,
      comandos,
      usuarios,
      militares,
      funcoes,
      escalasOrdinarias,
      escalasExtraordinarias,
      escalasDiferenciadas,
      vagasVoluntariasExtraordinarias,
      afastamentos,
      presencas,
      solicitacoesServico,
      solicitacoesReforco,
      escalasComando,
      fechamentosEscala,
      historicoEscalas,
      alertas,
      usuarioAtual,
      isAuthenticated,
      carregandoAuth,
      login,
      logout,
      solicitarAcesso,
      enviarResetSenha,
      validarMatriculaEfetivo,
      buscarMilitaresEfetivoPorNome,
      primeiroAcessoPorMatricula,
      addUbm,
      updateUbm,
      addComando,
      updateComando,
      deleteComando,
      vincularUbmAoComando,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addMilitar,
      importarMilitaresCsv,
      updateMilitar,
      transferirMilitarDeUbm,
      deleteMilitar,
      addFuncao,
      updateFuncao,
      deleteFuncao,
      moverOrdemFuncao,
      gerarEPersistirEscalaOrdinaria,
      updateEscalaOrdinaria,
      moverDataEscalaOrdinaria,
      adicionarEscalaOrdinaria,
      deleteEscalaOrdinaria,
      criarEscalaExtraordinaria,
      alterarMilitarExtraordinaria,
      deleteEscalaExtraordinaria,
      dispararVagaVoluntariaExtraordinaria,
      voluntariarParaVaga,
      resolverVagaCompulsoriamente,
      criarEscalaDiferenciada,
      atualizarEscalaDiferenciada,
      removerEscalaDiferenciada,
      fecharEscalaSemana,
      reabrirEscalaSemana,
      addAfastamento,
      deleteAfastamento,
      registrarPresenca,
      criarSolicitacaoServico,
      responderSolicitacaoIndicado,
      responderSolicitacaoAprovador,
      criarSolicitacaoReforco,
      responderSolicitacaoReforco,
      marcarAlertaLida,
      deleteAlerta,
    ],
  );

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
