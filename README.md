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

### Testando sem um projeto Firebase real (Local Emulator Suite)

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-qualquer-nome
```

No `.env`, aponte para o emulador (as demais variáveis `VITE_FIREBASE_*`
podem ser fictícias, só precisam estar preenchidas):

```
VITE_USE_FIREBASE_EMULATOR=true
```

O emulador de Firestore já aplica o `firestore.rules` do projeto de verdade
— dá pra validar o RBAC (master/comandante/escalante) de ponta a ponta sem
tocar em dados reais. O primeiro usuário master (ver bootstrap abaixo)
precisa ser criado direto no emulador (Admin SDK, ou pela mesma ideia do
Firebase Console) — a interface web do emulador não vem habilitada por
padrão neste repositório (`firebase.json` → `emulators.ui.enabled: false`).

## Decisões de modelagem já alinhadas

- Um militar pode acumular mais de uma função (`Militar.funcoes: FuncaoOperacional[]`).
- Comandante da UBM e Escalante podem ser a mesma pessoa: `Usuario.papeis`
  é um array (`'master' | 'comandante' | 'escalante' | 'militar'`), não um
  campo único.
- Um militar pode ser transferido de UBM: `Militar.historicoUbm` guarda o
  histórico completo de vínculos.
- Existe um papel **master**, único para todo o CBMPA (não pertence a
  nenhuma UBM — `Usuario.ubmId` fica `''`): só ele cadastra as UBMs
  (módulo **UBMs**) e atribui/remove os papéis `master`, `comandante` e
  `escalante` de qualquer usuário, em qualquer UBM (módulo **Usuários**,
  visão de todas as unidades). Comandante/Escalante continuam aprovando e
  gerenciando os usuários "militar" da própria UBM, mas não podem
  promover ninguém a Comandante/Escalante — quem ocupa esses papéis pode
  mudar, e essa decisão é do master. `firestore.rules` aplica essa mesma
  regra no servidor (`papeisRestritos`, `gestaoDaUbm`, `podeGerenciarUbm`).

### Bootstrap do primeiro usuário

Como o autocadastro sempre nasce `ativo: false` e `papeis: ['militar']`, é
preciso criar o **primeiro usuário master** manualmente, direto no Firebase
Console/Firestore (coleção `usuarios`, id = UID do Firebase Auth):

```json
{ "nome": "...", "email": "...", "ubmId": "", "papeis": ["master"], "ativo": true }
```

A partir daí, esse master cadastra as UBMs e define quem é Comandante/
Escalante de cada uma pelo próprio app — é um bootstrap único para todo o
CBMPA, não um por UBM.

Esse fluxo completo (bootstrap do master → cadastro de UBM → cadastro de
Comandante → autocadastro de um militar → aprovação pelo Comandante, mais
uma tentativa de autopromoção a Escalante por fora da UI) foi testado de
ponta a ponta contra o Local Emulator Suite, com `firestore.rules` real. Dois
bugs genuínos apareceram só nesse teste (a UI nunca teria exposto nenhum
dos dois) e já estão corrigidos:
- A leitura de `alertas` (`AppContext`) buscava a coleção inteira e
  filtrava no cliente — as regras exigem um `where(usuarioId == ...)` na
  própria query para autorizar a leitura; sem isso, o Firestore recusa a
  leitura inteira.
- `setDoc`/`updateDoc` de `usuarios` podiam receber `militarId: undefined`
  explícito (ao desvincular o efetivo) — o Firestore rejeita `undefined`
  como valor de campo. `AppContext` agora sanitiza isso antes de escrever
  (`semIndefinidosParaCriar`/`semIndefinidosParaAtualizar`).
- A tela pública "Solicitar Acesso" nunca conseguia listar UBMs no
  dropdown: a coleção `ubms` só era buscada quando autenticado, e um
  visitante nunca está. `ubms` agora é lida sempre (`firestore.rules`
  também passou a permitir leitura pública dessa coleção — sigla/nome de
  UBM não são dados sensíveis).

## O que está implementado neste scaffold

- Autenticação, aprovação de cadastro e papéis (módulo Usuários — todas as
  UBMs para o master, só a própria para Comandante/Escalante), replicando o
  padrão do Controle de Processos. Módulo UBMs (cadastro de unidades),
  exclusivo do master.
- Efetivo: cadastro manual, atribuição de múltiplas funções por militar e
  "Adicionar da planilha" — um autocomplete (`MilitarPlanilhaAutocomplete`)
  que busca ao vivo, por nome/posto/matrícula, na planilha pública de
  efetivo do CBMPA ("Militares e matrícula bm", ver
  `src/lib/planilhaEfetivo.ts`); ao selecionar, insere o militar na UBM
  atual. Como a busca é sempre feita em tempo real contra a planilha
  (nunca um retrato salvo), promoções e demais atualizações feitas lá já
  aparecem na próxima busca — sem precisar reimportar nada, e sem nenhum
  dado pessoal do efetivo versionado neste repositório.
  `importarMilitaresCsv` (`AppContext`) continua disponível para importar
  um arquivo CSV próprio de outra UBM — ver `src/lib/csvMilitares.ts` para
  o layout de colunas esperado —, só não está mais ligado a um botão na
  tela.
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
- Relatórios: geração real de PDF (download direto, via `jsPDF` +
  `jspdf-autotable` — `src/lib/pdfEscala.ts`) para a escala ordinária e
  extraordinária semanal, no padrão visual institucional (brasão, cabeçalho
  da UBM, tabela por dia).

## Pendências conhecidas (para alinhar antes de produção)

1. ~~Layout real da planilha de efetivo~~ — resolvido: `src/lib/csvMilitares.ts`
   já reconhece o cabeçalho real (`nome`, `matricula`/`MF`, `cargo`) da
   planilha "Militares e matrícula bm", usada ao vivo pela busca do módulo
   Efetivo (ver item acima).
2. **Permuta**: o formulário em Solicitações ainda não permite escolher a
   escala específica do indicado a ser trocada (`escalaDestinoId`) — hoje a
   aprovação da permuta só move a vaga do solicitante para o indicado. Para
   uma troca bidirecional completa, adicionar esse campo ao formulário.
3. **`/api/send-email`**: hoje simulado (log no servidor) até configurar
   SMTP real em `.env` (ver seção correspondente no `.env.example`).
4. **Firestore Security Rules** (`firestore.rules`): cobrem o modelo básico
   de papéis; revisar antes do deploy em produção (ex.: `firebase deploy
   --only firestore:rules`).
