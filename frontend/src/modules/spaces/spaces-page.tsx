import { useState, useCallback, useMemo } from 'react';
import { SpacesSidebar } from '@/components/layout/SpacesSidebar';
import { SpaceOverviewPage } from './SpaceOverviewPage';
import { ListViewPage } from './ListViewPage';
import { SpaceSettingsPage } from './SpaceSettingsPage';
import { FolderSettingsPage } from './FolderSettingsPage';
import { ListSettingsPage } from './ListSettingsPage';
import { ViewsBar } from '@/components/layout/ViewsBar';
import { ViewControlsBar } from '@/components/views/ViewControlsBar';
import { ListView } from '@/modules/views/ListView';
import { BoardView } from '@/modules/views/BoardView';
import { TableView } from '@/modules/views/TableView';
import { CalendarView } from '@/modules/views/CalendarView';
import { GanttView } from '@/modules/views/GanttView';
import { TimelineView } from '@/modules/views/TimelineView';
import { WorkloadView } from '@/modules/views/WorkloadView';
import { ActivityView } from '@/modules/views/ActivityView';
import { TeamView } from '@/modules/views/TeamView';
import { EmbedView } from '@/modules/views/EmbedView';
import { FormView } from '@/modules/views/FormView';
import { useView } from '@/hooks/useViews';
import { useViewQuery } from '@/hooks/useViewQuery';
import { useCustomFieldsAtLocation } from '@/hooks/useCustomFields';
import type { FilterCondition, SortCondition } from '@/hooks/useViews';
import { Layers } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { useSpace } from '@/hooks/useSpaces';
import { useFolder } from '@/hooks/useFolders';
import { useList } from '@/hooks/useLists';

type ViewType = 'none' | 'space' | 'folder' | 'list';
type SettingsTarget = null | { kind: 'space'; spaceId: string } | { kind: 'folder'; folderId: string; spaceId: string } | { kind: 'list'; listId: string; spaceId: string };

interface ViewState {
  type: ViewType;
  spaceId?: string;
  folderId?: string;
  listId?: string;
}

