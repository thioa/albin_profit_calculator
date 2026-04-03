import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-primary text-on-primary font-extrabold
    hover:brightness-110 active:scale-[0.98]
    shadow-[0_4px_12px_rgba(212,175,55,0.2)]
  `,
  secondary: `
    glass-panel border border-primary/20 text-primary font-bold
    hover:border-primary/40 hover:text-white hover:bg-primary/5
  `,
  ghost: `
    text-primary/60 hover:text-primary
    hover:bg-white/5
  `,
  danger: `
    bg-error/10 text-error border border-error/20 font-bold
    hover:bg-error/20 hover:border-error/40
  `,
  success: `
    bg-success/10 text-success border border-success/20 font-bold
    hover:bg-success/20 hover:border-success/40
  `,
  outline: `
    bg-transparent border border-primary/30 text-primary font-bold
    hover:border-primary/50 hover:bg-primary/5
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-md min-h-[32px]',
  md: 'px-5 py-2.5 text-sm gap-2 rounded-lg min-h-[40px]',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl min-h-[48px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center font-bold',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-surface',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        // Variant
        variantStyles[variant],
        // Size
        sizeStyles[size],
        // Width
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

// ─── Icon Button ─────────────────────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon: React.ReactNode;
  ariaLabel: string;
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({
  variant = 'ghost',
  size = 'md',
  icon,
  ariaLabel,
  className,
  disabled,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        iconSizeStyles[size],
        size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
});

IconButton.displayName = 'IconButton';
