import { Zap, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutomationTemplates } from '@/hooks/useAutomations';
import type { AutomationTemplate } from '@/hooks/useAutomations';

interface AutomationTemplatesProps {
  onUseTemplate: (template: AutomationTemplate) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  'Task Management': Zap,
  'Notifications': Bell,
};

export function AutomationTemplates({ onUseTemplate }: AutomationTemplatesProps) {
  const { data: templates, isLoading } = useAutomationTemplates();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  const allTemplates = templates ?? [];
  const categories = [...new Set(allTemplates.map((t) => t.category))];

  if (allTemplates.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No templates available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const Icon = categoryIcons[category] ?? Zap;
        const catTemplates = allTemplates.filter((t) => t.category === category);
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={16} className="text-text-secondary" />
              <h3 className="text-sm font-semibold text-text-secondary">{category}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} onUse={onUseTemplate} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TemplateCard({ template, onUse }: { template: AutomationTemplate; onUse: (t: AutomationTemplate) => void }) {
  const triggerLabel = template.trigger.type.replace(/_/g, ' ').toLowerCase();
  const actionCount = template.actions.length;

  return (
    <div className="p-4 rounded-xl border border-border-primary bg-bg-tertiary hover:border-accent-blue/40 transition-all">
      <h4 className="text-sm font-semibold text-text-primary">{template.name}</h4>
      <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{template.description}</p>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-text-tertiary">
        <span className="px-1.5 py-0.5 rounded bg-bg-secondary">When {triggerLabel}</span>
        <span>&rarr;</span>
        <span>{actionCount} action{actionCount !== 1 ? 's' : ''}</span>
      </div>
      <button
        onClick={() => onUse(template)}
        className="mt-3 px-3 py-1 text-xs font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
      >
        Use Template
      </button>
    </div>
  );
}
