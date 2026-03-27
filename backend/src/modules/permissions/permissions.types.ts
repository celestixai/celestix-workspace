export enum Permission {
  // Space level
  SPACE_VIEW = 'space:view',
  SPACE_EDIT = 'space:edit',
  SPACE_DELETE = 'space:delete',
  SPACE_MANAGE_MEMBERS = 'space:manage_members',
  SPACE_MANAGE_STATUSES = 'space:manage_statuses',

  // Folder level
  FOLDER_CREATE = 'folder:create',
  FOLDER_EDIT = 'folder:edit',
  FOLDER_DELETE = 'folder:delete',

  // List level
  LIST_CREATE = 'list:create',
  LIST_EDIT = 'list:edit',
  LIST_DELETE = 'list:delete',

  // Task level
  TASK_CREATE = 'task:create',
  TASK_EDIT = 'task:edit',
  TASK_DELETE = 'task:delete',
  TASK_ASSIGN = 'task:assign',
  TASK_COMMENT = 'task:comment',
  TASK_CHANGE_STATUS = 'task:change_status',

  // View level
  VIEW_CREATE = 'view:create',
  VIEW_EDIT = 'view:edit',
}

// Resource types the permission system handles
export type ResourceType = 'workspace' | 'space' | 'folder' | 'list' | 'task';