export function SpacesPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [view, setView] = useState<ViewState>({ type: 'none' });
  const [settings, setSettings] = useState<SettingsTarget>(null);

  // View state for list views
  const [activeViewId, setActiveViewId] = useState<string | undefined>();
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sorts, setSorts] = useState<SortCondition[]>([]);
  const [groupBy, setGroupBy] = useState<string | undefined>();
  const [subGroupBy, setSubGroupBy] = useState<string | undefined>();
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showClosedTasks, setShowClosedTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load saved view config when active view changes
  const { data: activeViewData } = useView(activeViewId);

  const handleSelectView = useCallback((viewId: string) => {
    setActiveViewId(viewId);
  }, []);

  // When view data loads, apply its config
  const lastAppliedViewId = useState<string | null>(null);
  if (activeViewData && activeViewData.id !== lastAppliedViewId[0]) {
    lastAppliedViewId[1](activeViewData.id);
    const config = activeViewData.config ?? {};
    setFilters(config.filters ?? []);
    setSorts(config.sorts ?? []);
    setGroupBy(config.groupBy);
    setSubGroupBy(config.subGroupBy);
    setShowSubtasks(config.showSubtasks ?? true);
    setShowClosedTasks(config.showClosedTasks ?? false);
  }

  const handleGroupByChange = useCallback((g: string | undefined, sg?: string | undefined) => {
    setGroupBy(g);
    setSubGroupBy(sg);
  }, []);

  const handleSelectSpace = useCallback((spaceId: string) => {
    setView({ type: 'space', spaceId });
    setSettings(null);
  }, []);

  const handleSelectFolder = useCallback((folderId: string, spaceId: string) => {
    setView({ type: 'folder', spaceId, folderId });
    setSettings(null);
  }, []);

  const handleSelectList = useCallback((listId: string, spaceId: string, folderId?: string) => {
    setView({ type: 'list', spaceId, folderId, listId });
    setSettings(null);
  }, []);

  const handleOpenSpaceSettings = useCallback((spaceId: string) => {
    setSettings({ kind: 'space', spaceId });
  }, []);

  const handleOpenFolderSettings = useCallback((folderId: string, spaceId: string) => {
    setSettings({ kind: 'folder', folderId, spaceId });
  }, []);

  const handleOpenListSettings = useCallback((listId: string, spaceId: string) => {
    setSettings({ kind: 'list', listId, spaceId });
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettings(null);
  }, []);

  const activeItemId =
    view.type === 'list' ? view.listId ?? null :
    view.type === 'folder' ? view.folderId ?? null :
    view.type === 'space' ? view.spaceId ?? null :
    null;

  const activeItemType: 'space' | 'folder' | 'list' | null =
    view.type === 'none' ? null : view.type;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <SpacesSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
        activeItemId={activeItemId}
        activeItemType={activeItemType}
        onSelectSpace={handleSelectSpace}
        onSelectFolder={handleSelectFolder}
        onSelectList={handleSelectList}
      />

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {settings?.kind === 'space' ? (
          <SpaceSettingsPage spaceId={settings.spaceId} onBack={handleCloseSettings} />
        ) : settings?.kind === 'folder' ? (
          <FolderSettingsPage folderId={settings.folderId} spaceId={settings.spaceId} onBack={handleCloseSettings} />
        ) : settings?.kind === 'list' ? (
          <ListSettingsPage listId={settings.listId} spaceId={settings.spaceId} onBack={handleCloseSettings} />
        ) : view.type === 'space' && view.spaceId ? (
          <SpaceOverviewPage
            spaceId={view.spaceId}
            onSelectFolder={handleSelectFolder}
            onSelectList={handleSelectList}
            onOpenSettings={handleOpenSpaceSettings}
          />
        ) : view.type === 'folder' && view.spaceId ? (
          <SpaceOverviewPage
            spaceId={view.spaceId}
            onSelectFolder={handleSelectFolder}
            onSelectList={handleSelectList}
            onOpenSettings={handleOpenSpaceSettings}
          />
        ) : view.type === 'list' && view.listId ? (
          <ListViewContainer
            listId={view.listId}
            spaceId={view.spaceId}
            activeViewId={activeViewId}
            onSelectView={handleSelectView}
            filters={filters}
            sorts={sorts}
            groupBy={groupBy}
            subGroupBy={subGroupBy}
            showSubtasks={showSubtasks}
            showClosedTasks={showClosedTasks}
            searchQuery={searchQuery}
            onFiltersChange={setFilters}
            onSortsChange={setSorts}
            onGroupByChange={handleGroupByChange}
            onShowSubtasksChange={setShowSubtasks}
            onShowClosedTasksChange={setShowClosedTasks}
            onSearchChange={setSearchQuery}
            onOpenListSettings={view.spaceId ? (id: string) => handleOpenListSettings(id, view.spaceId!) : undefined}
            onSelectSpace={handleSelectSpace}
            onSelectFolder={handleSelectFolder}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary">
            <Layers size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium text-text-secondary">Spaces</p>
            <p className="text-sm mt-1 opacity-70">Select a space from the sidebar to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------
// ListViewContainer — wires useViewQuery into ListView
// -----------------------------------------------

interface ListViewContainerProps {
  listId: string;
  spaceId?: string;
  activeViewId?: string;
  onSelectView: (viewId: string) => void;
  filters: FilterCondition[];
  sorts: SortCondition[];
  groupBy?: string;
  subGroupBy?: string;
  showSubtasks: boolean;
  showClosedTasks: boolean;
  searchQuery: string;
  onFiltersChange: (f: FilterCondition[]) => void;
  onSortsChange: (s: SortCondition[]) => void;
  onGroupByChange: (g: string | undefined, sg?: string | undefined) => void;
  onShowSubtasksChange: (v: boolean) => void;
  onShowClosedTasksChange: (v: boolean) => void;
  onSearchChange: (q: string) => void;
  onOpenListSettings?: (listId: string) => void;
  onSelectSpace?: (spaceId: string) => void;
  onSelectFolder?: (folderId: string, spaceId: string) => void;
}

function ListViewContainer({
  listId,
  spaceId,
  activeViewId,
  onSelectView,
  filters,
  sorts,
  groupBy,
  subGroupBy,
  showSubtasks,
  showClosedTasks,
  searchQuery,
  onFiltersChange,
  onSortsChange,
  onGroupByChange,
  onShowSubtasksChange,
  onShowClosedTasksChange,
  onSearchChange,
  onOpenListSettings: _onOpenListSettings,
  onSelectSpace,
  onSelectFolder,
}: ListViewContainerProps) {
  const queryParams = useMemo(
    () => ({
      locationType: 'LIST',
      locationId: listId,
      filters,
      sorts,
      groupBy,
      subGroupBy,
      showSubtasks,
      showClosedTasks,
      search: searchQuery,
    }),
    [listId, filters, sorts, groupBy, subGroupBy, showSubtasks, showClosedTasks, searchQuery],
  );

  // Determine active view type from view data
  const { data: activeViewDataLocal } = useView(activeViewId);
  const activeViewType = activeViewDataLocal?.viewType ?? 'LIST';
  const isBoard = activeViewType === 'BOARD';
  const isTable = activeViewType === 'TABLE';
  const isCalendar = activeViewType === 'CALENDAR';
  const isGantt = activeViewType === 'GANTT';
  const isTimeline = activeViewType === 'TIMELINE';
  const isWorkload = activeViewType === 'WORKLOAD';
  const isActivity = activeViewType === 'ACTIVITY';
  const isTeam = activeViewType === 'TEAM';
  const isEmbed = activeViewType === 'EMBED';
  const isForm = activeViewType === 'FORM';

  // For board views, force groupBy to 'status' for proper column grouping
  const effectiveQueryParams = useMemo(() => {
    if (isBoard) {
      return { ...queryParams, groupBy: 'status' };
    }
    return queryParams;
  }, [queryParams, isBoard]);

  const { tasks, groups, isLoading } = useViewQuery(effectiveQueryParams);
  const { data: customFields } = useCustomFieldsAtLocation('LIST', listId);

  const handleTaskClick = useCallback((taskId: string) => {
    // Task detail open — could navigate or open a panel
    console.log('Open task:', taskId);
  }, []);

  const handleRefresh = useCallback(() => {
    // useViewQuery auto-refetches on param change; this is for manual refresh
  }, []);

  // Build groups array for ListView / BoardView
  const groupsArray = useMemo(() => {
    if ((!groupBy && !isBoard) || !groups || Object.keys(groups).length === 0) return undefined;
    return Object.entries(groups).map(([key, groupTasks]) => ({
      name: key,
      value: key,
      count: Array.isArray(groupTasks) ? groupTasks.length : 0,
      tasks: (Array.isArray(groupTasks) ? groupTasks : []) as any[],
    }));
  }, [groupBy, isBoard, groups]);

  // Breadcrumb data
  const { data: spaceData } = useSpace(spaceId);
  const { data: listData } = useList(listId);
  // Folder ID would need to be passed; for now we derive from list parent if available
  const folderId = (listData as any)?.folderId as string | undefined;
  const { data: folderData } = useFolder(folderId);

  const breadcrumbItems = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void }> = [];
    items.push({ label: 'Workspace' });
    if (spaceData) {
      items.push({
        label: spaceData.name || 'Space',
        onClick: spaceId && onSelectSpace ? () => onSelectSpace(spaceId) : undefined,
      });
    }
    if (folderData) {
      items.push({
        label: folderData.name || 'Folder',
        onClick: folderId && spaceId && onSelectFolder ? () => onSelectFolder(folderId, spaceId) : undefined,
      });
    }
    if (listData) {
      items.push({ label: (listData as any).name || 'List' });
    }
    return items;
  }, [spaceData, folderData, listData, spaceId, folderId, onSelectSpace, onSelectFolder]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Breadcrumbs items={breadcrumbItems} className="px-4 py-2 border-b border-border-primary bg-bg-secondary" />
      <ViewsBar
        locationType="LIST"
        locationId={listId}
        activeViewId={activeViewId}
        onSelectView={onSelectView}
        onAddView={() => {}}
      />
      <ViewControlsBar
        filters={filters}
        sorts={sorts}
        groupBy={groupBy}
        subGroupBy={subGroupBy}
        showSubtasks={showSubtasks}
        showClosedTasks={showClosedTasks}
        onFiltersChange={onFiltersChange}
        onSortsChange={onSortsChange}
        onGroupByChange={onGroupByChange}
        onShowSubtasksChange={onShowSubtasksChange}
        onShowClosedTasksChange={onShowClosedTasksChange}
        onSearchChange={onSearchChange}
        locationType="LIST"
        locationId={listId}
        viewId={activeViewId}
        listId={listId}
      />
      {isActivity ? (
        <ActivityView
          tasks={tasks as any[]}
          isLoading={isLoading}
          listId={listId}
          spaceId={spaceId}
          locationType="LIST"
          locationId={listId}
        />
      ) : isTeam ? (
        <TeamView
          tasks={tasks as any[]}
          isLoading={isLoading}
          spaceId={spaceId}
        />
      ) : isEmbed ? (
        <EmbedView
          config={activeViewDataLocal?.config as any}
          onConfigChange={(config) => {
            // Could persist embed URL to view config here
            console.log('Embed config changed:', config);
          }}
        />
      ) : isForm ? (
        <FormView
          listId={listId}
          spaceId={spaceId}
          onTaskClick={handleTaskClick}
        />
      ) : isTimeline ? (
        <TimelineView
          tasks={tasks as any[]}
          isLoading={isLoading}
          listId={listId}
          spaceId={spaceId}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
        />
      ) : isWorkload ? (
        <WorkloadView
          tasks={tasks as any[]}
          isLoading={isLoading}
          spaceId={spaceId}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
        />
      ) : isGantt ? (
        <GanttView
          tasks={tasks as any[]}
          groups={groupsArray}
          isLoading={isLoading}
          groupBy={groupBy}
          listId={listId}
          spaceId={spaceId}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
        />
      ) : isCalendar ? (
        <CalendarView
          tasks={tasks as any[]}
          isLoading={isLoading}
          listId={listId}
          spaceId={spaceId}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
        />
      ) : isBoard ? (
        <BoardView
          tasks={tasks as any[]}
          groups={groupsArray}
          isLoading={isLoading}
          listId={listId}
          spaceId={spaceId}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
        />
      ) : isTable ? (
        <TableView
          tasks={tasks as any[]}
          groups={groupsArray}
          isLoading={isLoading}
          groupBy={groupBy}
          listId={listId}
          spaceId={spaceId}
          customFields={customFields}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
        />
      ) : (
        <ListView
          tasks={tasks as any[]}
          groups={groupsArray}
          isLoading={isLoading}
          groupBy={groupBy}
          listId={listId}
          spaceId={spaceId}
          onTaskClick={handleTaskClick}
          onRefresh={handleRefresh}
          customFields={customFields}
        />
      )}
    </div>
  );
}
