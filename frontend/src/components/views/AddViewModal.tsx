import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateView } from '@/hooks/useViews';
import {
  List,
  LayoutGrid,
  Table2,
  Calendar,
  GanttChart,
  Clock,
  BarChart3,
  Activity,
  Users,
  Globe,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const VIEW_TYPES = [
  { type: 'list', label: 'List', icon: List },
  { type: 'board', label: 'Board', icon: LayoutGrid },
  { type: 'table', label: 'Table', icon: Table2 },
  { type: 'calendar', label: 'Calendar', icon: Calendar },
  { type: 'gantt', label: 'Gantt', icon: GanttChart },
  { type: 'timeline', label: 'Timeline', icon: Clock },
  { type: 'workload', label: 'Workload', icon: BarChart3 },
  { type: 'activity', label: 'Activity', icon: Activity },
  { type: 'team', label: 'Team', icon: Users },
  { type: 'embed', label: 'Embed', icon: Globe },
  { type: 'form', label: 'Form', icon: FileText },
];

interface AddViewModalProps {
  open: boolean;
  onClose: () => void;
  locationType: string;
  locationId: string;
  onCreated: (viewId: string) => void;
}

export function AddViewModal({ open, onClose, locationType, locationId, onCreated }: AddViewModalProps) {
  const [selectedType, setSelectedType] = useState('list');
  const [name, setName] = useState('');
  const [isPersonal, setIsPersonal] = useState(false);
  const createView = useCreateView();

  const handleCreate = async () => {
    const finalName = name.trim() || VIEW_TYPES.find((v) => v.type === selectedType)?.label || 'View';
    try {
      const result = await createView.mutateAsync({
        name: finalName,
        viewType: selectedType,
        locationType,
        locationId,
        isPersonal,
      });
      setName('');
      setSelectedType('list');
      setIsPersonal(false);
      onCreated(result.id);
    } catch {
      // Error is handled by TanStack Query
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add View" size="md">
      {/* View type grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {VIEW_TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors',
              selectedType === type
                ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                : 'border-border-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            <Icon size={20} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Name */}
      <div className="mb-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={VIEW_TYPES.find((v) => v.type === selectedType)?.label || 'View name'}
        />
      </div>

      {/* Personal/Shared toggle */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setIsPersonal(false)}
          className={cn(
            'px-3 py-1.5 text-xs rounded-md border transition-colors',
            !isPersonal
              ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
              : 'border-border-secondary text-text-secondary hover:bg-bg-hover',
          )}
        >
          Shared
        </button>
        <button
          onClick={() => setIsPersonal(true)}
          className={cn(
            'px-3 py-1.5 text-xs rounded-md border transition-colors',
            isPersonal
              ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
              : 'border-border-secondary text-text-secondary hover:bg-bg-hover',
          )}
        >
          Personal
        </button>
      </div>

      {/* Create button */}
      <div className="flex justify-end">
        <Button onClick={handleCreate} loading={createView.isPending}>
          Create View
        </Button>
      </div>
    </Modal>
  );
}
