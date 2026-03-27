import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  useCustomFieldsAtLocation,
  useCustomFieldValues,
  useSetFieldValue,
  type HierarchyLevel,
  type FieldDefinition,
  type FieldValue,
} from '@/hooks/useCustomFields';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { CreateFieldModal } from './CreateFieldModal';

interface CustomFieldsPanelProps {
  taskId: string;
  listId?: string;
  spaceId?: string;
  workspaceId?: string;
}

function resolveValue(field: FieldDefinition, values: FieldValue[]): any {
  const fv = values.find((v) => v.fieldId === field.id);
  if (!fv) return null;

  switch (field.fieldType) {
    case 'TEXT':
    case 'LONG_TEXT':
    case 'EMAIL':
    case 'PHONE':
    case 'URL':
    case 'LOCATION':
      return fv.valueText;
    case 'NUMBER':
    case 'MONEY':
    case 'RATING':
    case 'PROGRESS':
    case 'VOTING':
      return fv.valueNumber;
    case 'DATE':
      return fv.valueDate;
    case 'CHECKBOX':
      return fv.valueBoolean;
    case 'DROPDOWN':
    case 'MULTI_SELECT':
    case 'LABEL':
    case 'PEOPLE':
    case 'FORMULA':
    case 'ROLLUP':
      return fv.valueJson;
    default:
      return fv.valueText ?? fv.valueNumber ?? fv.valueDate ?? fv.valueBoolean ?? fv.valueJson;
  }
}

export function CustomFieldsPanel({ taskId, listId, spaceId, workspaceId }: CustomFieldsPanelProps) {
  const locationType: HierarchyLevel | undefined = listId ? 'LIST' : spaceId ? 'SPACE' : undefined;
  const locationId = listId ?? spaceId;

  const { data: fields, isLoading: fieldsLoading } = useCustomFieldsAtLocation(locationType, locationId);
  const { data: values, isLoading: valuesLoading } = useCustomFieldValues(taskId);
  const setFieldValue = useSetFieldValue();

  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleChange = (fieldId: string, newValue: any) => {
    setFieldValue.mutate({ taskId, fieldId, value: newValue });
  };

  if (fieldsLoading || valuesLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-bg-tertiary rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!fields || fields.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs text-text-tertiary mb-3">No custom fields</p>
        {workspaceId && (
          <>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
            >
              <Plus size={12} />
              Add field
            </button>
            {showCreateModal && (
              <CreateFieldModal
                workspaceId={workspaceId}
                onClose={() => setShowCreateModal(false)}
                locationType={locationType}
                locationId={locationId}
              />
            )}
          </>
        )}
      </div>
    );
  }

  const fieldValues = values ?? [];

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">Custom Fields</h3>
      </div>

      {fields.map((field) => {
        const currentValue = resolveValue(field, fieldValues);
        const isEditing = editingFieldId === field.id;

        return (
          <div key={field.id} className="flex items-start gap-3 py-1.5">
            <span className="text-xs text-text-tertiary w-24 flex-shrink-0 pt-1.5 truncate" title={field.name}>
              {field.name}
            </span>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div onBlur={() => setEditingFieldId(null)}>
                  <CustomFieldRenderer
                    field={field}
                    value={currentValue}
                    onChange={(val) => handleChange(field.id, val)}
                    compact
                  />
                </div>
              ) : (
                <button
                  onClick={() => setEditingFieldId(field.id)}
                  className="w-full text-left min-h-[24px] flex items-center"
                >
                  {currentValue != null ? (
                    <CustomFieldRenderer
                      field={field}
                      value={currentValue}
                      onChange={(val) => handleChange(field.id, val)}
                      compact
                    />
                  ) : (
                    <span className="text-xs text-text-tertiary italic">Empty</span>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {workspaceId && (
        <>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-accent-blue mt-3 transition-colors"
          >
            <Plus size={12} />
            Add field
          </button>
          {showCreateModal && (
            <CreateFieldModal
              workspaceId={workspaceId}
              onClose={() => setShowCreateModal(false)}
              locationType={locationType}
              locationId={locationId}
            />
          )}
        </>
      )}
    </div>
  );
}
