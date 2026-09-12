import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  showToggle?: boolean;
}

export default function FormField({ label, icon: Icon, showToggle = false, type, className = '', ...props }: FormFieldProps) {
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const isPasswordToggle = type === 'password' && showToggle;
  const tipoEfetivo = isPasswordToggle ? (senhaVisivel ? 'text' : 'password') : type;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <input
          {...props}
          type={tipoEfetivo}
          className={`block w-full ${Icon ? 'pl-10' : ''} ${isPasswordToggle ? 'pr-10' : ''} px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 ${className}`}
        />
        {isPasswordToggle && (
          <button
            type="button"
            onClick={() => setSenhaVisivel((v) => !v)}
            tabIndex={-1}
            aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            {senhaVisivel ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
