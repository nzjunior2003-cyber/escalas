import LoginModal from '../components/LoginModal';

export default function PublicHome() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950">
      <header className="bg-red-800 text-white shadow-md border-b-2 border-amber-400">
        <div className="flex items-stretch">
          <div className="bg-white dark:bg-slate-900 flex items-center px-4 sm:px-6 py-2">
            <img
              src="/brasao-duplo-cbmpa-cedec.png"
              alt="Brasão do CBMPA e da Coordenadoria Estadual de Defesa Civil"
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-3">
            <p className="font-bold leading-snug">Corpo de Bombeiros Militar do Pará e</p>
            <p className="font-bold leading-snug">Coordenadoria Estadual de Proteção e Defesa Civil</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-3">
          <h1 className="text-center">
            <span className="inline-flex flex-col items-center bg-amber-400 text-red-900 font-bold px-4 py-2 rounded-md leading-snug">
              <span className="text-xl sm:text-2xl tracking-wide">GESOP</span>
              <span className="text-xs sm:text-sm font-semibold">Gerenciamento de Escalas e Serviços Operacionais</span>
            </span>
          </h1>
          <LoginModal embedded onClose={() => {}} />
        </div>
      </main>
    </div>
  );
}
