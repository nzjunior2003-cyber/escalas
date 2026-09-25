// ---------------------------------------------------------------------------
// Papéis de acesso (RBAC). Comandante e Escalante podem coexistir na mesma
// pessoa (mesmo login com os dois papéis) — por isso `papeis` é um array, e
// não um campo único. Um usuário sem 'comandante'/'escalante'/'master'/
// 'crb'/'cop' é tratado como Militar (usuário comum): só consulta a própria
// escala e faz solicitações.
//
// 'master' é o único papel sem vínculo com uma UBM específica: é quem define
// quem é Comandante/Escalante de cada UBM (esses podem mudar) e cadastra as
// próprias UBMs — só o master atribui ou remove os papéis 'master',
// 'comandante', 'escalante', 'crb' e 'cop' de qualquer usuário. Um usuário
// master tem `ubmId: ''` (nenhuma UBM), já que atua no CBMPA como um todo.
//
// 'crb' (Comando Regional de Bombeiros) e 'cop' (Comando de Operações)
// também não pertencem a uma UBM (ubmId: ''), mas sim a um `Comando` (ver
// abaixo) vinculado a várias UBMs — é dali que disparam solicitação de
// reforço de militares pras UBMs vinculadas.
// ---------------------------------------------------------------------------
export type Papel = 'master' | 'comandante' | 'escalante' | 'militar' | 'crb' | 'cop';

export const PAPEL_LABELS: Record<Papel, string> = {
  master: 'Master (CBMPA)',
  comandante: 'Comandante da UBM',
  escalante: 'Escalante',
  militar: 'Militar (usuário comum)',
  crb: 'CRB (Comando Regional de Bombeiros)',
  cop: 'COP (Comando de Operações)',
};

/** Papéis cuja atribuição é exclusiva do master (ver nota acima). */
export const PAPEIS_RESTRITOS_AO_MASTER: Papel[] = ['master', 'comandante', 'escalante', 'crb', 'cop'];

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
  /** Vazio ('') para os papéis 'master', 'crb' e 'cop', que não pertencem a uma UBM específica. */
  ubmId: string;
  papeis: Papel[];
  /** Vínculo com o cadastro de efetivo (Militar), quando o usuário também é escalado. */
  militarId?: string;
  /** Vínculo com o Comando (CRB/COP), só quando papeis inclui 'crb' ou 'cop'. */
  comandoId?: string;
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
  /** Brasão da UBM (data URL, já redimensionado) — mostrado no painel da unidade após o login e no rodapé do PDF de escala. */
  logoDataUrl?: string;
  /** Dados de contato — mostrados em itálico no rodapé do PDF de escala, ao lado do brasão. */
  endereco?: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
  email?: string;
  telefone?: string;
  /**
   * Confirmado manualmente pelo escalante/comandante quando termina de
   * cadastrar todo o efetivo da UBM em `Militar` — enquanto for `false`
   * (ou ausente), a geração automática de previsões futuras de escala
   * ordinária fica bloqueada (ver `previsaoLiberada` em `lib/escala.ts`):
   * a ideia é a primeira semana real ser sempre montada manualmente antes
   * do sistema começar a prever sozinho. Ação de mão única — não há botão
   * pra desmarcar depois de confirmado.
   */
  efetivoCompleto?: boolean;
}

// ---------------------------------------------------------------------------
// Comando (CRB ou COP) — cadastrado pelo master, vinculado a várias UBMs.
// CRB e COP são paralelos entre si (nenhuma hierarquia um sobre o outro);
// cada um dispara solicitação de reforço direto pras UBMs que tem vinculadas.
// ---------------------------------------------------------------------------
export type TipoComando = 'crb' | 'cop';

export const TIPO_COMANDO_LABELS: Record<TipoComando, string> = {
  crb: 'CRB — Comando Regional de Bombeiros',
  cop: 'COP — Comando de Operações',
};

