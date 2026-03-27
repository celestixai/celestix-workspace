import { useCustomFieldValues, type FieldDefinition, type FieldValue } from '@/hooks/useCustomFields';
import { CustomFieldValue } from './CustomFieldValue';

interface TaskFieldValuesProps {
  taskId: string;
  fields: FieldDefinition[];
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

export function TaskFieldValues({ taskId, fields }: TaskFieldValuesProps) {
  const { data: values } = useCustomFieldValues(taskId);

  if (!values || values.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {fields.slice(0, 4).map((field) => {
        const val = resolveValue(field, values);
        if (val == null && field.fieldType !== 'CHECKBOX') return null;
        return (
          <div key={field.id} className="flex items-center gap-1" title={field.name}>
            <CustomFieldValue field={field} value={val} />
          </div>
        );
      })}
    </div>
  );
}
