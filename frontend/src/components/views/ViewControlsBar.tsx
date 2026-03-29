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

// Shared button style helper
function controlBtnStyle(isActive: boolean) {
  return {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 6,
    color: isActive ? '#60A5FA' : 'rgba(255,255,255,0.40)',
    background: isActive ? 'rgba(37,99,235,0.10)' : 'transparent',
    transition: 'all 100ms',
  } as React.CSSProperties;
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
        onFiltersChange([...filters, { field: 'assignee', operator: 'is', value: 'me' }]);
      } else {
        onFiltersChange(filters.filter((f) => !(f.field === 'assignee' && f.value === 'me')));
      }
      return next;
    });
  }, [filters, onFiltersChange]);

  const hoverHandlers = (isActive: boolean) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isActive) {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
      }
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isActive) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
      }
    },
  });

  return (
    <div
      className="flex items-center"
      style={{
        height: 36,
        padding: '0 16px',
        gap: 2,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#09090B',
      }}
    >
      {/* Filter */}
      <div className="relative">
        <button
          onClick={() => { setShowFilters((p) => !p); setShowSorts(false); setShowGroupBy(false); }}
          className="flex items-center gap-1.5"
          style={controlBtnStyle(filters.length > 0)}
          {...hoverHandlers(filters.length > 0)}
        >
          <Filter size={12} />
          Filter
          {filters.length > 0 && (
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 16,
                height: 16,
                fontSize: 10,
                fontWeight: 500,
                borderRadius: 9999,
                background: '#2563EB',
                color: '#ffffff',
              }}
            >
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
          className="flex items-center gap-1.5"
          style={controlBtnStyle(sorts.length > 0)}
          {...hoverHandlers(sorts.length > 0)}
        >
          <ArrowUpDown size={12} />
          Sort
          {sorts.length > 0 && (
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 16,
                height: 16,
                fontSize: 10,
                fontWeight: 500,
                borderRadius: 9999,
                background: '#2563EB',
                color: '#ffffff',
              }}
            >
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
          className="flex items-center gap-1.5"
          style={controlBtnStyle(!!groupBy)}
          {...hoverHandlers(!!groupBy)}
        >
          <Layers size={12} />
          Group
          {groupBy && (
            <span style={{ fontSize: 10, opacity: 0.8 }}>{groupBy}</span>
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
        className="flex items-center gap-1.5"
        style={controlBtnStyle(showSubtasks)}
        {...hoverHandlers(showSubtasks)}
        title={showSubtasks ? 'Hide subtasks' : 'Show subtasks'}
      >
        {showSubtasks ? <Eye size={12} /> : <EyeOff size={12} />}
        Subtasks
      </button>

      {/* Closed toggle */}
      <button
        onClick={() => onShowClosedTasksChange(!showClosedTasks)}
        className="flex items-center gap-1.5"
        style={controlBtnStyle(showClosedTasks)}
        {...hoverHandlers(showClosedTasks)}
      >
        Closed
      </button>

      {/* Me Mode */}
      <button
        onClick={handleMeToggle}
        className="flex items-center gap-1.5"
        style={controlBtnStyle(meMode)}
        {...hoverHandlers(meMode)}
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
          className="flex items-center gap-1.5"
          style={controlBtnStyle(false)}
          {...hoverHandlers(false)}
          title="Import tasks from CSV"
        >
          <Upload size={12} />
          Import
        </button>
      )}

      {/* Search */}
      <div className="flex items-center">
        {searchExpanded ? (
          <div
            className="flex items-center gap-1"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '2px 8px',
            }}
          >
            <Search size={12} style={{ color: 'rgba(255,255,255,0.40)', flexShrink: 0 }} />
            <input
              autoFocus
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent outline-none focus-visible:ring-1 focus-visible:ring-[#2563EB] rounded"
              style={{
                fontSize: 12,
                color: '#ffffff',
                width: 160,
              }}
            />
            <button
              onClick={() => { setSearchExpanded(false); handleSearchChange(''); }}
              style={{ color: 'rgba(255,255,255,0.40)' }}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchExpanded(true)}
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              color: 'rgba(255,255,255,0.40)',
              background: 'transparent',
              transition: 'all 100ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
            }}
          >
            <Search size={14} />
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