export interface Comando {
  id: string;
  tipo: TipoComando;
  nome: string;
  sigla: string;
  /** UBMs vinculadas a este comando — só pra elas ele pode disparar solicitação de reforço. */
  ubmIds: string[];
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
  /** Posição de exibição entre as funções da mesma UBM (menor primeiro) — reordenável pelo escalante. */
  ordem?: number;
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
  /** Nome de guerra — como o militar é chamado no dia a dia. Editável pelo escalante em Efetivo; usado nos cartões da escala (posto + nome de guerra) pra caber mais gente sem cortar o texto. */
  nomeGuerra?: string;
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
// Remanejamento/alteração de função — o próprio militar solicita ao
// escalante da UBM (não se aplica sozinho: exige aprovação).
// ---------------------------------------------------------------------------
export type StatusRemanejamento = 'pendente' | 'aprovado' | 'rejeitado';

export const STATUS_REMANEJAMENTO_LABELS: Record<StatusRemanejamento, string> = {
  pendente: 'Aguardando análise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export interface SolicitacaoRemanejamento {
  id: string;
  ubmId: string;
  militarId: string;
  /** Id de `Usuario` de quem fez o pedido (sempre o próprio militar). */
  solicitanteId: string;
  /** Id de `FuncaoUbm` desejada — pode ser uma função nova (acúmulo) ou pedido de deixar de exercer uma das atuais. */
  funcaoDesejadaId: string;
  motivo: string;
  status: StatusRemanejamento;
  criado_em: string;
  respondidoPorId?: string;
  respondido_em?: string;
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
  /** 'diferenciada': espelhada automaticamente de uma EscalaDiferenciada (ver nota abaixo). */
  origem: 'gerada' | 'manual' | 'diferenciada';
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
  /** Preenchido quando essa escala veio de uma VagaVoluntariaExtraordinaria (ver nota abaixo). */
  vagaVoluntariaId?: string;
  criadoPorId: string;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Vaga voluntária de escala extraordinária
//
// Extraordinária é voluntária por natureza — só vira escalação compulsória se
// não aparecerem voluntários suficientes. O escalante dispara a vaga (função
// + data + motivo + quantidade de militares necessários) com um prazo pro
// efetivo elegível se voluntariar; todo mundo elegível recebe alerta. Cada
// voluntário que aparece já ocupa uma das `quantidade` posições na hora —
// sem esperar os demais nem o prazo — até a vaga ficar cheia.
//
// Elegibilidade pra essa vaga (`candidatosElegiveisIds`, calculada no
// disparo): função ativa na UBM, sem afastamento na data, sob o teto mensal
// de `LIMITE_EXTRAORDINARIAS_POR_MES`, e — o requisito central — pelo menos
// 24h de folga desde o serviço (ordinária ou extraordinária) anterior (ver
// `temFolga24hAntes`).
//
// Se o prazo vencer com posições sobrando, o escalante resolve
// compulsoriamente as que faltam: pega, dentre os elegíveis que não se
// voluntariaram, os mais bem-ranqueados pelo motor de equidade de sempre
// (menos serviços = "mais folgado" primeiro; empatados em folga, desempata
// por hierarquia — mais moderno primeiro: CB/SD antes de Sargento/Subtenente
// — e ainda empatado, por há-mais-tempo-sem-reforço). A hierarquia NUNCA
// decide sozinha: só entra quando duas ou mais pessoas já estão empatadas em
// folga — entre folga e hierarquia divergentes, a folga sempre vence.
// ---------------------------------------------------------------------------
export type StatusVagaVoluntaria = 'aberta' | 'preenchida' | 'expirada_compulsoria';

export const STATUS_VAGA_VOLUNTARIA_LABELS: Record<StatusVagaVoluntaria, string> = {
  aberta: 'Aguardando voluntário',
  preenchida: 'Preenchida por voluntário(s)',
  expirada_compulsoria: 'Prazo esgotado — completada compulsoriamente',
};

export interface VagaVoluntariaExtraordinaria {
  id: string;
  ubmId: string;
  /** Id de `FuncaoUbm`. */
  funcao: string;
  data: string; // yyyy-MM-dd do serviço
  motivo: string;
  /** yyyy-MM-dd — até quando o sistema aceita voluntários pra essa vaga. */
  prazo: string;
  /** Quantos militares essa vaga precisa (pode ser mais de um). */
  quantidade: number;
  status: StatusVagaVoluntaria;
  /** Pool notificado ao disparar — únicos elegíveis a se voluntariar. */
  candidatosElegiveisIds: string[];
  /** Ordem de quem se voluntariou (máximo `quantidade`). */
  voluntariosIds: string[];
  /** Preenchido só quando o prazo vence com posições sobrando — quem completou compulsoriamente. */
  militaresCompulsoriosIds?: string[];
  criadoPorId: string;
  criado_em: string;
  resolvido_em?: string;
}

// ---------------------------------------------------------------------------
// Reforço de operação (CRB/COP) — um único pedido em massa (ex.: 25
// militares pra prevenção num jogo) distribuído automaticamente entre as
// UBMs subordinadas ao comando, proporcional ao efetivo ativo de cada uma
// (método dos maiores restos, pra bater a soma exata sem editar depois).
// Sem função obrigatória: qualquer militar ativo da UBM é elegível — é
// sempre reforço tipo 'missao' (orçamento próprio, não conta no teto de
// LIMITE_EXTRAORDINARIAS_POR_MES, vira afastamento com fila de recuperação).
// Cada UBM recebe sua cota (`cotas`) mas quem decide quando abrir
// voluntariado pros próprios militares é o escalante dela — ver
// `VagaVoluntariaOperacao`.
// ---------------------------------------------------------------------------
export interface CotaOperacaoUbm {
  ubmId: string;
  quantidade: number;
}

export interface SolicitacaoOperacao {
  id: string;
  comandoId: string;
  /** Nome do evento/operação (ex.: "Jogo Brasileirão - Mangueirão"). */
  motivo: string;
  data: string; // yyyy-MM-dd
  /** Prazo sugerido pro voluntariado — cada UBM pode disparar o próprio antes ou depois, é só uma referência. */
  prazo: string;
  quantidadeTotal: number;
  cotas: CotaOperacaoUbm[];
  criadoPorId: string;
  criado_em: string;
}

export type StatusVagaOperacao = 'aberta' | 'preenchida' | 'expirada_compulsoria';

export const STATUS_VAGA_OPERACAO_LABELS: Record<StatusVagaOperacao, string> = {
  aberta: 'Aguardando voluntário',
  preenchida: 'Preenchida por voluntário(s)',
  expirada_compulsoria: 'Prazo esgotado — completada compulsoriamente',
};

export interface VagaVoluntariaOperacao {
  id: string;
  operacaoId: string;
  ubmId: string;
  comandoId: string;
  motivo: string;
  data: string;
  prazo: string;
  quantidade: number;
  status: StatusVagaOperacao;
  /** Todo militar ativo da UBM no momento do disparo (sem exigência de função). */
  candidatosElegiveisIds: string[];
  voluntariosIds: string[];
  militaresCompulsoriosIds?: string[];
  criadoPorId: string;
  criado_em: string;
  resolvido_em?: string;
}

// ---------------------------------------------------------------------------
// Escala diferenciada — militares que só podem servir em dias específicos.
//
// O escalante cadastra o militar/função/data; ao criar, o sistema já gera o
// registro espelho em EscalaOrdinaria (origem 'diferenciada') apontado por
// `escalaOrdinariaId` — é esse espelho que aparece no Kanban normal, entra
// na conta de equidade e sai no PDF junto com todo mundo. Depois de
// cadastrada, só o Comandante da UBM pode alterar ou remover (edição direta,
// sem fluxo de solicitação/aprovação).
// ---------------------------------------------------------------------------
export interface EscalaDiferenciada {
  id: string;
  militarId: string;
  ubmId: string;
  /** Id de `FuncaoUbm`. */
  funcao: string;
  data: string;
  observacao?: string;
  /** EscalaOrdinaria espelhada — criada junto (ver nota acima). */
  escalaOrdinariaId: string;
  criadoPorId: string;
  criado_em: string;
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
  | 'reforco_crb_cop'
  | 'outro';

export const MOTIVO_AFASTAMENTO_LABELS: Record<MotivoAfastamento, string> = {
  ferias: 'Férias',
  licenca: 'Licença',
  dispensa_medica: 'Dispensa médica',
  atestado_medico: 'Atestado médico',
  missao_externa: 'Missão externa',
  reforco_crb_cop: 'Reforço (CRB/COP)',
  outro: 'Outro',
};

/**
 * Motivos de afastamento que geram fila de recuperação (ver nota em
 * `src/lib/escala.ts`): a pessoa segue "devendo" o serviço e é priorizada
 * ao voltar. Dispensa médica é autorizada pela junta médica e NÃO entra
 * aqui — só o atestado médico comum (avaliação isolada, sem passar pela
 * junta) e a missão externa geram essa fila (a pessoa seguiu servindo, só
 * que fora da rotação normal da própria UBM). O reforço pra CRB/COP
 * (`reforco_crb_cop`) fica de fora de propósito: quando é pra cobrir uma
 * extraordinária comum, o militar só está servindo emprestado a outro
 * comando — trata-se como descanso reconhecido, sem dívida (ver nota em
 * `SolicitacaoReforco`, tipo 'escala_extraordinaria'); reforço pra missão/
 * operação usa o motivo `missao_externa` diretamente, esse sim com fila.
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
  /** Preenchido quando o afastamento foi gerado automaticamente ao atender uma SolicitacaoReforco. */
  origemReforcoId?: string;
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

// ---------------------------------------------------------------------------
// Fechamento / Histórico de escala
//
// "Fechar" uma semana é o que libera o PDF (ver Relatórios/Histórico) — só
// existe um doc por (ubmId, tipo, semanaInicio), com id determinístico
// `${ubmId}_${tipo}_${semanaInicio}`, guardando se está travada pra edição
// agora. O escalante pode reabrir livremente pra editar de novo; cada vez
// que fecha (a primeira ou depois de reabrir e editar), gera uma nova
// entrada em HistoricoEscala com uma foto congelada de quem estava escalado
// naquele momento, pra sempre refletir o que de fato foi publicado em cada
// versão, mesmo que a escala mude depois de reaberta.
// ---------------------------------------------------------------------------
export interface FechamentoEscala {
  id: string;
  ubmId: string;
  tipo: TipoEscalaServico;
  semanaInicio: string;
  travada: boolean;
  versaoAtual: number;
  fechadoPorId?: string;
  fechado_em?: string;
  reabertoPorId?: string;
  reaberto_em?: string;
}

export interface LinhaHistoricoEscala {
  funcaoId: string;
  funcaoNome: string;
  data: string;
  militarNome: string;
  /** Só em extraordinária. */
  motivo?: string;
}

export interface HistoricoEscala {
  id: string;
  ubmId: string;
  tipo: TipoEscalaServico;
  semanaInicio: string;
  versao: number;
  linhas: LinhaHistoricoEscala[];
  fechadoPorId: string;
  fechado_em: string;
}

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
// Autorização de Substituição de Serviço
//
// É via de mão única, NÃO uma permuta: o titular ("sai") pede autorização
// pra um substituto ("entra") cobrir o serviço dele — o substituto não fica
// "devendo" cobrir um serviço do titular depois, não há troca mútua.
//
// Fluxo: o solicitante escolhe uma escala real já dele e indica o
// substituto -> o indicado precisa aceitar primeiro (aguardando_indicado)
// -> só depois vai para aprovação do Comandante OU do Escalante da UBM
// (aguardando_aprovacao) -> aprovada libera o PDF de "Autorização de
// Serviço Extraordinário/Ordinário". Aprovar NUNCA altera o registro de
// escala gerado pelo sistema — fica só registrado aqui, e é o CMT de SOS
// quem, no dia, marca a presença do substituto (RegistroPresenca aceita
// militarId diferente do da escala); mudar a escala em si continua sendo
// exclusividade do escalante, de forma manual. Como a escala não muda, o
// dia continua contando normalmente pro titular na equidade (ver
// escala.ts) — ele não fica devendo nem entra em fila de recuperação.
// ---------------------------------------------------------------------------

/** Integral: o substituto assume as 24h do serviço. Parcial: só uma faixa de horário (`horarioParcial`). */
export type ModalidadeSolicitacaoServico = 'integral' | 'parcial';

export const MODALIDADE_SOLICITACAO_LABELS: Record<ModalidadeSolicitacaoServico, string> = {
  integral: 'Integral (24h)',
  parcial: 'Parcial (faixa de horário)',
};

export type StatusSolicitacaoServico =
  | 'aguardando_indicado'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'recusada_indicado'
  | 'recusada_aprovacao';

export const STATUS_SOLICITACAO_LABELS: Record<StatusSolicitacaoServico, string> = {
  aguardando_indicado: 'Aguardando aceite do indicado',
  aguardando_aprovacao: 'Aguardando aprovação do Comandante/Escalante',
  aprovada: 'Aprovada',
  recusada_indicado: 'Recusada pelo indicado',
  recusada_aprovacao: 'Recusada pelo Comandante/Escalante',
};

export interface SolicitacaoServico {
  id: string;
  ubmId: string;
  modalidade: ModalidadeSolicitacaoServico;
  /** Só quando modalidade === 'parcial' — ex.: "19h às 07h". */
  horarioParcial?: string;
  /** Local do serviço/evento, pro documento de autorização — opcional. */
  localEvento?: string;
  /** Escala (ordinária/extraordinária) do solicitante que originou o pedido. */
  escalaOrigemId: string;
  tipoEscalaOrigem: TipoEscalaServico;
  solicitanteId: string;
  indicadoId: string;
  status: StatusSolicitacaoServico;
  motivo?: string;
  criado_em: string;
  respondido_em?: string;
  aprovadoPorId?: string;
}

// ---------------------------------------------------------------------------
// Solicitação de Reforço (CRB/COP -> UBM)
//
// O CRB ou o COP pede militares de uma função/posto pra uma UBM vinculada.
// O `tipo` diferencia duas naturezas de serviço bem distintas:
//
// - 'escala_extraordinaria': reforço pra cobrir uma extraordinária comum —
//   pro militar, é só mais um serviço extraordinário, só que emprestado a
//   outro comando. Conta no teto mensal de `LIMITE_EXTRAORDINARIAS_POR_MES`
//   e NÃO gera fila de recuperação (motivo 'reforco_crb_cop', tratado como
//   descanso reconhecido — ver `MOTIVOS_COM_FILA_DE_RECUPERACAO`).
// - 'missao': operação com diárias, fora da rotação normal — tem orçamento/
//   natureza própria, então NÃO entra no teto mensal de extraordinárias.
//   Gera o Afastamento com motivo 'missao_externa', que PARA a contagem de
//   equidade e gera fila de recuperação ao voltar, exatamente como qualquer
//   outra missão externa.
//
// O escalante da UBM recebe alerta, vê a sugestão automática do sistema
// (mesmo motor de equidade — `sugerirMilitarExtraordinario`), pode trocar o
// militar e atende ou recusa. Atender NUNCA mexe na escala do sistema — em
// vez disso, gera o `Afastamento` correspondente pro militar empenhado, o
// que já o torna indisponível pra ser escalado na própria UBM nesse período.
// ---------------------------------------------------------------------------
export type StatusSolicitacaoReforco = 'pendente' | 'atendida' | 'recusada';

export const STATUS_SOLICITACAO_REFORCO_LABELS: Record<StatusSolicitacaoReforco, string> = {
  pendente: 'Pendente',
  atendida: 'Atendida',
  recusada: 'Recusada',
};

export type TipoReforco = 'escala_extraordinaria' | 'missao';

export const TIPO_REFORCO_LABELS: Record<TipoReforco, string> = {
  escala_extraordinaria: 'Escala Extraordinária',
  missao: 'Missão/Operação',
};

export interface SolicitacaoReforco {
  id: string;
  comandoId: string;
  ubmId: string;
  /** Id de `FuncaoUbm` da UBM alvo. */
  funcao: string;
  /** Posto/graduação desejado — texto livre (ex.: "Sargento"), opcional. */
  postoDesejado?: string;
  data: string; // yyyy-MM-dd
  /** Decide o comportamento do Afastamento gerado ao atender — ver nota acima. */
  tipo: TipoReforco;
  /** Nome/descrição livre (ex.: "Operação Verão 2026"). */
  motivo: string;
  status: StatusSolicitacaoReforco;
  /** Sugestão automática do sistema (mesmo motor de equidade da extraordinária). */
  militarSugeridoId?: string;
  /** Militar efetivamente empenhado — preenchido ao atender. */
  militarId?: string;
  criadoPorId: string;
  criado_em: string;
  atendidoPorId?: string;
  atendido_em?: string;
}

// ---------------------------------------------------------------------------
// Escala do Comando (CRB/COP)
//
// Ledger de reforços recebidos: quando a UBM atende uma SolicitacaoReforco,
// entra aqui um registro do militar empenhado, com a UBM de origem — é como
// o CRB/COP enxerga seu "efetivo em reforço" nas próprias telas, sem se
// confundir com o efetivo próprio da UBM cedente nem alterar a escala dela.
// ---------------------------------------------------------------------------
export interface EscalaComando {
  id: string;
  comandoId: string;
  militarId: string;
  ubmOrigemId: string;
  /** Nome da função no momento do reforço (a função é da UBM de origem, não do comando). */
  funcaoNome: string;
  data: string; // yyyy-MM-dd
  motivo: string;
  origemReforcoId: string;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Alertas / notificações
// ---------------------------------------------------------------------------
export type TipoAlerta =
  | 'solicitacao_servico'
  | 'aceite_indicado'
  | 'aprovacao_escalante'
  | 'alteracao_diferenciada'
  | 'solicitacao_reforco'
  | 'reforco_atendido'
  | 'vaga_voluntaria_disponivel'
  | 'vaga_voluntaria_resolvida'
  | 'militar_nao_encontrado_na_planilha'
  | 'escalado'
  | 'removido_da_escala'
  | 'remanejamento_solicitado'
  | 'remanejamento_respondido'
  | 'operacao_cota_recebida'
  | 'vaga_operacao_disponivel'
  | 'vaga_operacao_resolvida'
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
