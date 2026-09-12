import { useState } from 'react';
import { FileSignature } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarDataISO } from '../../lib/escala';
import { gerarPdfAutorizacaoSubstituicao } from '../../lib/pdfAutorizacaoSubstituicao';

const OBSERVACAO_PADRAO =
  'Caso o militar substituto esteja escalado em outra escala por necessidade do serviço, será considerada inválida esta autorização.';

export default function AutorizacaoSubstituicao() {
  const { usuarioAtual, ubms, militares } = useApp();

  const ubmId = usuarioAtual?.ubmId ?? '';
  const ubm = ubms.find((u) => u.id === ubmId);
  const militaresDaUbm = militares.filter((m) => m.ubmId === ubmId);
  const militarDoUsuario = militares.find((m) => m.id === usuarioAtual?.militarId);

  const [eventoExtraordinario, setEventoExtraordinario] = useState('');
  const [dataEvento, setDataEvento] = useState(formatarDataISO(new Date()));
  const [localEvento, setLocalEvento] = useState('');
  const [horario, setHorario] = useState('');
  const [militarSubstituidoNomeGuerra, setMilitarSubstituidoNomeGuerra] = useState('');
  const [militarSubstitutoNomeCompleto, setMilitarSubstitutoNomeCompleto] = useState('');
  const [militarSubstitutoMatricula, setMilitarSubstitutoMatricula] = useState('');
  const [observacao, setObservacao] = useState(OBSERVACAO_PADRAO);
  const [responsavelNome, setResponsavelNome] = useState(usuarioAtual?.nome ?? '');
  const [responsavelPosto, setResponsavelPosto] = useState(militarDoUsuario?.posto ?? '');
  const [responsavelCargo, setResponsavelCargo] = useState(
    ubm ? `Chefe da Subseção de Pessoal do ${ubm.sigla}` : 'Chefe da Subseção de Pessoal',
  );
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!usuarioAtual?.ubmId) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  const selecionarSubstituto = (militarId: string) => {
    const militar = militaresDaUbm.find((m) => m.id === militarId);
    if (!militar) return;
    setMilitarSubstitutoNomeCompleto(`${militar.posto} ${militar.nome}`.trim());
    setMilitarSubstitutoMatricula(militar.matricula);
  };

  const gerarPdf = async () => {
    setErro(null);
    setGerando(true);
    try {
      await gerarPdfAutorizacaoSubstituicao({
        ubmNome: ubm ? `${ubm.sigla} - ${ubm.nome}` : 'Unidade de Bombeiro Militar',
        ubmSigla: ubm?.sigla ?? '',
        ubmLogoDataUrl: ubm?.logoDataUrl,
        eventoExtraordinario,
        dataEvento,
        localEvento,
        horario,
        militarSubstituidoNomeGuerra,
        militarSubstitutoNomeCompleto,
        militarSubstitutoMatricula,
        observacao,
        responsavelNome,
        responsavelPosto,
        responsavelCargo,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const camposObrigatoriosPreenchidos =
    eventoExtraordinario.trim() &&
    dataEvento &&
    localEvento.trim() &&
    horario.trim() &&
    militarSubstituidoNomeGuerra.trim() &&
    militarSubstitutoNomeCompleto.trim() &&
    militarSubstitutoMatricula.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Autorização de Substituição de Serviço</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gera o documento de autorização para dois militares permutarem o serviço entre si num evento
          extraordinário. O PDF sai com os campos de assinatura em branco — a assinatura (gov.br/token) é feita fora
          do sistema, e o documento assinado deve ser guardado como comprovante.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Evento extraordinário</label>
            <input
              type="text"
              value={eventoExtraordinario}
              onChange={(e) => setEventoExtraordinario(e.target.value)}
              placeholder="Ex.: Prevenção durante o evento Festa Junina - SEEL"
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data do evento</label>
            <input
              type="date"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Horário</label>
            <input
              type="text"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              placeholder="Ex.: 16h30"
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Local do evento</label>
            <input
              type="text"
              value={localEvento}
              onChange={(e) => setLocalEvento(e.target.value)}
              placeholder="Ex.: Arena Guilherme Paraense - Mangueirinho"
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Militar substituído — SAI (somente nome de guerra)
            </label>
            <input
              type="text"
              list="militares-da-ubm"
              value={militarSubstituidoNomeGuerra}
              onChange={(e) => setMilitarSubstituidoNomeGuerra(e.target.value)}
              placeholder="Ex.: SD BM JULLYANA"
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Militar substituto — ENTRA (nome completo e MF)
            </label>
            <select
              onChange={(e) => selecionarSubstituto(e.target.value)}
              defaultValue=""
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3 mb-2"
            >
              <option value="" disabled>
                Selecionar do efetivo da UBM...
              </option>
              {militaresDaUbm.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.posto} {m.nome} — MF: {m.matricula}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={militarSubstitutoNomeCompleto}
                onChange={(e) => setMilitarSubstitutoNomeCompleto(e.target.value)}
                placeholder="Posto e nome completo"
                className="flex-1 border border-gray-300 rounded-md text-sm py-2 px-3"
              />
              <input
                type="text"
                value={militarSubstitutoMatricula}
                onChange={(e) => setMilitarSubstitutoMatricula(e.target.value)}
                placeholder="MF"
                className="w-28 border border-gray-300 rounded-md text-sm py-2 px-3"
              />
            </div>
          </div>
        </div>
        <datalist id="militares-da-ubm">
          {militaresDaUbm.map((m) => (
            <option key={m.id} value={`${m.posto} ${m.nome}`} />
          ))}
        </datalist>

        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-1">Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Responsável pela Subseção de Pessoal</label>
            <input
              type="text"
              value={responsavelNome}
              onChange={(e) => setResponsavelNome(e.target.value)}
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Posto/Graduação</label>
            <input
              type="text"
              value={responsavelPosto}
              onChange={(e) => setResponsavelPosto(e.target.value)}
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cargo</label>
            <input
              type="text"
              value={responsavelCargo}
              onChange={(e) => setResponsavelCargo(e.target.value)}
              className="w-full border border-gray-300 rounded-md text-sm py-2 px-3"
            />
          </div>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="pt-2">
          <button
            onClick={gerarPdf}
            disabled={gerando || !camposObrigatoriosPreenchidos}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
          >
            <FileSignature className="-ml-1 mr-2 h-4 w-4" /> {gerando ? 'Gerando...' : 'Gerar PDF de Autorização'}
          </button>
        </div>
      </div>
    </div>
  );
}
