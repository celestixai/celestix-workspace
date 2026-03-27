import { EventEmitter } from 'events';

export interface AutomationEvent {
  type: string; // matches trigger types: status_changed, task_created, assignee_changed, priority_changed
  taskId: string;
  userId: string; // who triggered it
  data: any; // event-specific data (e.g., { fromStatus, toStatus })
  workspaceId: string;
  spaceId?: string;
  listId?: string;
  _depth?: number; // internal: chain depth to prevent infinite loops
}

export const automationEvents = new EventEmitter();

// Increase max listeners since multiple automations may subscribe
automationEvents.setMaxListeners(50);

/**
 * Emit an automation event for processing by the engine.
 * Safe to call — if no engine is listening, the event is silently dropped.
 */
export function emitAutomationEvent(event: AutomationEvent) {
  automationEvents.emit('automation:trigger', event);
}
