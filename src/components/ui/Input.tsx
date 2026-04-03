import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type InputVariant = 'default' | 'search' | 'compact' | 'ghost';
export type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  size?: InputSize;
  error?: string;
  label?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<InputVariant, string> = {
  default: `
    w-full bg-black/40 border border-primary/10 rounded-lg py-3 px-4
    text-white text-sm font-medium placeholder:text-primary/30
    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
  `,
  search: `
    w-full glass-panel border border-primary/20 rounded-xl py-4 pl-12 pr-4
    text-white text-sm font-medium placeholder:text-primary/40
    focus:outline-none focus:ring-2 focus:ring-primary
    transition-all duration-200
  `,
  compact: `
    w-full bg-black/20 border border-primary/20 rounded-lg py-2 px-3
    text-white text-sm font-bold text-center
    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30
    transition-all duration-200
  `,
  ghost: `
    w-full bg-transparent border-none py-2 px-3
    text-white text-sm font-medium
    focus:outline-none
    transition-all duration-200
  `,
};

const sizeStyles: Record<InputSize, { input: string; icon: string }> = {
  sm: {
    input: 'py-2 px-3 text-xs',
    icon: 'w-4 h-4',
  },
  md: {
    input: 'py-3 px-4 text-sm',
    icon: 'w-5 h-5',
  },
  lg: {
    input: 'py-4 px-5 text-base',
    icon: 'w-6 h-6',
  },
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  variant = 'default',
  size = 'md',
  error,
  label,
  hint,
  leftIcon,
  rightIcon,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-primary/50 uppercase tracking-widest ml-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className={cn(
            'absolute left-4 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none',
            sizeStyles[size].icon
          )}>
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            variantStyles[variant],
            sizeStyles[size].input,
            error && 'border-error/50 focus:ring-error/50 focus:border-error/50',
            leftIcon && 'pl-11',
            rightIcon && 'pr-11',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className={cn(
            'absolute right-4 top-1/2 -translate-y-1/2 text-primary/50',
            sizeStyles[size].icon
          )}>
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-error ml-1">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-primary/30 ml-1">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// ─── Search Input ─────────────────────────────────────────────────────────────

interface SearchInputProps extends Omit<InputProps, 'variant' | 'leftIcon'> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({
  value,
  onClear,
  className,
  ...props
}, ref) => {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50 w-5 h-5" />
      <Input
        ref={ref}
        variant="search"
        value={value}
        className={className}
        {...props}
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

// ─── Select ─────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'default' | 'compact';
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  variant = 'default',
  label,
  error,
  options,
  placeholder,
  className,
  id,
  ...props
}, ref) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-primary/50 uppercase tracking-widest ml-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            variant === 'default'
              ? 'w-full appearance-none glass-panel border border-primary/20 rounded-xl py-4 pl-4 pr-10 text-white text-sm font-bold uppercase tracking-wider'
              : 'w-full appearance-none bg-black/20 border border-primary/20 rounded-lg py-2 px-3 text-white text-sm font-medium',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            error && 'border-error/50 focus:ring-error/50 focus:border-error/50',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-primary/40">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {error && (
        <p className="text-xs text-error ml-1">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

// ─── Textarea ────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  className,
  id,
  ...props
}, ref) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-bold text-primary/50 uppercase tracking-widest ml-1"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'w-full bg-black/40 border border-primary/10 rounded-lg py-3 px-4',
          'text-white text-sm font-medium placeholder:text-primary/30',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'resize-none transition-all duration-200',
          error && 'border-error/50 focus:ring-error/50 focus:border-error/50',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-error ml-1">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-primary/30 ml-1">{hint}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
