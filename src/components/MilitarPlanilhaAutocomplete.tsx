import { useEffect, useRef, useState } from 'react';
import type { LinhaMilitar } from '../lib/csvMilitares';

interface MilitarPlanilhaAutocompleteProps {
  linhas: LinhaMilitar[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (linha: LinhaMilitar) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Autocomplete que busca por nome/cargo/matrícula dentro da lista já
 * carregada da planilha pública de efetivo (ver `lib/planilhaEfetivo.ts`).
 */
export default function MilitarPlanilhaAutocomplete({
  linhas,
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}: MilitarPlanilhaAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtrados = value
    ? linhas
        .filter(
          (l) =>
            l.nome.toLowerCase().includes(value.toLowerCase()) ||
            l.posto.toLowerCase().includes(value.toLowerCase()) ||
            l.matricula.includes(value),
        )
        .slice(0, 50)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (value) setIsOpen(true);
        }}
        className={className}
        autoComplete="off"
      />

      {isOpen && filtrados.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm mt-1">
          {filtrados.map((l, index) => (
            <li
              key={`${l.matricula}-${index}`}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-red-50 text-gray-900"
              onClick={() => {
                onSelect(l);
                setIsOpen(false);
              }}
            >
              <div className="flex flex-col">
                <span className="font-medium truncate">{l.nome}</span>
                <span className="text-gray-500 text-xs truncate">{l.posto} — MF: {l.matricula}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
