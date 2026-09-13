// ---------------------------------------------------------------------------
// Papéis de acesso (RBAC). Comandante e Escalante podem coexistir na mesma
// pessoa (mesmo login com os dois papéis) — por isso `papeis` é um array, e
// não um campo único. Um usuário sem 'comandante'/'escalante'/'master' é
// tratado como Militar (usuário comum): só consulta a própria escala e faz
// solicitações.
//
// 'master' é o único papel sem vínculo com uma UBM específica: é quem define
// quem é Comandante/Escalante de cada UBM (esses podem mudar) e cadastra as
// próprias UBMs — só o master atribui ou remove os papéis 'master',
// 'comandante' e 'escalante' de qualquer usuário. Um usuário master tem
// `ubmId: ''` (nenhuma UBM), já que atua no CBMPA como um todo.
// ---------------------------------------------------------------------------
export type Papel = 'master' | 'comandante' | 'escalante' | 'militar';

export const PAPEL_LABELS: Record<Papel, string> = {
  master: 'Master (CBMPA)',
  comandante: 'Comandante da UBM',
  escalante: 'Escalante',
  militar: 'Militar (usuário comum)',
};

/** Papéis cuja atribuição é exclusiva do master (ver nota acima). */
export const PAPEIS_RESTRITOS_AO_MASTER: Papel[] = ['master', 'comandante', 'escalante'];

export interface Usuario {
  id: string;
  /** Nome completo (vem da planilha de efetivo, quando o cadastro é por matrícula). */
  nome: string;
  /** Nome de guerra — como o militar é chamado no dia a dia. */
  nomeGuerra?: string;
  email: string;
  /**
   * Matrícula (MF) do efetivo, quando o cadastro foi feito pelo fluxo de
   * primeiro acesso por matrícula. Espelhada em `matriculas/{matricula}`
   * (coleção pública mínima, só matrícula → email) para permitir login por
   * matrícula sem expor o restante do perfil a quem não está autenticado.
   */
  matricula?: string;
  /** Vazio ('') para o papel 'master', que não pertence a nenhuma UBM específica. */
  ubmId: string;
  papeis: Papel[];
  /** Vínculo com o cadastro de efetivo (Militar), quando o usuário também é escalado. */
  militarId?: string;
  cargo?: string;
  ativo: boolean;
  criado_em?: string;
}

export function temPapel(usuario: Usuario | null, papel: Papel): boolean {
  return !!usuario?.papeis?.includes(papel);
}

// ---------------------------------------------------------------------------
// UBM (Unidade de Bombeiro Militar)
// ---------------------------------------------------------------------------
export interface Ubm {
  id: string;
  nome: string;
  sigla: string;
  /** Brasão da UBM (data URL, já redimensionado) — mostrado no painel da unidade após o login. */
  logoDataUrl?: string;
}

// ---------------------------------------------------------------------------
// Efetivo / Militar
//
// Cada UBM cadastra suas próprias funções operacionais (coleção `funcoes`,
// gerenciada pelo escalante/comandante da UBM) — não existe mais uma lista
// fixa de funções válida pra todo o CBMPA, porque cada unidade tem suas
// peculiaridades. `Militar.funcoes` e `funcao` em `EscalaOrdinaria`/
// `EscalaExtraordinaria` guardam o id do documento em `funcoes`, não mais uma
// chave fixa. `FUNCOES_PADRAO` só é usado como semente ao criar uma UBM nova
// (e para migrar as UBMs que já existiam antes desta mudança).
// ---------------------------------------------------------------------------
export const FUNCOES_PADRAO: string[] = [
  'Condutor',
  'Comandante de Socorro (CMT de SOS)',
  'Socorrista',
  'Componente de Guarnição',
  'Outro',
];

export interface FuncaoUbm {
  id: string;
  ubmId: string;
  nome: string;
  ativa: boolean;
  criado_em: string;
}

/** Uma UBM anterior no histórico do militar — suporta transferência entre UBMs. */
export interface VinculoUbm {
  ubmId: string;
  dataInicio: string;
  dataFim: string | null;
}

export interface Militar {
  id: string;
  nome: string;
  posto: string;
  matricula: string;
  /** UBM atual (vínculo em aberto no histórico). */
  ubmId: string;
  historicoUbm: VinculoUbm[];
  /** Ids de `FuncaoUbm` — um militar pode acumular mais de uma função. */
  funcoes: string[];
  ativo: boolean;
  origemCadastro: 'planilha' | 'manual';
  criado_em: string;
  atualizado_em: string;
}

