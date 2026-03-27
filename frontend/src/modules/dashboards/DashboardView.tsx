import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Pencil,
  Maximize2,
  Minimize2,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDashboard,
  useAddCard,
  useDeleteCard,
  useUpdateCard,
  useUpdateLayout,
} from '@/hooks/useDashboards';
import type { DashboardCard } from '@/hooks/useDashboards';
import { AddCardModal, CARD_TYPES } from './AddCardModal';
import type { CardTypeDefinition } from './AddCardModal';
import { StatusChartCard } from './cards/StatusChartCard';
import { PriorityChartCard } from './cards/PriorityChartCard';
import { KPICard } from './cards/KPICard';
import { TaskListCard } from './cards/TaskListCard';
import { GoalProgressCard } from './cards/GoalProgressCard';
import { RecentActivityCard } from './cards/RecentActivityCard';
import { TextBlockCard } from './cards/TextBlockCard';
import { EmbedCard } from './cards/EmbedCard';
import { DueDateOverviewCard } from './cards/DueDateOverviewCard';
import { WorkloadCard } from './cards/WorkloadCard';

interface DashboardViewProps {
  dashboardId: string;
  onBack: () => void;
}

export function DashboardView({ dashboardId, onBack }: DashboardViewProps) {
  const { data: dashboard, isLoading, refetch } = useDashboard(dashboardId);
  const addCard = useAddCard(dashboardId);
  const updateLayout = useUpdateLayout(dashboardId);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleRefreshAll = () => {
    refetch();
  };

  const handleAddCard = (cardDef: CardTypeDefinition) => {
    // Calculate next position: place in a flowing grid
    const cards = dashboard?.cards ?? [];
    const nextY = cards.length > 0
      ? Math.max(...cards.map((c) => (c.layout?.y ?? 0) + (c.layout?.h ?? 1)))
      : 0;

    addCard.mutate({
      type: cardDef.type,
      title: cardDef.name,
      config: cardDef.defaultConfig,
      layout: {
        x: 0,
        y: nextY,
        w: cardDef.defaultLayout.w,
        h: cardDef.defaultLayout.h,
      },
    });
    setShowAddCard(false);
  };

  if (isLoading) {
    return <DashboardViewSkeleton onBack={onBack} />;
  }

  const cards = dashboard?.cards ?? [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-semibold text-text-primary">
            {dashboard?.name ?? 'Dashboard'}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Refresh all */}
          <button
            onClick={handleRefreshAll}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
            title="Refresh all"
          >
            <RefreshCw size={14} />
          </button>

          {/* Edit toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              isEditMode
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            )}
          >
            <Pencil size={12} />
            {isEditMode ? 'Done' : 'Edit'}
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Grid content */}
      <div className="flex-1 overflow-y-auto p-6">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-text-tertiary">
            <p className="text-sm font-medium text-text-secondary">No cards yet</p>
            <p className="text-xs mt-1">Add cards to build your dashboard.</p>
            <button
              onClick={() => setShowAddCard(true)}
              className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
            >
              <Plus size={14} />
              Add Card
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 auto-rows-[140px]">
            {cards.map((card) => (
              <div
                key={card.id}
                className="min-h-0"
                style={{
                  gridColumn: `span ${Math.min(card.layout?.w ?? 4, 12)}`,
                  gridRow: `span ${card.layout?.h ?? 2}`,
                }}
              >
                <RenderCard
                  card={card}
                  isEditMode={isEditMode}
                  dashboardId={dashboardId}
                />
              </div>
            ))}
          </div>
        )}

        {/* Floating add button in edit mode */}
        {isEditMode && cards.length > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setShowAddCard(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-dashed border-border-secondary text-text-tertiary hover:text-text-primary hover:border-accent-blue transition-colors"
            >
              <Plus size={14} />
              Add Card
            </button>
          </div>
        )}
      </div>

      {/* Add card modal */}
      {showAddCard && (
        <AddCardModal
          onAdd={handleAddCard}
          onClose={() => setShowAddCard(false)}
        />
      )}
    </div>
  );
}

// ==========================================
// Card renderer
// ==========================================

function RenderCard({
  card,
  isEditMode,
  dashboardId,
}: {
  card: DashboardCard;
  isEditMode: boolean;
  dashboardId: string;
}) {
  const deleteCard = useDeleteCard(card.id);
  const updateCard = useUpdateCard(card.id);

  const handleDelete = () => {
    deleteCard.mutate();
  };

  const handleUpdateConfig = (config: Record<string, unknown>) => {
    updateCard.mutate({ config });
  };

  const commonProps = {
    cardId: card.id,
    title: card.title,
    config: card.config ?? {},
    isEditMode,
    onDelete: handleDelete,
    onConfigure: undefined, // Could open a config modal in the future
    onUpdateConfig: handleUpdateConfig,
  };

  switch (card.type) {
    case 'STATUS_CHART':
      return <StatusChartCard {...commonProps} />;
    case 'PRIORITY_CHART':
      return <PriorityChartCard {...commonProps} />;
    case 'KPI':
      return <KPICard {...commonProps} />;
    case 'TASK_LIST':
      return <TaskListCard {...commonProps} />;
    case 'GOAL_PROGRESS':
      return <GoalProgressCard {...commonProps} />;
    case 'RECENT_ACTIVITY':
      return <RecentActivityCard {...commonProps} />;
    case 'TEXT_BLOCK':
      return <TextBlockCard {...commonProps} />;
    case 'EMBED':
      return <EmbedCard {...commonProps} />;
    case 'DUE_DATE_OVERVIEW':
      return <DueDateOverviewCard {...commonProps} />;
    case 'WORKLOAD':
      return <WorkloadCard {...commonProps} />;
    default:
      return (
        <div className="bg-bg-secondary border border-border-primary rounded-xl flex items-center justify-center h-full text-text-tertiary text-xs">
          Unknown card type: {card.type}
        </div>
      );
  }
}

// ==========================================
// Skeleton
// ==========================================

function DashboardViewSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border-primary">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex-1 p-6">
        <div className="grid grid-cols-12 gap-4 auto-rows-[140px]">
          {[4, 4, 4, 6, 6, 3, 3, 3, 3].map((w, i) => (
            <div
              key={i}
              className="bg-bg-secondary border border-border-primary rounded-xl p-4"
              style={{ gridColumn: `span ${w}`, gridRow: 'span 2' }}
            >
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
