# Jornada de Trabalho — CBMPA

Sistema de Gerenciamento de Jornada de Trabalho (escalas de serviço das UBMs
do CBMPA), derivado estruturalmente do sistema **Controle de Processos**
(mesma stack, mesmo padrão visual, mesmo modelo de autenticação/aprovação).

## Stack

- React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router
- Firebase Authentication + Cloud Firestore (tempo real via `onSnapshot`)
- Express minimalista servindo o front + `/api/health` + `/api/send-email`

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha as variáveis VITE_FIREBASE_*
npm run dev
```

Sem o `.env` preenchido o app abre normalmente (tela pública e modal de
login), mas autenticação e persistência ficam desligadas.

## Decisões de modelagem já alinhadas

- Um militar pode acumular mais de uma função (`Militar.funcoes: FuncaoOperacional[]`).
- Comandante da UBM e Escalante podem ser a mesma pessoa: `Usuario.papeis`
  é um array (`'comandante' | 'escalante' | 'militar'`), não um campo único.
- Um militar pode ser transferido de UBM: `Militar.historicoUbm` guarda o
  histórico completo de vínculos.

## O que está implementado neste scaffold

- Autenticação, aprovação de cadastro e papéis (módulo Usuários), replicando
  o padrão do Controle de Processos.
- Efetivo: cadastro manual, importação de planilha (CSV — ver
  `src/lib/csvMilitares.ts` para o layout de colunas esperado) e atribuição
  de múltiplas funções por militar.
- Escala (núcleo do sistema, `src/lib/escala.ts`):
  - Ordinária: geração automática round-robin por função (garante folga
    igual entre militares da mesma função) + Kanban semanal/mensal/anual +
    edição manual.
  - Extraordinária: sugestão automática priorizando o militar "mais
    folgado" (rodízio nunca corrompido pela alteração manual do escalante —
    a estatística sempre conta `militarSugeridoId`).
  - Diferenciada: o militar indica dias; alteração pelo escalante exige
    autorização do Comandante (fluxo de solicitação + aprovação).
- Afastamentos: bloqueiam automaticamente qualquer escalação no período.
- Solicitações: autorização de serviço (substituição) e permuta, com fluxo
  de aprovação em cadeia (indicado → escalante) e alertas.
- Presença: tela do CMT de SOS para marcar presente/atrasado/dispensa/falta
  da guarnição do dia.
- Estatísticas: gráficos de reforços extraordinários, substituições/
  permutas, presença e folgas acumuladas por militar.
- Relatórios: folha de impressão (Ctrl+P → Salvar como PDF) para a escala
  ordinária e extraordinária semanal, no padrão visual institucional.

## Pendências conhecidas (para alinhar antes de produção)

1. **Layout real da planilha de efetivo**: `src/lib/csvMilitares.ts` assume
   colunas Nome/Posto-Graduação/Matrícula por cabeçalho; ajustar os aliases
   ou o parser quando houver um arquivo real de exemplo.
2. **Permuta**: o formulário em Solicitações ainda não permite escolher a
   escala específica do indicado a ser trocada (`escalaDestinoId`) — hoje a
   aprovação da permuta só move a vaga do solicitante para o indicado. Para
   uma troca bidirecional completa, adicionar esse campo ao formulário.
3. **`/api/send-email`**: hoje simulado (log no servidor) até configurar
   SMTP real em `.env` (ver seção correspondente no `.env.example`).
4. **Firestore Security Rules** (`firestore.rules`): cobrem o modelo básico
   de papéis; revisar antes do deploy em produção (ex.: `firebase deploy
   --only firestore:rules`).