// ---------------------------------------------------------------------------
// Escala ordinária
// ---------------------------------------------------------------------------
export interface EscalaOrdinaria {
  id: string;
  ubmId: string;
  /** Id de `FuncaoUbm`. */
  funcao: string;
  data: string; // yyyy-MM-dd
  militarId: string;
  origem: 'gerada' | 'manual';
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Escala extraordinária
// ---------------------------------------------------------------------------
export interface EscalaExtraordinaria {
  id: string;
  ubmId: string;
  /** Id de `FuncaoUbm`. */
  funcao: string;
  data: string;
  motivo: string;
  /** Militar apontado pelo algoritmo de rodízio (nunca sobrescrito). */
  militarSugeridoId: string;
  /** Militar efetivamente escalado — pode ter sido alterado pelo escalante. */
  militarId: string;
  criadoPorId: string;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Escala diferenciada (a pedido do militar)
// ---------------------------------------------------------------------------
export interface EscalaDiferenciada {
  id: string;
  militarId: string;
  ubmId: string;
  data: string;
  observacao?: string;
  criado_em: string;
}

export type StatusSolicitacaoAlteracao = 'pendente' | 'aprovada' | 'recusada';

/** Alteração de escala diferenciada pelo escalante — exige autorização do Comandante. */
export interface SolicitacaoAlteracaoDiferenciada {
  id: string;
  escalaDiferenciadaId: string;
  militarId: string;
  ubmId: string;
  solicitanteId: string;
  motivo: string;
  status: StatusSolicitacaoAlteracao;
  criado_em: string;
  resolvido_em?: string;
  resolvidoPorId?: string;
}

// ---------------------------------------------------------------------------
// Afastamentos
// ---------------------------------------------------------------------------
export type MotivoAfastamento =
  | 'ferias'
  | 'licenca'
  | 'dispensa_medica'
  | 'atestado_medico'
  | 'missao_externa'
  | 'outro';

export const MOTIVO_AFASTAMENTO_LABELS: Record<MotivoAfastamento, string> = {
  ferias: 'Férias',
  licenca: 'Licença',
  dispensa_medica: 'Dispensa médica',
  atestado_medico: 'Atestado médico',
  missao_externa: 'Missão externa',
  outro: 'Outro',
};

/**
 * Motivos de afastamento que geram fila de recuperação (ver nota em
 * `src/lib/escala.ts`): a pessoa segue "devendo" o serviço e é priorizada
 * ao voltar. Dispensa médica é autorizada pela junta médica e NÃO entra
 * aqui — só o atestado médico comum (avaliação isolada, sem passar pela
 * junta) e a missão externa geram essa fila.
 */
export const MOTIVOS_COM_FILA_DE_RECUPERACAO: MotivoAfastamento[] = ['atestado_medico', 'missao_externa'];

export interface Afastamento {
  id: string;
  militarId: string;
  ubmId: string;
  motivo: MotivoAfastamento;
  detalhe?: string;
  dataInicio: string;
  dataFim: string;
  criadoPorId: string;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Presença (tela do CMT de SOS)
// ---------------------------------------------------------------------------
export type StatusPresenca = 'presente' | 'atrasado' | 'dispensa' | 'falta' | 'outro';

export const STATUS_PRESENCA_LABELS: Record<StatusPresenca, string> = {
  presente: 'Presente',
  atrasado: 'Atrasado',
  dispensa: 'Dispensa',
  falta: 'Falta',
  outro: 'Outro',
};

export type TipoEscalaServico = 'ordinaria' | 'extraordinaria';

export interface RegistroPresenca {
  id: string;
  ubmId: string;
  escalaId: string;
  tipoEscala: TipoEscalaServico;
  data: string;
  militarId: string;
  status: StatusPresenca;
  observacao?: string;
  registradoPorId: string;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Autorização de Serviço (substituição) e Permuta
// ---------------------------------------------------------------------------
export type TipoSolicitacaoServico = 'substituicao' | 'permuta';

export type StatusSolicitacaoServico =
  | 'aguardando_indicado'
  | 'aguardando_escalante'
  | 'aprovada'
  | 'recusada_indicado'
  | 'recusada_escalante';

export const STATUS_SOLICITACAO_LABELS: Record<StatusSolicitacaoServico, string> = {
  aguardando_indicado: 'Aguardando aceite do indicado',
  aguardando_escalante: 'Aguardando aprovação do escalante',
  aprovada: 'Aprovada',
  recusada_indicado: 'Recusada pelo indicado',
  recusada_escalante: 'Recusada pelo escalante',
};

export interface SolicitacaoServico {
  id: string;
  ubmId: string;
  tipo: TipoSolicitacaoServico;
  /** Escala (ordinária/extraordinária) do solicitante que originou o pedido. */
  escalaOrigemId: string;
  tipoEscalaOrigem: TipoEscalaServico;
  /** Só em permuta: a escala do indicado que será trocada. */
  escalaDestinoId?: string;
  solicitanteId: string;
  indicadoId: string;
  status: StatusSolicitacaoServico;
  motivo?: string;
  criado_em: string;
  respondido_em?: string;
  aprovadoPorId?: string;
}

// ---------------------------------------------------------------------------
// Alertas / notificações
// ---------------------------------------------------------------------------
export type TipoAlerta =
  | 'solicitacao_servico'
  | 'aceite_indicado'
  | 'aprovacao_escalante'
  | 'alteracao_diferenciada'
  | 'geral';

export interface Alerta {
  id: string;
  usuarioId: string;
  tipo: TipoAlerta;
  mensagem: string;
  link?: string;
  lida: boolean;
  criado_em: string;
}
