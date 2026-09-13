import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';
import { calcularDiasFolga, contarExtraordinariasPorMilitar, formatarDataISO } from '../../lib/escala';
import { temPapel } from '../../types';

export default function Estatisticas() {
  const {
    usuarioAtual,
    militares,
    funcoes,
    escalasOrdinarias,
    escalasExtraordinarias,
    presencas,
    solicitacoesServico,
  } = useApp();

  if (!temPapel(usuarioAtual, 'comandante') && !temPapel(usuarioAtual, 'escalante')) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const ubmId = usuarioAtual!.ubmId;
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId && m.ativo);

  const inicioAno = `${new Date().getFullYear()}-01-01`;
  const hoje = formatarDataISO(new Date());

  const extraordinariasDaUbm = escalasExtraordinarias.filter((e) => e.ubmId === ubmId);
  const contagemExtra = contarExtraordinariasPorMilitar(extraordinariasDaUbm);

  const dadosExtraordinarias = militaresDaUbm.map((m) => ({
    nome: m.nome,
    reforcos: contagemExtra.get(m.id) ?? 0,
  }));

  const dadosSubstituicoesPermutas = militaresDaUbm.map((m) => ({
    nome: m.nome,
    substituicoes: solicitacoesServico.filter((s) => s.ubmId === ubmId && s.tipo === 'substituicao' && s.status === 'aprovada' && (s.solicitanteId === m.id || s.indicadoId === m.id)).length,
    permutas: solicitacoesServico.filter((s) => s.ubmId === ubmId && s.tipo === 'permuta' && s.status === 'aprovada' && (s.solicitanteId === m.id || s.indicadoId === m.id)).length,
  }));

  const contagemPresenca = new Map<string, { presente: number; atrasado: number; dispensa: number; falta: number }>();
  for (const p of presencas) {
    if (!militaresDaUbm.some((m) => m.id === p.militarId)) continue;
    const atual = contagemPresenca.get(p.militarId) ?? { presente: 0, atrasado: 0, dispensa: 0, falta: 0 };
    if (p.status === 'presente') atual.presente++;
    else if (p.status === 'atrasado') atual.atrasado++;
    else if (p.status === 'dispensa') atual.dispensa++;
    else if (p.status === 'falta') atual.falta++;
    contagemPresenca.set(p.militarId, atual);
  }
  const dadosPresenca = militaresDaUbm.map((m) => ({
    nome: m.nome,
    ...(contagemPresenca.get(m.id) ?? { presente: 0, atrasado: 0, dispensa: 0, falta: 0 }),
  }));

  const folgasPorFuncao = militaresDaUbm.flatMap((m) =>
    m.funcoes.map((f) => ({
      nome: `${m.nome} (${funcoes.find((funcaoUbm) => funcaoUbm.id === f)?.nome ?? 'Função removida'})`,
      folgas: calcularDiasFolga(m.id, f, inicioAno, hoje, escalasOrdinarias.filter((e) => e.ubmId === ubmId)),
    })),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estatísticas</h1>
        <p className="mt-1 text-sm text-gray-500">Histórico de substituições, permutas, presença, reforços extraordinários e folgas acumuladas.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Reforços extraordinários por militar</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dadosExtraordinarias}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="reforcos" fill="#b91c1c" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Substituições e permutas aprovadas por militar</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dadosSubstituicoesPermutas}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="substituicoes" fill="#2563eb" />
            <Bar dataKey="permutas" fill="#059669" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Presença registrada pelo CMT de SOS</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dadosPresenca}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="presente" stackId="a" fill="#059669" />
            <Bar dataKey="atrasado" stackId="a" fill="#d97706" />
            <Bar dataKey="dispensa" stackId="a" fill="#6b7280" />
            <Bar dataKey="falta" stackId="a" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Dias de folga acumulados no ano, por militar/função</h2>
        <ResponsiveContainer width="100%" height={Math.max(280, folgasPorFuncao.length * 28)}>
          <BarChart data={folgasPorFuncao} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={160} />
            <Tooltip />
            <Bar dataKey="folgas" fill="#7f1d1d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
