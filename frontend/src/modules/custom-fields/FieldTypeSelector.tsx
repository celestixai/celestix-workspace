import {
  Type,
  AlignLeft,
  Hash,
  DollarSign,
  ChevronDown,
  CheckSquare,
  Tag,
  Calendar,
  CheckCircle,
  Mail,
  Phone,
  Link,
  Star,
  BarChart,
  Paperclip,
  GitBranch,
  Calculator,
  Layers,
  MapPin,
  ThumbsUp,
  Users,
  Sparkles,
  LucideIcon,
} from 'lucide-react';
import type { CustomFieldType } from '@/hooks/useCustomFields';

interface FieldTypeSelectorProps {
  onSelect: (type: CustomFieldType) => void;
}

interface FieldTypeInfo {
  type: CustomFieldType;
  label: string;
  icon: LucideIcon;
  description: string;
}

const STANDARD_FIELD_TYPES: FieldTypeInfo[] = [
  { type: 'TEXT', label: 'Text', icon: Type, description: 'Short text value' },
  { type: 'LONG_TEXT', label: 'Long Text', icon: AlignLeft, description: 'Multi-line text' },
  { type: 'NUMBER', label: 'Number', icon: Hash, description: 'Numeric value' },
  { type: 'MONEY', label: 'Money', icon: DollarSign, description: 'Currency amount' },
  { type: 'DROPDOWN', label: 'Dropdown', icon: ChevronDown, description: 'Single select' },
  { type: 'MULTI_SELECT', label: 'Multi Select', icon: CheckSquare, description: 'Multiple selections' },
  { type: 'LABEL', label: 'Label', icon: Tag, description: 'Label tags' },
  { type: 'DATE', label: 'Date', icon: Calendar, description: 'Date value' },
  { type: 'CHECKBOX', label: 'Checkbox', icon: CheckCircle, description: 'True or false' },
  { type: 'EMAIL', label: 'Email', icon: Mail, description: 'Email address' },
  { type: 'PHONE', label: 'Phone', icon: Phone, description: 'Phone number' },
  { type: 'URL', label: 'URL', icon: Link, description: 'Web link' },
  { type: 'RATING', label: 'Rating', icon: Star, description: 'Star rating' },
  { type: 'PROGRESS', label: 'Progress', icon: BarChart, description: 'Progress bar' },
  { type: 'FILE', label: 'File', icon: Paperclip, description: 'File attachment' },
  { type: 'RELATIONSHIP', label: 'Relationship', icon: GitBranch, description: 'Linked tasks' },
  { type: 'FORMULA', label: 'Formula', icon: Calculator, description: 'Calculated value' },
  { type: 'ROLLUP', label: 'Rollup', icon: Layers, description: 'Aggregated data' },
  { type: 'LOCATION', label: 'Location', icon: MapPin, description: 'Address/place' },
  { type: 'VOTING', label: 'Voting', icon: ThumbsUp, description: 'Vote counter' },
  { type: 'PEOPLE', label: 'People', icon: Users, description: 'Team members' },
];

const AI_FIELD_TYPES: FieldTypeInfo[] = [
  { type: 'AI_SUMMARY', label: 'AI Summary', icon: Sparkles, description: 'AI-generated summary' },
  { type: 'AI_SENTIMENT', label: 'AI Sentiment', icon: Sparkles, description: 'AI sentiment analysis' },
  { type: 'AI_CUSTOM', label: 'AI Custom', icon: Sparkles, description: 'Custom AI prompt' },
];

const FIELD_TYPES: FieldTypeInfo[] = [...STANDARD_FIELD_TYPES, ...AI_FIELD_TYPES];

export { FIELD_TYPES };
export type { FieldTypeInfo };

function FieldTypeGrid({ types, onSelect }: { types: FieldTypeInfo[]; onSelect: (type: CustomFieldType) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {types.map((ft) => {
        const Icon = ft.icon;
        return (
          <button
            key={ft.type}
            onClick={() => onSelect(ft.type)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border-secondary bg-bg-tertiary hover:bg-bg-hover hover:border-accent-blue/40 transition-colors text-center group"
          >
            <Icon size={18} className="text-text-tertiary group-hover:text-accent-blue transition-colors" />
            <span className="text-xs font-medium text-text-primary">{ft.label}</span>
            <span className="text-[10px] text-text-tertiary leading-tight">{ft.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FieldTypeSelector({ onSelect }: FieldTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <FieldTypeGrid types={STANDARD_FIELD_TYPES} onSelect={onSelect} />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-purple-400" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">AI Fields</span>
        </div>
        <FieldTypeGrid types={AI_FIELD_TYPES} onSelect={onSelect} />
      </div>
    </div>
  );
}
