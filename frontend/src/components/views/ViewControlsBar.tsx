import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FilterPanel } from './FilterPanel';
import { SortPanel } from './SortPanel';
import { GroupBySelector } from './GroupBySelector';
import { ExportButton } from './ExportButton';
import { ImportWizard } from './ImportWizard';
import type { FilterCondition, SortCondition } from '@/hooks/useViews';
import {
  Filter,
  ArrowUpDown,
  Layers,
  Eye,
  EyeOff,
  Search,
  User,
  Upload,
  X,
} from 'lucide-react';

interface ViewControlsBarProps {
  filters: FilterCondition[];
  sorts: SortCondition[];
  groupBy?: string;
  subGroupBy?: string;
  showSubtasks: boolean;
  showClosedTasks: boolean;
  onFiltersChange: (filters: FilterCondition[]) => void;
  onSortsChange: (sorts: SortCondition[]) => void;
  onGroupByChange: (groupBy: string | undefined, subGroupBy?: string | undefined) => void;
  onShowSubtasksChange: (show: boolean) => void;
  onShowClosedTasksChange: (show: boolean) => void;
  onSearchChange: (search: string) => void;
  locationType?: string;
  locationId?: string;
  viewId?: string;
  listId?: string;
  onImportComplete?: () => void;
}

export function ViewControlsBar({
  filters,
  sorts,
  groupBy,
  subGroupBy,
  showSubtasks,
  showClosedTasks,
  onFiltersChange,
  onSortsChange,
  onGroupByChange,
  onShowSubtasksChange,
  onShowClosedTasksChange,
  onSearchChange,
  locationType,
  locationId,
  viewId,
  listId,
  onImportComplete,
}: ViewControlsBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts] = useState(false);
  const [showGroupBy, setShowGroupBy] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [meMode, setMeMode] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleSearchChange = useCallback(
    (val: string) => {
      setSearchValue(val);
      onSearchChange(val);
    },
    [onSearchChange],
  );

  const handleMeToggle = useCallback(() => {
    setMeMode((prev) => {
      const next = !prev;
      if (next) {
        // Add "assignee is me" filter
        onFiltersChange([...filters, { field: 'assignee', operator: 'is', value: 'me' }]);
      } else {
        // Remove "assignee is me" filter
        onFiltersChange(filters.filter((f) => !(f.field === 'assignee' && f.value === 'me')));
      }
      return next;
    });
  }, [filters, onFiltersChange]);

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border-secondary bg-bg-secondary">
      {/* Filter */}
      <div className="relative">
        <button
          onClick={() => { setShowFilters((p) => !p); setShowSorts(false); setShowGroupBy(false); }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors',
            filters.length > 0
              ? 'text-accent-blue bg-accent-blue/10'
              : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
          )}
        >
          <Filter size={12} />
          Filter
          {filters.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium rounded-full bg-accent-blue text-white">
              {filters.length}
            </span>
          )}
        </button>
        {showFilters && (
          <FilterPanel
            filters={filters}
            onChange={onFiltersChange}
            onClose={() => setShowFilters(false)}
          />
        )}
      </div>

      {/* Sort */}
      <div className="relative">
        <button
          onClick={() => { setShowSorts((p) => !p); setShowFilters(false); setShowGroupBy(false); }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors',
            sorts.length > 0
              ? 'text-accent-blue bg-accent-blue/10'
              : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
          )}
        >
          <ArrowUpDown size={12} />
          Sort
          {sorts.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium rounded-full bg-accent-blue text-white">
              {sorts.length}
            </span>
          )}
        </button>
        {showSorts && (
          <SortPanel
            sorts={sorts}
            onChange={onSortsChange}
            onClose={() => setShowSorts(false)}
          />
        )}
      </div>

      {/* Group */}
      <div className="relative">
        <button
          onClick={() => { setShowGroupBy((p) => !p); setShowFilters(false); setShowSorts(false); }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors',
            groupBy
              ? 'text-accent-blue bg-accent-blue/10'
              : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
          )}
        >
          <Layers size={12} />
          Group
          {groupBy && (
            <span className="text-[10px] opacity-80">{groupBy}</span>
          )}
        </button>
        {showGroupBy && (
          <GroupBySelector
            groupBy={groupBy}
            subGroupBy={subGroupBy}
            onChange={onGroupByChange}
            onClose={() => setShowGroupBy(false)}
          />
        )}
      </div>

      {/* Subtasks toggle */}
      <button
        onClick={() => onShowSubtasksChange(!showSubtasks)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors',
          showSubtasks
            ? 'text-accent-blue bg-accent-blue/10'
            : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
        )}
        title={showSubtasks ? 'Hide subtasks' : 'Show subtasks'}
      >
        {showSubtasks ? <Eye size={12} /> : <EyeOff size={12} />}
        Subtasks
      </button>

      {/* Closed toggle */}
      <button
        onClick={() => onShowClosedTasksChange(!showClosedTasks)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors',
          showClosedTasks
            ? 'text-accent-blue bg-accent-blue/10'
            : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
        )}
      >
        Closed
      </button>

      {/* Me Mode */}
      <button
        onClick={handleMeToggle}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors',
          meMode
            ? 'text-accent-blue bg-accent-blue/10'
            : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
        )}
        title="Show only my tasks"
      >
        <User size={12} />
        Me
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export */}
      {locationType && locationId && (
        <ExportButton
          locationType={locationType}
          locationId={locationId}
          viewId={viewId}
        />
      )}

      {/* Import */}
      {listId && (
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
          title="Import tasks from CSV"
        >
          <Upload size={12} />
          Import
        </button>
      )}

      {/* Search */}
      <div className="flex items-center">
        {searchExpanded ? (
          <div className="flex items-center gap-1 bg-bg-tertiary rounded-md border border-border-secondary px-2 py-0.5">
            <Search size={12} className="text-text-tertiary flex-shrink-0" />
            <input
              autoFocus
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none w-40"
            />
            <button
              onClick={() => { setSearchExpanded(false); handleSearchChange(''); }}
              className="text-text-tertiary hover:text-text-primary"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchExpanded(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
          >
            <Search size={12} />
          </button>
        )}
      </div>

      {/* Import wizard modal */}
      {listId && (
        <ImportWizard
          open={showImport}
          onClose={() => setShowImport(false)}
          listId={listId}
          onImportComplete={onImportComplete}
        />
      )}
    </div>
  );
}
