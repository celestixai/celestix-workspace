-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETE', 'CLOSED');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('BLOCKS', 'WAITING_ON', 'LINKED_TO');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DashboardCardType" AS ENUM ('STATUS_CHART', 'PRIORITY_CHART', 'ASSIGNEE_WORKLOAD', 'TIME_TRACKING', 'SPRINT_BURNDOWN', 'SPRINT_VELOCITY', 'DUE_DATE_OVERVIEW', 'CUSTOM_FIELD_CHART', 'TEXT_BLOCK', 'EMBED', 'TASK_LIST', 'GOAL_PROGRESS', 'TIMESHEET', 'CALCULATION', 'RECENT_ACTIVITY', 'CHAT_EMBED', 'PIE_CHART', 'LINE_CHART', 'BAR_CHART', 'KPI_CARD');

-- CreateEnum
CREATE TYPE "InboxItemType" AS ENUM ('TASK_ASSIGNED', 'TASK_MENTIONED', 'COMMENT_ASSIGNED', 'COMMENT_MENTION', 'STATUS_CHANGED', 'DUE_DATE_REMINDER', 'CUSTOM_REMINDER', 'WATCHER_UPDATE', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "InboxCategory" AS ENUM ('PRIMARY', 'OTHER', 'LATER');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'MONEY', 'DROPDOWN', 'MULTI_SELECT', 'LABEL', 'DATE', 'CHECKBOX', 'EMAIL', 'PHONE', 'URL', 'RATING', 'PROGRESS', 'FILE', 'RELATIONSHIP', 'FORMULA', 'ROLLUP', 'LOCATION', 'VOTING', 'PEOPLE', 'AI_SUMMARY', 'AI_SENTIMENT', 'AI_CUSTOM');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('TASK', 'LIST', 'FOLDER', 'SPACE');

-- CreateEnum
CREATE TYPE "HierarchyLevel" AS ENUM ('WORKSPACE', 'SPACE', 'FOLDER', 'LIST');

-- CreateEnum
CREATE TYPE "AutomationLogStatus" AS ENUM ('SUCCESS', 'PARTIAL_FAILURE', 'FAILURE');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('LIST', 'BOARD', 'TABLE', 'CALENDAR', 'GANTT', 'TIMELINE', 'WORKLOAD', 'MIND_MAP', 'MAP', 'TEAM', 'ACTIVITY', 'FORM', 'EMBED');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "SyncUpStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR', 'SLACK', 'GITHUB', 'GOOGLE_DRIVE', 'WEBHOOK_INCOMING', 'WEBHOOK_OUTGOING', 'ZAPIER');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('NUMBER', 'CURRENCY', 'TRUE_FALSE', 'TASK_COMPLETION', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "ClipType" AS ENUM ('SCREEN_RECORDING', 'VOICE_CLIP');

-- CreateEnum
CREATE TYPE "GoalRole" AS ENUM ('OWNER', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TimeOffType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'HOLIDAY', 'OTHER');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SharePermission" ADD VALUE 'COMMENT';
ALTER TYPE "SharePermission" ADD VALUE 'FULL';

-- DropForeignKey
-- DropForeignKey
-- DropForeignKey
-- DropForeignKey
-- DropForeignKey
-- DropForeignKey
-- DropForeignKey
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "cover_image_url" TEXT,
ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_wiki" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_doc_id" UUID,
ADD COLUMN     "published_url" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "space_id" UUID;

-- AlterTable
ALTER TABLE "spaces_hierarchy" ADD COLUMN     "task_id_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "task_id_prefix" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "cover_image_color" TEXT,
ADD COLUMN     "cover_image_url" TEXT,
ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrence_config" JSONB,
ADD COLUMN     "recurrence_parent_id" UUID,
ADD COLUMN     "recurring_schedule_id" UUID,
ADD COLUMN     "sprint_id" UUID,
ADD COLUMN     "story_points" DOUBLE PRECISION,
ADD COLUMN     "task_type_id" UUID,
ADD COLUMN     "time_estimate" INTEGER;

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "billable_amount" DOUBLE PRECISION,
ADD COLUMN     "billable_rate" DOUBLE PRECISION,
ADD COLUMN     "is_billable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "tags" JSONB;

