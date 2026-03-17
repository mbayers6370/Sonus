import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

const BASE_CLASS =
  'bg-white border border-border rounded-card';

function mergeClasses(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type SurfaceButtonCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function SurfaceCard({ className, children, ...rest }: SurfaceCardProps) {
  return (
    <div className={mergeClasses(BASE_CLASS, className)} {...rest}>
      {children}
    </div>
  );
}

export function SurfaceButtonCard({ className, children, ...rest }: SurfaceButtonCardProps) {
  return (
    <button className={mergeClasses(BASE_CLASS, className)} {...rest}>
      {children}
    </button>
  );
}

