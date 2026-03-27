import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-xs min-w-0', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="flex items-center gap-1 min-w-0">
            {index > 0 && (
              <ChevronRight size={12} className="text-text-tertiary flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-semibold text-text-primary truncate max-w-[200px]" title={item.label}>
                {item.label}
              </span>
            ) : item.onClick ? (
              <button
                onClick={item.onClick}
                className="text-text-secondary hover:text-text-primary hover:underline truncate max-w-[150px] transition-colors"
                title={item.label}
              >
                {item.label}
              </button>
            ) : (
              <span className="text-text-secondary truncate max-w-[150px]" title={item.label}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
