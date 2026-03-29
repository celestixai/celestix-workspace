import React, { useState, useEffect } from 'react';
import {
  Play, Plus, Trash2, X, Zap, Mail, MessageSquare, Bell,
  Globe, Clock, GitBranch, CheckCircle, XCircle, ChevronDown,
  ArrowDown, Settings, ToggleLeft, ToggleRight, ChevronLeft,
  ListOrdered, ClipboardList,
} from 'lucide-react';
import { api } from '@/lib/api';

type TriggerType = 'message' | 'schedule' | 'webhook' | 'event';
type ActionType = 'send_message' | 'send_email' | 'create_task' | 'send_notification' | 'http_request' | 'delay' | 'condition';

interface TriggerConfig {
  type: TriggerType;
  config: Record<string, string>;
}

interface ActionConfig {
  id: string;
  type: ActionType;
  config: Record<string, string>;
}

interface Workflow {
  id: string;
  name: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
  enabled: boolean;
  lastRunAt?: string;
  runCount: number;
  createdAt: string;
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'success' | 'failed';
  startedAt: string;
  duration: number;
  error?: string;
}

const TRIGGER_TYPES: { type: TriggerType; label: string; icon: React.ReactNode }[] = [
  { type: 'message', label: 'When message received', icon: <MessageSquare size={14} /> },
  { type: 'schedule', label: 'On schedule', icon: <Clock size={14} /> },
  { type: 'webhook', label: 'Webhook received', icon: <Globe size={14} /> },
  { type: 'event', label: 'On event', icon: <Zap size={14} /> },
];

const ACTION_TYPES: { type: ActionType; label: string; icon: React.ReactNode }[] = [
  { type: 'send_message', label: 'Send Message', icon: <MessageSquare size={14} /> },
  { type: 'send_email', label: 'Send Email', icon: <Mail size={14} /> },
  { type: 'create_task', label: 'Create Task', icon: <ClipboardList size={14} /> },
  { type: 'send_notification', label: 'Send Notification', icon: <Bell size={14} /> },
  { type: 'http_request', label: 'HTTP Request', icon: <Globe size={14} /> },
  { type: 'delay', label: 'Delay', icon: <Clock size={14} /> },
  { type: 'condition', label: 'Condition', icon: <GitBranch size={14} /> },
];

const ACTION_FIELDS: Record<ActionType, { key: string; label: string; placeholder: string }[]> = {
  send_message: [
    { key: 'channel', label: 'Channel', placeholder: '#general' },
    { key: 'message', label: 'Message', placeholder: 'Hello from workflow!' },
  ],
  send_email: [
    { key: 'to', label: 'To', placeholder: 'user@example.com' },
    { key: 'subject', label: 'Subject', placeholder: 'Notification' },
    { key: 'body', label: 'Body', placeholder: 'Email body text...' },
  ],
  create_task: [
    { key: 'title', label: 'Task Title', placeholder: 'New task' },
    { key: 'assignee', label: 'Assignee', placeholder: 'username' },
    { key: 'dueDate', label: 'Due Date', placeholder: '2026-04-01' },
  ],
  send_notification: [
    { key: 'user', label: 'User', placeholder: 'username' },
    { key: 'message', label: 'Message', placeholder: 'You have been notified' },
  ],
  http_request: [
    { key: 'method', label: 'Method', placeholder: 'POST' },
    { key: 'url', label: 'URL', placeholder: 'https://api.example.com/hook' },
    { key: 'body', label: 'Body (JSON)', placeholder: '{"key": "value"}' },
  ],
  delay: [
    { key: 'duration', label: 'Duration (seconds)', placeholder: '60' },
  ],
  condition: [
    { key: 'field', label: 'Field', placeholder: 'status' },
    { key: 'operator', label: 'Operator', placeholder: 'equals' },
    { key: 'value', label: 'Value', placeholder: 'active' },
  ],
};

const TRIGGER_FIELDS: Record<TriggerType, { key: string; label: string; placeholder: string }[]> = {
  message: [
    { key: 'channel', label: 'Channel', placeholder: '#support' },
    { key: 'contains', label: 'Contains', placeholder: 'help' },
  ],
  schedule: [
    { key: 'cron', label: 'Cron Expression', placeholder: '0 9 * * 1-5' },
    { key: 'timezone', label: 'Timezone', placeholder: 'America/New_York' },
  ],
  webhook: [
    { key: 'path', label: 'Path', placeholder: '/hooks/my-workflow' },
  ],
  event: [
    { key: 'eventType', label: 'Event Type', placeholder: 'user.created' },
  ],
};

