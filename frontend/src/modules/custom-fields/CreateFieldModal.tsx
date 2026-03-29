import { useState } from 'react';
import { ArrowLeft, Plus, X, GripVertical } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useCreateField,
  useAddFieldLocation,
  type CustomFieldType,
  type HierarchyLevel,
  type FieldConfig,
  type FieldOption,
} from '@/hooks/useCustomFields';
import { FieldTypeSelector, FIELD_TYPES } from './FieldTypeSelector';

interface CreateFieldModalProps {
  workspaceId: string;
  onClose: () => void;
  locationType?: HierarchyLevel;
  locationId?: string;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'];

const DEFAULT_COLORS = [
  '#3B82F6', '#EF4444', '#22c55e', '#eab308', '#8B5CF6',
  '#F97316', '#f97316', '#14B8A6', '#2563EB', '#60A5FA',
];

function generateId() {
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function CreateFieldModal({ workspaceId, onClose, locationType, locationId }: CreateFieldModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<CustomFieldType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<FieldConfig>({});
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [ratingMax, setRatingMax] = useState(5);
  const [currency, setCurrency] = useState('USD');
  const [progressMin, setProgressMin] = useState(0);
  const [progressMax, setProgressMax] = useState(100);
  const [aiPrompt, setAiPrompt] = useState('');

  const createField = useCreateField(workspaceId);
  const addLocation = useAddFieldLocation();

  const handleSelectType = (type: CustomFieldType) => {
    setSelectedType(type);
    setStep(2);

    // Initialize defaults
    if (type === 'DROPDOWN' || type === 'MULTI_SELECT' || type === 'LABEL') {
      setOptions([
        { id: generateId(), name: 'Option 1', color: DEFAULT_COLORS[0] },
        { id: generateId(), name: 'Option 2', color: DEFAULT_COLORS[1] },
      ]);
    }
  };

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      { id: generateId(), name: `Option ${prev.length + 1}`, color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] },
    ]);
  };

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const updateOption = (id: string, updates: Partial<FieldOption>) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };

  const buildConfig = (): FieldConfig => {
    if (!selectedType) return {};
    switch (selectedType) {
      case 'DROPDOWN':
      case 'MULTI_SELECT':
      case 'LABEL':
        return { options };
      case 'RATING':
        return { max: ratingMax };
      case 'MONEY':
        return { currency };
      case 'PROGRESS':
        return { min: progressMin, max: progressMax };
      case 'AI_CUSTOM':
        return { prompt: aiPrompt || 'Analyze this task.' };
      default:
        return {};
    }
  };

  const handleCreate = async () => {
    if (!selectedType || !name.trim()) return;

    const fieldConfig = buildConfig();
    const field = await createField.mutateAsync({
      name: name.trim(),
      fieldType: selectedType,
      description: description.trim() || undefined,
      config: Object.keys(fieldConfig).length > 0 ? fieldConfig : undefined,
    });

    if (locationType && locationId && field?.id) {
      await addLocation.mutateAsync({
        fieldId: field.id,
        locationType,
        locationId,
      });
    }

    onClose();
  };

  const typeInfo = selectedType ? FIELD_TYPES.find((ft) => ft.type === selectedType) : null;
  const isLoading = createField.isPending || addLocation.isPending;

  return (
    <Modal open onClose={onClose} title={step === 1 ? 'Create Custom Field' : `New ${typeInfo?.label ?? ''} Field`} size="lg">
      {step === 1 ? (
        <FieldTypeSelector onSelect={handleSelectType} />
      ) : (
        <div className="space-y-4">
          {/* Back button */}
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={12} />
            Back to field types
          </button>

          {/* Name */}
          <Input
            label="Field Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${typeInfo?.label ?? 'My Field'}`}
            autoFocus
          />

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this field..."
              className="w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
            />
          </div>

          {/* Type-specific config */}
          {(selectedType === 'DROPDOWN' || selectedType === 'MULTI_SELECT' || selectedType === 'LABEL') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Options</label>
              <div className="space-y-1.5">
                {options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <GripVertical size={12} className="text-text-tertiary cursor-grab" />
                    <input
                      type="color"
                      value={opt.color ?? '#3b82f6'}
                      onChange={(e) => updateOption(opt.id, { color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border border-border-secondary bg-transparent"
                    />
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => updateOption(opt.id, { name: e.target.value })}
                      className="flex-1 h-8 px-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
                    />
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="p-1 text-text-tertiary hover:text-accent-red transition-colors"
                      disabled={options.length <= 1}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addOption}
                className="flex items-center gap-1.5 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors mt-1"
              >
                <Plus size={12} />
                Add option
              </button>
            </div>
          )}

          {selectedType === 'RATING' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Max Rating</label>
              <select
                value={ratingMax}
                onChange={(e) => setRatingMax(Number(e.target.value))}
                className="w-32 h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n} stars</option>
                ))}
              </select>
            </div>
          )}

          {selectedType === 'MONEY' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-32 h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {selectedType === 'PROGRESS' && (
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Min</label>
                <input
                  type="number"
                  value={progressMin}
                  onChange={(e) => setProgressMin(Number(e.target.value))}
                  className="w-20 h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Max</label>
                <input
                  type="number"
                  value={progressMax}
                  onChange={(e) => setProgressMax(Number(e.target.value))}
                  className="w-20 h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {selectedType === 'AI_CUSTOM' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">Custom AI Prompt</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Summarize the risk level of this task based on priority and due date"
                rows={3}
                className="w-full bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-primary placeholder:text-text-tertiary px-3 py-2 hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-all resize-y"
              />
              <span className="text-[10px] text-text-tertiary">
                Enter instructions for the AI. It will run against each task's data.
              </span>
            </div>
          )}

          {/* Error */}
          {createField.isError && (
            <p className="text-xs text-accent-red">
              Failed to create field. {(createField.error as any)?.response?.data?.message ?? 'Please try again.'}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim() || isLoading}
              loading={isLoading}
            >
              Create Field
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