-- AlterTable
ALTER TABLE "ws_messages" ADD COLUMN     "is_follow_up" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- DropTable
-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "sync_status" TEXT,
    "connected_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_ups" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "started_by_id" UUID NOT NULL,
    "title" TEXT,
    "status" "SyncUpStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "recording_url" TEXT,
    "transcript_text" TEXT,
    "transcript_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_up_participants" (
    "id" UUID NOT NULL,
    "sync_up_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "is_audio_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_video_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_screen_sharing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sync_up_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_schedules" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "days_of_week" JSONB,
    "day_of_month" INTEGER,
    "month_of_year" INTEGER,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "max_occurrences" INTEGER,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "create_before" INTEGER NOT NULL DEFAULT 0,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_relationships" (
    "id" UUID NOT NULL,
    "source_task_id" UUID NOT NULL,
    "target_task_id" UUID NOT NULL,
    "type" "RelationType" NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_comments_enhanced" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "highlighted_text" TEXT,
    "position_json" JSONB,
    "parent_comment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_comments_enhanced_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_templates" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "content_json" JSONB,
    "category" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_types" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_items" (
    "id" UUID NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_id" UUID NOT NULL,
    "shared_with_user_id" UUID,
    "shared_with_team_id" UUID,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "shared_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_links" (
    "id" UUID NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "password" TEXT,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "field_type" "CustomFieldType" NOT NULL,
    "config" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_locations" (
    "id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "location_type" "HierarchyLevel" NOT NULL,
    "location_id" UUID NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "custom_field_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "value_text" TEXT,
    "value_number" DOUBLE PRECISION,
    "value_date" TIMESTAMP(3),
    "value_boolean" BOOLEAN,
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_type" "TemplateType" NOT NULL DEFAULT 'TASK',
    "template_data" JSONB NOT NULL,
    "tags" JSONB,
    "preview_image_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_watchers" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_tags" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4F8EF7',
    "description" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tags_new" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "task_tags_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_time_estimates" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_time_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "location_type" "HierarchyLevel" NOT NULL,
    "location_id" UUID,
    "name" TEXT NOT NULL,
    "view_type" "ViewType" NOT NULL,
    "icon" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "filters" JSONB,
    "sorts" JSONB,
    "group_by" TEXT,
    "sub_group_by" TEXT,
    "show_subtasks" BOOLEAN NOT NULL DEFAULT true,
    "show_closed_tasks" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automations" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "location_id" UUID,
    "location_type" "HierarchyLevel",
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "execution_count" INTEGER NOT NULL DEFAULT 0,
    "last_executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_logs" (
    "id" UUID NOT NULL,
    "automation_id" UUID NOT NULL,
    "task_id" UUID,
    "trigger_event" TEXT NOT NULL,
    "actions_executed" JSONB NOT NULL,
    "status" "AutomationLogStatus" NOT NULL,
    "error_message" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,

    CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_folders" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "folder_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "due_date" TIMESTAMP(3),
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_targets" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target_value" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "unit" TEXT,
    "list_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_members" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "GoalRole" NOT NULL DEFAULT 'CONTRIBUTOR',

    CONSTRAINT "goal_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards_custom" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_custom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_cards_custom" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "card_type" "DashboardCardType" NOT NULL,
    "title" TEXT,
    "config" JSONB,
    "position" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_cards_custom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_shares_custom" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "user_id" UUID,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_shares_custom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_type" "InboxItemType" NOT NULL,
    "source_type" TEXT,
    "source_id" UUID,
    "title" TEXT NOT NULL,
    "preview" TEXT,
    "category" "InboxCategory" NOT NULL DEFAULT 'PRIMARY',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_actioned" BOOLEAN NOT NULL DEFAULT false,
    "is_snoozed" BOOLEAN NOT NULL DEFAULT false,
    "snooze_until" TIMESTAMP(3),
    "is_saved" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_config" JSONB,
    "related_task_id" UUID,
    "related_message_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_json" JSONB,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "cover_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "parent_comment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "assigned_to_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clips" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ClipType" NOT NULL,
    "duration" INTEGER,
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "transcript_text" TEXT,
    "transcript_json" JSONB,
    "file_size" BIGINT,
    "mime_type" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_folders" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_duration" INTEGER NOT NULL DEFAULT 14,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints_enhanced" (
    "id" UUID NOT NULL,
    "sprint_folder_id" UUID NOT NULL,
    "list_id" UUID,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNING',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed_points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "velocity" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprints_enhanced_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_history_points" (
    "id" UUID NOT NULL,
    "sprint_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "remaining_points" DOUBLE PRECISION NOT NULL,
    "completed_points" DOUBLE PRECISION NOT NULL,
    "total_tasks" INTEGER NOT NULL,
    "completed_tasks" INTEGER NOT NULL,
    "added_tasks" INTEGER NOT NULL DEFAULT 0,
    "removed_tasks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sprint_history_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "work_days" JSONB NOT NULL,
    "work_hours_per_day" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "start_time" TEXT NOT NULL DEFAULT '09:00',
    "end_time" TEXT NOT NULL DEFAULT '17:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_work_schedules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "user_work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TimeOffType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'APPROVED',
    "approved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_ups_channel_id_status_idx" ON "sync_ups"("channel_id", "status");

-- CreateIndex
CREATE INDEX "sync_up_participants_user_id_idx" ON "sync_up_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_up_participants_sync_up_id_user_id_left_at_key" ON "sync_up_participants"("sync_up_id", "user_id", "left_at");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_schedules_task_id_key" ON "recurring_schedules"("task_id");

-- CreateIndex
CREATE INDEX "recurring_schedules_status_next_run_at_idx" ON "recurring_schedules"("status", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_relationships_source_task_id_target_task_id_type_key" ON "task_relationships"("source_task_id", "target_task_id", "type");

-- CreateIndex
CREATE INDEX "doc_comments_enhanced_document_id_idx" ON "doc_comments_enhanced"("document_id");

-- CreateIndex
CREATE INDEX "doc_templates_workspace_id_idx" ON "doc_templates"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_space_id_name_key" ON "task_types"("space_id", "name");

-- CreateIndex
CREATE INDEX "shared_items_item_type_item_id_idx" ON "shared_items"("item_type", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_items_item_type_item_id_shared_with_user_id_key" ON "shared_items"("item_type", "item_id", "shared_with_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_links_token_key" ON "public_links"("token");

-- CreateIndex
CREATE INDEX "public_links_item_type_item_id_idx" ON "public_links"("item_type", "item_id");

-- CreateIndex
CREATE INDEX "custom_field_definitions_workspace_id_idx" ON "custom_field_definitions"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_locations_field_id_location_type_location_id_key" ON "custom_field_locations"("field_id", "location_type", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_field_id_task_id_key" ON "custom_field_values"("field_id", "task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_watchers_task_id_user_id_key" ON "task_watchers"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_tags_workspace_id_name_key" ON "workspace_tags"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "task_tags_new_task_id_tag_id_key" ON "task_tags_new"("task_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_time_estimates_task_id_user_id_key" ON "task_time_estimates"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "automations_workspace_id_idx" ON "automations"("workspace_id");

-- CreateIndex
CREATE INDEX "automations_location_id_idx" ON "automations"("location_id");

-- CreateIndex
CREATE INDEX "automation_logs_automation_id_idx" ON "automation_logs"("automation_id");

-- CreateIndex
CREATE INDEX "goal_folders_workspace_id_idx" ON "goal_folders"("workspace_id");

-- CreateIndex
CREATE INDEX "goals_workspace_id_idx" ON "goals"("workspace_id");

-- CreateIndex
CREATE INDEX "goals_folder_id_idx" ON "goals"("folder_id");

-- CreateIndex
CREATE INDEX "goal_targets_goal_id_idx" ON "goal_targets"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "goal_members_goal_id_user_id_key" ON "goal_members"("goal_id", "user_id");

-- CreateIndex
CREATE INDEX "inbox_items_user_id_category_idx" ON "inbox_items"("user_id", "category");

-- CreateIndex
CREATE INDEX "inbox_items_user_id_is_read_idx" ON "inbox_items"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "reminders_user_id_due_at_idx" ON "reminders"("user_id", "due_at");

-- CreateIndex
CREATE INDEX "reminders_user_id_is_completed_idx" ON "reminders"("user_id", "is_completed");

-- CreateIndex
CREATE INDEX "posts_channel_id_created_at_idx" ON "posts"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "post_comments_post_id_created_at_idx" ON "post_comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "follow_ups_assigned_to_id_status_idx" ON "follow_ups"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "follow_ups_channel_id_idx" ON "follow_ups"("channel_id");

-- CreateIndex
CREATE INDEX "clips_workspace_id_created_at_idx" ON "clips"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "clips_created_by_id_idx" ON "clips"("created_by_id");

-- CreateIndex
CREATE INDEX "sprint_folders_space_id_idx" ON "sprint_folders"("space_id");

-- CreateIndex
CREATE INDEX "sprints_enhanced_sprint_folder_id_idx" ON "sprints_enhanced"("sprint_folder_id");

-- CreateIndex
CREATE INDEX "sprints_enhanced_status_idx" ON "sprints_enhanced"("status");

-- CreateIndex
CREATE INDEX "sprint_history_points_sprint_id_date_idx" ON "sprint_history_points"("sprint_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_work_schedules_user_id_schedule_id_effective_from_key" ON "user_work_schedules"("user_id", "schedule_id", "effective_from");

-- CreateIndex
CREATE INDEX "teams_workspace_id_idx" ON "teams"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_slug_key" ON "documents"("slug");

-- CreateIndex
CREATE INDEX "documents_parent_doc_id_idx" ON "documents"("parent_doc_id");

-- CreateIndex
CREATE INDEX "documents_slug_idx" ON "documents"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_custom_task_id_key" ON "tasks"("custom_task_id");

-- CreateIndex
CREATE INDEX "tasks_is_recurring_idx" ON "tasks"("is_recurring");

-- CreateIndex
CREATE INDEX "tasks_sprint_id_idx" ON "tasks"("sprint_id");

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_connected_by_id_fkey" FOREIGN KEY ("connected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_ups" ADD CONSTRAINT "sync_ups_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "ws_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_ups" ADD CONSTRAINT "sync_ups_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_up_participants" ADD CONSTRAINT "sync_up_participants_sync_up_id_fkey" FOREIGN KEY ("sync_up_id") REFERENCES "sync_ups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_up_participants" ADD CONSTRAINT "sync_up_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "task_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints_enhanced"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relationships" ADD CONSTRAINT "task_relationships_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relationships" ADD CONSTRAINT "task_relationships_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_relationships" ADD CONSTRAINT "task_relationships_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_doc_id_fkey" FOREIGN KEY ("parent_doc_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_comments_enhanced" ADD CONSTRAINT "doc_comments_enhanced_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_comments_enhanced" ADD CONSTRAINT "doc_comments_enhanced_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_comments_enhanced" ADD CONSTRAINT "doc_comments_enhanced_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "doc_comments_enhanced"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_templates" ADD CONSTRAINT "doc_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_templates" ADD CONSTRAINT "doc_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces_hierarchy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_items" ADD CONSTRAINT "shared_items_shared_by_id_fkey" FOREIGN KEY ("shared_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_items" ADD CONSTRAINT "shared_items_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_links" ADD CONSTRAINT "public_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_locations" ADD CONSTRAINT "custom_field_locations_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_tags" ADD CONSTRAINT "workspace_tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_tags" ADD CONSTRAINT "workspace_tags_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags_new" ADD CONSTRAINT "task_tags_new_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags_new" ADD CONSTRAINT "task_tags_new_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "workspace_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_estimates" ADD CONSTRAINT "task_time_estimates_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_estimates" ADD CONSTRAINT "task_time_estimates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_folders" ADD CONSTRAINT "goal_folders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_folders" ADD CONSTRAINT "goal_folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "goal_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_members" ADD CONSTRAINT "goal_members_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_members" ADD CONSTRAINT "goal_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards_custom" ADD CONSTRAINT "dashboards_custom_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards_custom" ADD CONSTRAINT "dashboards_custom_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_cards_custom" ADD CONSTRAINT "dashboard_cards_custom_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards_custom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_shares_custom" ADD CONSTRAINT "dashboard_shares_custom_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards_custom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "ws_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "post_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ws_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "ws_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_folders" ADD CONSTRAINT "sprint_folders_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces_hierarchy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints_enhanced" ADD CONSTRAINT "sprints_enhanced_sprint_folder_id_fkey" FOREIGN KEY ("sprint_folder_id") REFERENCES "sprint_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_history_points" ADD CONSTRAINT "sprint_history_points_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints_enhanced"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_schedules" ADD CONSTRAINT "user_work_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_schedules" ADD CONSTRAINT "user_work_schedules_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

