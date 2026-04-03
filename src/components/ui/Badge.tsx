import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'subtle' | 'primary' | 'secondary';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: `
    bg-primary/10 text-primary border border-primary/20
  `,
  primary: `
    bg-primary/10 text-primary border border-primary/20
  `,
  secondary: `
    bg-secondary/10 text-secondary border border-secondary/20
  `,
  success: `
    bg-success/10 text-success border border-success/20
  `,
  warning: `
    bg-warning/10 text-warning border border-warning/20
  `,
  error: `
    bg-error/10 text-error border border-error/20
  `,
  info: `
    bg-info/10 text-info border border-info/20
  `,
  subtle: `
    bg-white/5 text-primary/60 border border-white/5
  `,
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  className,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        // Base
        'inline-flex items-center font-bold uppercase tracking-wider rounded-full',
        // Size
        sizeStyles[size],
        // Variant
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            pulse && 'animate-pulse',
            variant === 'success' && 'bg-success',
            variant === 'warning' && 'bg-warning',
            variant === 'error' && 'bg-error',
            variant === 'info' && 'bg-info',
            variant === 'primary' && 'bg-primary',
            variant === 'secondary' && 'bg-secondary',
            (variant === 'default' || variant === 'subtle') && 'bg-primary/50'
          )}
        />
      )}
      {children}
    </span>
  );
};

Badge.displayName = 'Badge';

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: 'verified' | 'suspicious' | 'unknown' | 'excellent' | 'good' | 'fair' | 'stale';
  size?: BadgeSize;
  showLabel?: boolean;
}

const statusConfig: Record<string, { variant: BadgeVariant; label: string; dot: boolean; pulse?: boolean }> = {
  verified: { variant: 'success', label: 'Verified', dot: true },
  suspicious: { variant: 'error', label: 'Suspicious', dot: true, pulse: true },
  unknown: { variant: 'subtle', label: 'Unknown', dot: true },
  excellent: { variant: 'success', label: 'Excellent', dot: true },
  good: { variant: 'info', label: 'Good', dot: true },
  fair: { variant: 'warning', label: 'Fair', dot: true },
  stale: { variant: 'error', label: 'Stale', dot: true },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showLabel = true,
}) => {
  const config = statusConfig[status] || statusConfig.unknown;

  return (
    <Badge variant={config.variant} size={size} dot pulse={config.pulse}>
      {showLabel ? config.label : null}
    </Badge>
  );
};

// ─── Count Badge ─────────────────────────────────────────────────────────────

interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number;
  max?: number;
  variant?: BadgeVariant;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  max = 99,
  variant = 'default',
  className,
  ...props
}) => {
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5',
        'text-[10px] font-black rounded-full',
        variantStyles[variant],
        variant === 'default' && 'bg-primary text-on-primary',
        variant === 'error' && 'bg-error text-white',
        variant === 'warning' && 'bg-warning text-black',
        className
      )}
      {...props}
    >
      {displayCount}
    </span>
  );
};
