import { Users, CalendarDays, Send, UserX, Building2, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatarDataISO } from '../lib/escala';
import { temPapel } from '../types';

interface KpiCardProps {
  titulo: string;
  valor: number | string;
  icone: React.ElementType;
  cor: string;
}

function KpiCard({ titulo, valor, icone: Icone, cor }: KpiCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${cor} p-4 sm:p-5 flex items-center justify-between`}>
      <div>
        <p className="text-sm text-gray-500">{titulo}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{valor}</p>
      </div>
      <Icone className="w-8 h-8 text-gray-300" />
    </div>
  );
}

/** Painel do master: não pertence a nenhuma UBM, então mostra uma visão geral do CBMPA em vez de KPIs operacionais de uma unidade. */
function PainelMaster() {
  const { usuarioAtual, ubms, usuarios } = useApp();

  const pendentes = usuarios.filter((u) => !u.ativo).length;
  const comandantes = usuarios.filter((u) => u.ativo && temPapel(u, 'comandante')).length;
  const escalantes = usuarios.filter((u) => u.ativo && temPapel(u, 'escalante')).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Painel do Master</h1>
        <p className="mt-1 text-sm text-gray-500">Visão geral do CBMPA — UBMs cadastradas e papéis atribuídos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="UBMs cadastradas" valor={ubms.length} icone={Building2} cor="border-l-blue-500" />
        <KpiCard titulo="Comandantes ativos" valor={comandantes} icone={ShieldCheck} cor="border-l-emerald-500" />
        <KpiCard titulo="Escalantes ativos" valor={escalantes} icone={ShieldCheck} cor="border-l-amber-500" />
        <KpiCard titulo="Usuários pendentes de aprovação" valor={pendentes} icone={Users} cor="border-l-red-500" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Bem-vindo, {usuarioAtual?.nome}</h2>
        <p className="text-sm text-gray-500">
          Use <strong>UBMs</strong> para cadastrar unidades e <strong>Usuários</strong> para definir quem é
          Comandante ou Escalante de cada uma.
        </p>
      </div>
    </div>
  );
}

export default function SistemaHome() {
  const { usuarioAtual, militares, escalasOrdinarias, escalasExtraordinarias, solicitacoesServico, afastamentos } = useApp();

  if (temPapel(usuarioAtual, 'master')) {
    return <PainelMaster />;
  }

  const ubmId = usuarioAtual?.ubmId;
  const hoje = formatarDataISO(new Date());

  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo);
  const escaladosHoje =
    escalasOrdinarias.filter((e) => e.ubmId === ubmId && e.data === hoje).length +
    escalasExtraordinarias.filter((e) => e.ubmId === ubmId && e.data === hoje).length;
  const solicitacoesPendentes = solicitacoesServico.filter(
    (s) => s.ubmId === ubmId && (s.status === 'aguardando_indicado' || s.status === 'aguardando_escalante'),
  ).length;
  const afastamentosAtivos = afastamentos.filter(
    (a) => a.ubmId === ubmId && a.dataInicio <= hoje && a.dataFim >= hoje,
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Painel da Unidade</h1>
        <p className="mt-1 text-sm text-gray-500">Visão geral da escala e da situação operacional de hoje.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Efetivo ativo" valor={militaresDaUbm.length} icone={Users} cor="border-l-blue-500" />
        <KpiCard titulo="Escalados hoje" valor={escaladosHoje} icone={CalendarDays} cor="border-l-emerald-500" />
        <KpiCard titulo="Solicitações pendentes" valor={solicitacoesPendentes} icone={Send} cor="border-l-amber-500" />
        <KpiCard titulo="Afastados hoje" valor={afastamentosAtivos} icone={UserX} cor="border-l-red-500" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Bem-vindo, {usuarioAtual?.nome}</h2>
        <p className="text-sm text-gray-500">
          Utilize o menu lateral para acessar Escala, Solicitações, Presença e demais módulos disponíveis para o seu perfil.
        </p>
      </div>
    </div>
  );
}
