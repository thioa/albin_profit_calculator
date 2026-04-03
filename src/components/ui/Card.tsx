import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type CardVariant = 'glass' | 'glassBordered' | 'solid' | 'outlined' | 'elevated';
export type CardAccent = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  accent?: CardAccent;
  accentPosition?: 'top' | 'left';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  glass: `
    glass-panel border border-primary/10
  `,
  glassBordered: `
    glass-panel border border-primary/20
    hover:border-primary/30
  `,
  solid: `
    bg-surface-container border border-white/5
  `,
  outlined: `
    bg-transparent border border-primary/10
    hover:border-primary/20
  `,
  elevated: `
    bg-surface-container-high border border-white/5 shadow-lg
    hover:shadow-xl hover:bg-surface-container-highest
  `,
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

const accentColors: Record<CardAccent, { border: string; bg: string; shadow: string }> = {
  primary: {
    border: 'border-primary/20',
    bg: 'bg-primary/5',
    shadow: 'shadow-[0_0_20px_rgba(138,172,255,0.1)]',
  },
  success: {
    border: 'border-success/20',
    bg: 'bg-success/5',
    shadow: 'shadow-[0_0_20px_rgba(34,197,94,0.1)]',
  },
  warning: {
    border: 'border-warning/20',
    bg: 'bg-warning/5',
    shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.1)]',
  },
  error: {
    border: 'border-error/20',
    bg: 'bg-error/5',
    shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.1)]',
  },
  info: {
    border: 'border-info/20',
    bg: 'bg-info/5',
    shadow: 'shadow-[0_0_20px_rgba(59,130,246,0.1)]',
  },
  secondary: {
    border: 'border-secondary/20',
    bg: 'bg-secondary/5',
    shadow: 'shadow-[0_0_20px_rgba(114,239,245,0.1)]',
  },
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  variant = 'glass',
  accent,
  accentPosition = 'top',
  padding = 'md',
  hoverable = false,
  className,
  children,
  ...props
}, ref) => {
  const paddingClass = paddingStyles[padding];

  return (
    <div
      ref={ref}
      className={cn(
        // Base
        'rounded-xl transition-all duration-300',
        // Variant
        variantStyles[variant],
        // Padding
        paddingClass,
        // Hover
        hoverable && 'hover:scale-[1.01] cursor-pointer',
        // Accent
        accent && accentPosition === 'top' && `border-t-4 ${accentColors[accent].border} ${accentColors[accent].bg}`,
        accent && accentPosition === 'left' && `border-l-4 ${accentColors[accent].border} ${accentColors[accent].bg}`,
        // Focus
        'focus:outline-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

// ─── Card Header ─────────────────────────────────────────────────────────────

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
  className,
  ...props
}) => {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)} {...props}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-primary/60 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

CardHeader.displayName = 'CardHeader';

// ─── Card Content ─────────────────────────────────────────────────────────────

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {children}
    </div>
  );
};

CardContent.displayName = 'CardContent';

// ─── Card Footer ─────────────────────────────────────────────────────────────

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  dividers?: boolean;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  dividers = false,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-4 pt-4',
        dividers && 'border-t border-primary/10 mt-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

CardFooter.displayName = 'CardFooter';
