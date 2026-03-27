import type { LucideIcon } from 'lucide-react';
import {
  PieChart as PieChartIcon,
  BarChart3,
  LineChart,
  Users,
  ListTodo,
  CalendarClock,
  Clock,
  CalendarRange,
  Target,
  Type,
  Globe,
  Gauge,
  Activity,
  X,
} from 'lucide-react';

// ==========================================
// Card type definitions
// ==========================================

export interface CardTypeDefinition {
  type: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
  defaultConfig: Record<string, unknown>;
  defaultLayout: { w: number; h: number };
}

const CARD_TYPES: CardTypeDefinition[] = [
  // Charts
  {
    type: 'STATUS_CHART',
    name: 'Status Chart',
    description: 'Task distribution by status',
    icon: PieChartIcon,
    category: 'Charts',
    defaultConfig: { chartType: 'pie' },
    defaultLayout: { w: 4, h: 2 },
  },
  {
    type: 'PRIORITY_CHART',
    name: 'Priority Chart',
    description: 'Task distribution by priority',
    icon: BarChart3,
    category: 'Charts',
    defaultConfig: { chartType: 'pie' },
    defaultLayout: { w: 4, h: 2 },
  },
  {
    type: 'WORKLOAD',
    name: 'Assignee Workload',
    description: 'Tasks per team member',
    icon: Users,
    category: 'Charts',
    defaultConfig: {},
    defaultLayout: { w: 6, h: 2 },
  },
  {
    type: 'PIE_CHART',
    name: 'Pie Chart',
    description: 'Custom pie chart visualization',
    icon: PieChartIcon,
    category: 'Charts',
    defaultConfig: { chartType: 'pie' },
    defaultLayout: { w: 4, h: 2 },
  },
  {
    type: 'BAR_CHART',
    name: 'Bar Chart',
    description: 'Custom bar chart visualization',
    icon: BarChart3,
    category: 'Charts',
    defaultConfig: { chartType: 'bar' },
    defaultLayout: { w: 6, h: 2 },
  },
  {
    type: 'LINE_CHART',
    name: 'Line Chart',
    description: 'Trend line visualization',
    icon: LineChart,
    category: 'Charts',
    defaultConfig: { chartType: 'line' },
    defaultLayout: { w: 6, h: 2 },
  },
  // Tasks
  {
    type: 'TASK_LIST',
    name: 'Task List',
    description: 'Compact list of recent tasks',
    icon: ListTodo,
    category: 'Tasks',
    defaultConfig: { limit: 10 },
    defaultLayout: { w: 4, h: 3 },
  },
  {
    type: 'DUE_DATE_OVERVIEW',
    name: 'Due Date Overview',
    description: 'Overdue, today, and upcoming counts',
    icon: CalendarClock,
    category: 'Tasks',
    defaultConfig: {},
    defaultLayout: { w: 6, h: 1 },
  },
  // Time
  {
    type: 'TIME_TRACKING',
    name: 'Time Tracking',
    description: 'Time logged summary',
    icon: Clock,
    category: 'Time',
    defaultConfig: {},
    defaultLayout: { w: 4, h: 2 },
  },
  {
    type: 'TIMESHEET',
    name: 'Timesheet',
    description: 'Weekly timesheet overview',
    icon: CalendarRange,
    category: 'Time',
    defaultConfig: {},
    defaultLayout: { w: 6, h: 2 },
  },
  // Goals
  {
    type: 'GOAL_PROGRESS',
    name: 'Goal Progress',
    description: 'Track goal completion status',
    icon: Target,
    category: 'Goals',
    defaultConfig: {},
    defaultLayout: { w: 4, h: 2 },
  },
  // Content
  {
    type: 'TEXT_BLOCK',
    name: 'Text Block',
    description: 'Rich text or markdown content',
    icon: Type,
    category: 'Content',
    defaultConfig: { content: '' },
    defaultLayout: { w: 4, h: 2 },
  },
  {
    type: 'EMBED',
    name: 'Embed',
    description: 'Embed external URL via iframe',
    icon: Globe,
    category: 'Content',
    defaultConfig: { url: '' },
    defaultLayout: { w: 6, h: 3 },
  },
  {
    type: 'KPI',
    name: 'KPI Card',
    description: 'Key metric with trend indicator',
    icon: Gauge,
    category: 'Content',
    defaultConfig: { label: 'Metric', value: '0', trend: 'none' },
    defaultLayout: { w: 3, h: 1 },
  },
  // Activity
  {
    type: 'RECENT_ACTIVITY',
    name: 'Recent Activity',
    description: 'Latest workspace activity feed',
    icon: Activity,
    category: 'Activity',
    defaultConfig: { limit: 10 },
    defaultLayout: { w: 4, h: 3 },
  },
];

const CATEGORIES = ['Charts', 'Tasks', 'Time', 'Goals', 'Content', 'Activity'];

// ==========================================
// Modal
// ==========================================

interface AddCardModalProps {
  onAdd: (cardType: CardTypeDefinition) => void;
  onClose: () => void;
}

export function AddCardModal({ onAdd, onClose }: AddCardModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[80vh] bg-bg-secondary border border-border-primary rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
          <h2 className="text-base font-semibold text-text-primary">Add Card</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {CATEGORIES.map((category) => {
            const cards = CARD_TYPES.filter((c) => c.category === category);
            if (cards.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {cards.map((cardDef) => (
                    <button
                      key={cardDef.type}
                      onClick={() => onAdd(cardDef)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border-primary bg-bg-tertiary hover:border-accent-blue hover:bg-bg-tertiary/80 transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-accent-blue/10 text-accent-blue group-hover:bg-accent-blue/20 flex-shrink-0">
                        <cardDef.icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary">
                          {cardDef.name}
                        </p>
                        <p className="text-[10px] text-text-tertiary mt-0.5 leading-tight">
                          {cardDef.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { CARD_TYPES };
