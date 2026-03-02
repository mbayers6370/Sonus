import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  current?: boolean;
  disabled?: boolean;
}

interface CollapsibleBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function CollapsibleBreadcrumbs({ items, className = '' }: CollapsibleBreadcrumbsProps) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Collapse breadcrumbs' : 'Expand breadcrumbs'}
        className="inline-flex items-center justify-center text-[#1F2A37]/72 hover:text-[#1F2A37] transition-colors"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`w-full overflow-hidden transition-all duration-200 ${open ? 'max-h-24 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}>
        <div className="flex items-center justify-center gap-2 max-w-full overflow-x-auto pb-1 hide-scrollbar">
          {items.map((item) => {
            const isCurrent = Boolean(item.current);
            const isDisabled = Boolean(item.disabled) || (!item.onClick && !isCurrent);
            const pillClass = isCurrent
              ? 'inline-flex items-center rounded-full border border-[#1F2A37]/22 bg-[rgba(31,42,55,0.10)] px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] font-mono whitespace-nowrap text-[#1F2A37]'
              : isDisabled
                ? 'inline-flex items-center rounded-full border border-white/76 bg-white/54 px-3 py-1 text-[11px] sm:text-xs font-medium uppercase tracking-[0.08em] font-mono whitespace-nowrap text-[#94A3B8]'
                : 'inline-flex items-center rounded-full border border-white/85 bg-white/74 px-3 py-1 text-[11px] sm:text-xs font-medium uppercase tracking-[0.08em] font-mono whitespace-nowrap text-text-med md:hover:underline underline-offset-2 md:hover:text-[#1F2A37] transition-colors';

            if (item.onClick && !isCurrent && !isDisabled) {
              return (
                <button key={item.label} type="button" onClick={item.onClick} className={pillClass}>
                  {item.label}
                </button>
              );
            }

            return (
              <span key={item.label} className={pillClass}>
                {item.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