function triggerDescription(trigger: TriggerConfig): string {
  switch (trigger.type) {
    case 'message':
      return `When message contains "${trigger.config.contains || '...'}" in ${trigger.config.channel || '...'}`;
    case 'schedule':
      return `Runs on schedule: ${trigger.config.cron || '...'}`;
    case 'webhook':
      return `Webhook at ${trigger.config.path || '...'}`;
    case 'event':
      return `On event: ${trigger.config.eventType || '...'}`;
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [subView, setSubView] = useState<'editor' | 'runs'>('editor');
  const [showCreate, setShowCreate] = useState(false);
  const [showActionPicker, setShowActionPicker] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newTriggerType, setNewTriggerType] = useState<TriggerType>('message');
  const [newTriggerConfig, setNewTriggerConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/workflows').then((res) => setWorkflows(Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []));
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      api.get(`/workflows/${selectedWorkflow.id}/runs`).then((res) => setRuns(Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []));
    }
  }, [selectedWorkflow?.id]);

  const createWorkflow = async () => {
    if (!newName.trim()) return;
    const res = await api.post('/workflows', {
      name: newName,
      trigger: { type: newTriggerType, config: newTriggerConfig },
      actions: [],
    });
    const created = res.data?.data || res.data;
    setWorkflows((prev) => [...prev, created]);
    setSelectedWorkflow(created);
    setShowCreate(false);
    setNewName('');
    setNewTriggerConfig({});
  };

  const deleteWorkflow = async (id: string) => {
    await api.delete(`/workflows/${id}`);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    if (selectedWorkflow?.id === id) {
      setSelectedWorkflow(null);
      setRuns([]);
    }
  };

  const toggleWorkflow = async (workflow: Workflow) => {
    const res = await api.post(`/workflows/${workflow.id}/toggle`);
    const toggled = res.data?.data || res.data;
    const updated = { ...workflow, enabled: toggled.enabled };
    setWorkflows((prev) => prev.map((w) => (w.id === workflow.id ? updated : w)));
    if (selectedWorkflow?.id === workflow.id) setSelectedWorkflow(updated);
  };

  const executeWorkflow = async () => {
    if (!selectedWorkflow) return;
    const res = await api.post(`/workflows/${selectedWorkflow.id}/execute`);
    const run = res.data?.data || res.data;
    setRuns((prev) => [run, ...prev]);
    api.get(`/workflows/${selectedWorkflow.id}`).then((r) => {
      const wf = r.data?.data || r.data;
      setSelectedWorkflow(wf);
      setWorkflows((prev) => prev.map((w) => (w.id === wf.id ? wf : w)));
    });
  };

  const addAction = async (afterIndex: number, type: ActionType) => {
    if (!selectedWorkflow) return;
    const newAction: ActionConfig = { id: generateId(), type, config: {} };
    const actions = [...selectedWorkflow.actions];
    actions.splice(afterIndex + 1, 0, newAction);
    const res = await api.patch(`/workflows/${selectedWorkflow.id}`, { actions });
    const updated = res.data?.data || res.data;
    setSelectedWorkflow(updated);
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    setShowActionPicker(null);
  };

  const removeAction = async (actionId: string) => {
    if (!selectedWorkflow) return;
    const actions = selectedWorkflow.actions.filter((a) => a.id !== actionId);
    const res = await api.patch(`/workflows/${selectedWorkflow.id}`, { actions });
    const updated = res.data?.data || res.data;
    setSelectedWorkflow(updated);
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  };

  const updateActionConfig = async (actionId: string, key: string, value: string) => {
    if (!selectedWorkflow) return;
    const actions = selectedWorkflow.actions.map((a) =>
      a.id === actionId ? { ...a, config: { ...a.config, [key]: value } } : a
    );
    const updated = { ...selectedWorkflow, actions };
    setSelectedWorkflow(updated);
    // Debounce is handled at call site if needed; patch immediately for simplicity.
    api.patch(`/workflows/${selectedWorkflow.id}`, { actions });
  };

  const updateTriggerConfig = async (key: string, value: string) => {
    if (!selectedWorkflow) return;
    const trigger = { ...selectedWorkflow.trigger, config: { ...selectedWorkflow.trigger.config, [key]: value } };
    const updated = { ...selectedWorkflow, trigger };
    setSelectedWorkflow(updated);
    api.patch(`/workflows/${selectedWorkflow.id}`, { trigger });
  };

  // --- LIST VIEW (no workflow selected) ---
  if (!selectedWorkflow) {
    return (
      <div className="h-full bg-[#09090B] text-white flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display text-[var(--cx-text-1)]">Workflows</h1>
            <p className="text-sm text-white/40 mt-1">Automate tasks with triggers and actions</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cx-brand hover:bg-[var(--cx-brand-hover)] rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Workflow
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => setSelectedWorkflow(wf)}
                className="bg-cx-bg border border-white/10 rounded-xl p-4 cursor-pointer hover:border-white/20 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate group-hover:text-cx-brand transition-colors">{wf.name}</h3>
                    <p className="text-xs text-white/40 mt-1">{triggerDescription(wf.trigger)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWorkflow(wf); }}
                    className="ml-2 shrink-0"
                  >
                    {wf.enabled ? (
                      <ToggleRight size={24} className="text-cx-brand" />
                    ) : (
                      <ToggleLeft size={24} className="text-white/20" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-white/30">
                  <span className="flex items-center gap-1">
                    <Play size={12} /> {wf.runCount} runs
                  </span>
                  {wf.lastRunAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {new Date(wf.lastRunAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className={`ml-auto px-2 py-0.5 rounded text-xs ${wf.enabled ? 'bg-cx-success/20 text-cx-success' : 'bg-white/5 text-white/30'}`}>
                    {wf.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWorkflow(wf.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cx-danger/20 text-white/20 hover:text-cx-danger transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {workflows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-white/20">
              <Zap size={48} className="mb-4" />
              <p className="text-lg">No workflows yet</p>
              <p className="text-sm mt-1">Create one to start automating</p>
            </div>
          )}
        </div>

        {/* Create Dialog */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-cx-bg border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">New Workflow</h3>
                <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white/50">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cx-brand"
                  placeholder="Workflow name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Trigger Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TRIGGER_TYPES.map(({ type, label, icon }) => (
                      <button
                        key={type}
                        onClick={() => { setNewTriggerType(type); setNewTriggerConfig({}); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          newTriggerType === type ? 'bg-cx-brand/20 text-cx-brand border border-cx-brand/50' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-white/50 block">Trigger Configuration</label>
                  {TRIGGER_FIELDS[newTriggerType].map((field) => (
                    <input
                      key={field.key}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-cx-brand"
                      placeholder={`${field.label}: ${field.placeholder}`}
                      value={newTriggerConfig[field.key] || ''}
                      onChange={(e) => setNewTriggerConfig({ ...newTriggerConfig, [field.key]: e.target.value })}
                    />
                  ))}
                </div>
                <button
                  onClick={createWorkflow}
                  disabled={!newName.trim()}
                  className="w-full py-2 bg-cx-brand hover:bg-[var(--cx-brand-hover)] disabled:bg-white/10 disabled:text-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Create Workflow
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- EDITOR / RUNS VIEW ---
  return (
    <div className="h-full bg-[#09090B] text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSelectedWorkflow(null); setRuns([]); setSubView('editor'); }}
            className="text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="font-semibold">{selectedWorkflow.name}</h2>
            <p className="text-xs text-white/40">{triggerDescription(selectedWorkflow.trigger)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleWorkflow(selectedWorkflow)}
            className="flex items-center gap-2 text-sm"
          >
            {selectedWorkflow.enabled ? (
              <><ToggleRight size={20} className="text-cx-brand" /><span className="text-cx-brand">Enabled</span></>
            ) : (
              <><ToggleLeft size={20} className="text-white/30" /><span className="text-white/30">Disabled</span></>
            )}
          </button>
          <button
            onClick={executeWorkflow}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-cx-success hover:bg-green-600/30 rounded-lg text-sm font-medium transition-colors"
          >
            <Play size={14} /> Run Now
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setSubView('editor')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            subView === 'editor' ? 'text-cx-brand border-b-2 border-cx-brand' : 'text-white/50 hover:text-white/70'
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => setSubView('runs')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            subView === 'runs' ? 'text-cx-brand border-b-2 border-cx-brand' : 'text-white/50 hover:text-white/70'
          }`}
        >
          Run History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {subView === 'editor' ? (
          <div className="max-w-2xl mx-auto space-y-0">
            {/* Trigger Card */}
            <div className="bg-cx-bg border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider mb-3">
                <Zap size={14} className="text-cx-warning" />
                <span>Trigger</span>
              </div>
              <p className="text-sm text-white/70 mb-3">{triggerDescription(selectedWorkflow.trigger)}</p>
              <div className="space-y-2">
                {TRIGGER_FIELDS[selectedWorkflow.trigger.type].map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="text-xs text-white/40 w-24">{field.label}</label>
                    <input
                      className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm outline-none focus:border-cx-brand"
                      value={selectedWorkflow.trigger.config[field.key] || ''}
                      onChange={(e) => updateTriggerConfig(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Connector + Add button after trigger */}
            <div className="flex flex-col items-center relative">
              <div className="w-px h-8 bg-white/10" />
              <button
                onClick={() => setShowActionPicker(showActionPicker === -1 ? null : -1)}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-cx-brand/30 text-white/30 hover:text-cx-brand flex items-center justify-center transition-colors z-10"
              >
                <Plus size={12} />
              </button>
              {showActionPicker === -1 && (
                <div className="absolute top-full mt-1 bg-cx-bg border border-white/10 rounded-xl p-2 shadow-2xl z-20 min-w-[200px]">
                  {ACTION_TYPES.map(({ type, label, icon }) => (
                    <button
                      key={type}
                      onClick={() => addAction(-1, type)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="w-px h-4 bg-white/10" />
            </div>

            {/* Action Cards */}
            {selectedWorkflow.actions.map((action, idx) => (
              <React.Fragment key={action.id}>
                <div className="bg-cx-bg border border-white/10 rounded-xl p-4 group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider">
                      {ACTION_TYPES.find((a) => a.type === action.type)?.icon}
                      <span>{ACTION_TYPES.find((a) => a.type === action.type)?.label}</span>
                    </div>
                    <button
                      onClick={() => removeAction(action.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cx-danger/20 text-white/20 hover:text-cx-danger transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(ACTION_FIELDS[action.type] || []).map((field) => (
                      <div key={field.key} className="flex items-center gap-2">
                        <label className="text-xs text-white/40 w-24">{field.label}</label>
                        <input
                          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm outline-none focus:border-cx-brand"
                          value={action.config[field.key] || ''}
                          onChange={(e) => updateActionConfig(action.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Connector + Add button after each action */}
                <div className="flex flex-col items-center relative">
                  <div className="w-px h-8 bg-white/10" />
                  <button
                    onClick={() => setShowActionPicker(showActionPicker === idx ? null : idx)}
                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-cx-brand/30 text-white/30 hover:text-cx-brand flex items-center justify-center transition-colors z-10"
                  >
                    <Plus size={12} />
                  </button>
                  {showActionPicker === idx && (
                    <div className="absolute top-full mt-1 bg-cx-bg border border-white/10 rounded-xl p-2 shadow-2xl z-20 min-w-[200px]">
                      {ACTION_TYPES.map(({ type, label, icon }) => (
                        <button
                          key={type}
                          onClick={() => addAction(idx, type)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="w-px h-4 bg-white/10" />
                </div>
              </React.Fragment>
            ))}

            {/* End marker */}
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <CheckCircle size={14} className="text-white/20" />
              </div>
            </div>
          </div>
        ) : (
          /* RUNS TABLE */
          <div className="max-w-4xl mx-auto">
            <div className="bg-cx-bg border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-white/40 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs text-white/40 uppercase tracking-wider px-4 py-3">Started</th>
                    <th className="text-left text-xs text-white/40 uppercase tracking-wider px-4 py-3">Duration</th>
                    <th className="text-left text-xs text-white/40 uppercase tracking-wider px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        {run.status === 'success' ? (
                          <span className="flex items-center gap-1.5 text-sm text-cx-success">
                            <CheckCircle size={14} /> Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-cx-danger">
                            <XCircle size={14} /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60">
                        {run.duration < 1000
                          ? `${run.duration}ms`
                          : `${(run.duration / 1000).toFixed(1)}s`}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/40">
                        {run.error || '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {runs.length === 0 && (
                <div className="py-12 text-center text-white/20">
                  <ListOrdered size={32} className="mx-auto mb-2" />
                  <p className="text-sm">No runs yet. Execute the workflow to see results here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
