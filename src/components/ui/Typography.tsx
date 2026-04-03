import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Heading ─────────────────────────────────────────────────────────────────

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  color?: 'default' | 'primary' | 'secondary' | 'muted';
  gradient?: boolean;
}

const headingSizes = {
  xs: 'text-xs font-bold uppercase tracking-widest',
  sm: 'text-sm font-bold uppercase tracking-widest',
  md: 'text-base font-bold uppercase tracking-wide',
  lg: 'text-lg font-bold uppercase tracking-wide',
  xl: 'text-xl font-extrabold uppercase tracking-tight',
  '2xl': 'text-2xl font-black uppercase tracking-tight',
  '3xl': 'text-3xl font-black uppercase tracking-tight',
  '4xl': 'text-4xl font-black uppercase tracking-tight',
};

const headingColors = {
  default: 'text-white',
  primary: 'text-primary',
  secondary: 'text-secondary',
  muted: 'text-primary/60',
};

export const Heading: React.FC<HeadingProps> = ({
  as: Comp = 'h2',
  size = 'xl',
  color = 'default',
  gradient = false,
  className,
  children,
  ...props
}) => {
  return (
    <Comp
      className={cn(
        'font-headline',
        headingSizes[size],
        headingColors[color],
        gradient && 'bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
};

Heading.displayName = 'Heading';

// ─── Subheading ───────────────────────────────────────────────────────────────

interface SubheadingProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const Subheading: React.FC<SubheadingProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p
      className={cn('text-sm text-primary/60 font-medium', className)}
      {...props}
    >
      {children}
    </p>
  );
};

Subheading.displayName = 'Subheading';

// ─── Label ───────────────────────────────────────────────────────────────────

interface LabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: 'span' | 'label';
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'primary' | 'muted' | 'success' | 'error' | 'warning' | 'info';
  uppercase?: boolean;
}

const labelSizes = {
  sm: 'text-[10px]', // Minimum readable size for accessibility
  md: 'text-xs',
  lg: 'text-sm',
};

const labelColors = {
  default: 'text-white',
  primary: 'text-primary',
  muted: 'text-primary/50',
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
};

export const Label: React.FC<LabelProps> = ({
  as: Comp = 'span',
  size = 'md',
  color = 'default',
  uppercase = true,
  className,
  children,
  ...props
}) => {
  return (
    <Comp
      className={cn(
        'font-bold',
        labelSizes[size],
        labelColors[color],
        uppercase && 'uppercase tracking-widest',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
};

Label.displayName = 'Label';

// ─── Body ────────────────────────────────────────────────────────────────────

interface BodyProps extends React.HTMLAttributes<HTMLParagraphElement> {
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'primary' | 'muted' | 'success' | 'error';
  weight?: 'normal' | 'medium' | 'bold';
}

const bodySizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const bodyColors = {
  default: 'text-white',
  primary: 'text-primary',
  muted: 'text-primary/60',
  success: 'text-success',
  error: 'text-error',
};

export const Body: React.FC<BodyProps> = ({
  size = 'md',
  color = 'default',
  weight = 'medium',
  className,
  children,
  ...props
}) => {
  return (
    <p
      className={cn(
        'font-body',
        bodySizes[size],
        bodyColors[color],
        weight === 'normal' && 'font-normal',
        weight === 'medium' && 'font-medium',
        weight === 'bold' && 'font-bold',
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
};

Body.displayName = 'Body';

// ─── Mono (for prices, technical data) ──────────────────────────────────────

interface MonoProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'default' | 'primary' | 'success' | 'error' | 'warning';
  weight?: 'normal' | 'medium' | 'bold' | 'black';
}

const monoSizes = {
  xs: 'text-[10px]', // Minimum readable
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

const monoColors = {
  default: 'text-white',
  primary: 'text-primary',
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
};

export const Mono: React.FC<MonoProps> = ({
  size = 'md',
  color = 'default',
  weight = 'bold',
  className,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'font-mono',
        monoSizes[size],
        monoColors[color],
        weight === 'normal' && 'font-normal',
        weight === 'medium' && 'font-medium',
        weight === 'bold' && 'font-bold',
        weight === 'black' && 'font-black',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

Mono.displayName = 'Mono';

// ─── Price Display ────────────────────────────────────────────────────────────

interface PriceProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showUnit?: boolean;
  colorize?: boolean;
}

const priceSizes = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export const Price: React.FC<PriceProps> = ({
  value,
  size = 'md',
  showUnit = true,
  colorize = false,
  className,
  ...props
}) => {
  const formatValue = (v: number) => {
    if (v >= 1000000) {
      return `${(v / 1000000).toFixed(1)}M`;
    } else if (v >= 1000) {
      return `${(v / 1000).toFixed(1)}K`;
    }
    return v.toString();
  };

  const colorClass = colorize
    ? value > 0 ? 'text-success' : value < 0 ? 'text-error' : 'text-primary'
    : 'text-white';

  return (
    <div
      className={cn(
        'font-mono font-bold',
        priceSizes[size],
        colorClass,
        className
      )}
      {...props}
    >
      {formatValue(value)}
      {showUnit && <span className="text-primary/60 ml-1 text-sm">Silver</span>}
    </div>
  );
};

Price.displayName = 'Price';

// ─── Divider ─────────────────────────────────────────────────────────────────

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'subtle' | 'default' | 'strong';
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  variant = 'default',
  className,
  ...props
}) => {
  return (
    <div
      role="separator"
      className={cn(
        orientation === 'horizontal' ? 'w-full h-px' : 'h-full w-px',
        variant === 'subtle' && 'bg-white/5',
        variant === 'default' && 'bg-primary/10',
        variant === 'strong' && 'bg-primary/20',
        className
      )}
      {...props}
    />
  );
};

Divider.displayName = 'Divider';

// ─── Text Utilities ─────────────────────────────────────────────────────────

interface TruncateProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  lines?: number;
}

export const Truncate: React.FC<TruncateProps> = ({
  children,
  lines = 1,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        lines === 1 ? 'truncate' : 'line-clamp-' + lines,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

Truncate.displayName = 'Truncate';
