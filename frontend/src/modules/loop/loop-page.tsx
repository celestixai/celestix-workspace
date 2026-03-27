import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, FileText, Table, CheckSquare, BarChart3,
  Activity, Type, Code, ChevronRight, MoreHorizontal, X,
} from 'lucide-react';
import { api } from '@/lib/api';

type ComponentType = 'TABLE' | 'TASK_LIST' | 'VOTING_TABLE' | 'STATUS_TRACKER' | 'PARAGRAPH' | 'CODE_SNIPPET';

interface LoopComponent {
  id: string;
  pageId: string;
  type: ComponentType;
  content: any;
  order: number;
}

interface LoopPageData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const COMPONENT_TYPES: { type: ComponentType; label: string; icon: React.ReactNode }[] = [
  { type: 'TABLE', label: 'Table', icon: <Table size={16} /> },
  { type: 'TASK_LIST', label: 'Task List', icon: <CheckSquare size={16} /> },
  { type: 'VOTING_TABLE', label: 'Voting Table', icon: <BarChart3 size={16} /> },
  { type: 'STATUS_TRACKER', label: 'Status Tracker', icon: <Activity size={16} /> },
  { type: 'PARAGRAPH', label: 'Paragraph', icon: <Type size={16} /> },
  { type: 'CODE_SNIPPET', label: 'Code Snippet', icon: <Code size={16} /> },
];

function defaultContent(type: ComponentType): any {
  switch (type) {
    case 'TABLE':
      return { columns: ['Column 1', 'Column 2', 'Column 3'], rows: [['', '', ''], ['', '', '']] };
    case 'TASK_LIST':
      return { tasks: [{ text: 'New task', done: false, assignee: '', dueDate: '' }] };
    case 'VOTING_TABLE':
      return { options: [{ label: 'Option A', votes: 0 }, { label: 'Option B', votes: 0 }] };
    case 'STATUS_TRACKER':
      return { items: [{ label: 'Item 1', status: 'Not Started' }] };
    case 'PARAGRAPH':
      return { text: 'Start typing here...' };
    case 'CODE_SNIPPET':
      return { language: 'javascript', code: '// Your code here' };
  }
}

function TableComponent({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const { columns, rows } = content;
  const updateCell = (ri: number, ci: number, val: string) => {
    const newRows = rows.map((r: string[], i: number) =>
      i === ri ? r.map((c: string, j: number) => (j === ci ? val : c)) : [...r]
    );
    onChange({ ...content, rows: newRows });
  };
  const updateColumn = (ci: number, val: string) => {
    const newCols = columns.map((c: string, i: number) => (i === ci ? val : c));
    onChange({ ...content, columns: newCols });
  };
  const addRow = () => onChange({ ...content, rows: [...rows, columns.map(() => '')] });
  const addColumn = () => onChange({
    columns: [...columns, `Column ${columns.length + 1}`],
    rows: rows.map((r: string[]) => [...r, '']),
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col: string, ci: number) => (
              <th key={ci} className="border border-white/10 px-3 py-2 text-left text-sm font-medium text-white/70">
                <input
                  className="bg-transparent w-full outline-none text-white/70"
                  value={col}
                  onChange={(e) => updateColumn(ci, e.target.value)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: string[], ri: number) => (
            <tr key={ri}>
              {row.map((cell: string, ci: number) => (
                <td key={ci} className="border border-white/10 px-3 py-2">
                  <input
                    className="bg-transparent w-full outline-none text-white text-sm"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-2">
        <button onClick={addRow} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          <Plus size={12} /> Add Row
        </button>
        <button onClick={addColumn} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          <Plus size={12} /> Add Column
        </button>
      </div>
    </div>
  );
}

function TaskListComponent({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const { tasks } = content;
  const update = (idx: number, field: string, val: any) => {
    const newTasks = tasks.map((t: any, i: number) => (i === idx ? { ...t, [field]: val } : t));
    onChange({ tasks: newTasks });
  };
  const addTask = () => onChange({ tasks: [...tasks, { text: '', done: false, assignee: '', dueDate: '' }] });
  const removeTask = (idx: number) => onChange({ tasks: tasks.filter((_: any, i: number) => i !== idx) });

  return (
    <div className="space-y-2">
      {tasks.map((task: any, idx: number) => (
        <div key={idx} className="flex items-center gap-3 group">
          <input
            type="checkbox"
            checked={task.done}
            onChange={(e) => update(idx, 'done', e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-600"
          />
          <input
            className={`bg-transparent flex-1 outline-none text-sm ${task.done ? 'line-through text-white/40' : 'text-white'}`}
            value={task.text}
            onChange={(e) => update(idx, 'text', e.target.value)}
            placeholder="Task description"
          />
          <input
            className="bg-transparent w-24 outline-none text-xs text-white/50 border-b border-white/10"
            value={task.assignee}
            onChange={(e) => update(idx, 'assignee', e.target.value)}
            placeholder="Assignee"
          />
          <input
            type="date"
            className="bg-transparent text-xs text-white/50 outline-none"
            value={task.dueDate}
            onChange={(e) => update(idx, 'dueDate', e.target.value)}
          />
          <button onClick={() => removeTask(idx)} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400">
            <X size={14} />
          </button>
        </div>
      ))}
      <button onClick={addTask} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <Plus size={12} /> Add Task
      </button>
    </div>
  );
}

function VotingTableComponent({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const { options } = content;
  const vote = (idx: number) => {
    const newOpts = options.map((o: any, i: number) => (i === idx ? { ...o, votes: o.votes + 1 } : o));
    onChange({ options: newOpts });
  };
  const updateLabel = (idx: number, val: string) => {
    const newOpts = options.map((o: any, i: number) => (i === idx ? { ...o, label: val } : o));
    onChange({ options: newOpts });
  };
  const addOption = () => onChange({ options: [...options, { label: '', votes: 0 }] });
  const total = options.reduce((s: number, o: any) => s + o.votes, 0);

  return (
    <div className="space-y-3">
      {options.map((opt: any, idx: number) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center justify-between">
            <input
              className="bg-transparent outline-none text-sm text-white flex-1"
              value={opt.label}
              onChange={(e) => updateLabel(idx, e.target.value)}
              placeholder="Option label"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">{opt.votes} votes</span>
              <button
                onClick={() => vote(idx)}
                className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30"
              >
                Vote
              </button>
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: total > 0 ? `${(opt.votes / total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      ))}
      <button onClick={addOption} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <Plus size={12} /> Add Option
      </button>
    </div>
  );
}

function StatusTrackerComponent({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const statuses = ['Not Started', 'In Progress', 'Done'];
  const statusColor: Record<string, string> = {
    'Not Started': 'bg-white/10 text-white/50',
    'In Progress': 'bg-yellow-500/20 text-yellow-400',
    'Done': 'bg-green-500/20 text-green-400',
  };
  const { items } = content;
  const update = (idx: number, field: string, val: string) => {
    const newItems = items.map((it: any, i: number) => (i === idx ? { ...it, [field]: val } : it));
    onChange({ items: newItems });
  };
  const addItem = () => onChange({ items: [...items, { label: '', status: 'Not Started' }] });

  return (
    <div className="space-y-2">
      {items.map((item: any, idx: number) => (
        <div key={idx} className="flex items-center gap-3">
          <input
            className="bg-transparent flex-1 outline-none text-sm text-white"
            value={item.label}
            onChange={(e) => update(idx, 'label', e.target.value)}
            placeholder="Item name"
          />
          <select
            value={item.status}
            onChange={(e) => update(idx, 'status', e.target.value)}
            className={`text-xs px-2 py-1 rounded border-0 outline-none cursor-pointer ${statusColor[item.status]}`}
          >
            {statuses.map((s) => (
              <option key={s} value={s} className="bg-[#1a1a2e] text-white">{s}</option>
            ))}
          </select>
        </div>
      ))}
      <button onClick={addItem} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <Plus size={12} /> Add Item
      </button>
    </div>
  );
}

function ParagraphComponent({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div
      className="min-h-[60px] text-sm text-white/90 outline-none leading-relaxed"
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange({ text: e.currentTarget.textContent || '' })}
      dangerouslySetInnerHTML={{ __html: content.text }}
    />
  );
}

function CodeSnippetComponent({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <input
          className="bg-transparent text-xs text-white/40 outline-none uppercase tracking-wider"
          value={content.language}
          onChange={(e) => onChange({ ...content, language: e.target.value })}
          placeholder="Language"
        />
      </div>
      <textarea
        className="w-full bg-[#0a0a0f] border border-white/10 rounded p-3 text-sm text-green-400 font-mono outline-none resize-y min-h-[80px]"
        value={content.code}
        onChange={(e) => onChange({ ...content, code: e.target.value })}
      />
    </div>
  );
}

function ComponentRenderer({ component, onChange }: { component: LoopComponent; onChange: (c: any) => void }) {
  switch (component.type) {
    case 'TABLE': return <TableComponent content={component.content} onChange={onChange} />;
    case 'TASK_LIST': return <TaskListComponent content={component.content} onChange={onChange} />;
    case 'VOTING_TABLE': return <VotingTableComponent content={component.content} onChange={onChange} />;
    case 'STATUS_TRACKER': return <StatusTrackerComponent content={component.content} onChange={onChange} />;
    case 'PARAGRAPH': return <ParagraphComponent content={component.content} onChange={onChange} />;
    case 'CODE_SNIPPET': return <CodeSnippetComponent content={component.content} onChange={onChange} />;
  }
}

const componentIcon = (type: ComponentType) => {
  const map: Record<ComponentType, React.ReactNode> = {
    TABLE: <Table size={14} />,
    TASK_LIST: <CheckSquare size={14} />,
    VOTING_TABLE: <BarChart3 size={14} />,
    STATUS_TRACKER: <Activity size={14} />,
    PARAGRAPH: <Type size={14} />,
    CODE_SNIPPET: <Code size={14} />,
  };
  return map[type];
};

export function LoopPage() {
  const [pages, setPages] = useState<LoopPageData[]>([]);
  const [selectedPage, setSelectedPage] = useState<LoopPageData | null>(null);
  const [components, setComponents] = useState<LoopComponent[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get('/loop/pages').then((res) => setPages(Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : []));
  }, []);

  useEffect(() => {
    if (selectedPage) {
      api.get(`/loop/pages/${selectedPage.id}`).then((res) => {
        const pageData = res.data?.data || res.data;
        setComponents(pageData?.components || []);
      });
    }
  }, [selectedPage?.id]);

  const debouncedSave = useCallback((comp: LoopComponent) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.patch(`/loop/components/${comp.id}`, { content: comp.content });
    }, 800);
  }, []);

  const createPage = async () => {
    if (!newPageTitle.trim()) return;
    const res = await api.post('/loop/pages', { title: newPageTitle });
    const newPage = res.data?.data || res.data;
    setPages((prev) => [...prev, newPage]);
    setSelectedPage(newPage);
    setNewPageTitle('');
    setCreatingPage(false);
  };

  const deletePage = async (id: string) => {
    await api.delete(`/loop/pages/${id}`);
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (selectedPage?.id === id) {
      setSelectedPage(null);
      setComponents([]);
    }
  };

  const addComponent = async (type: ComponentType) => {
    if (!selectedPage) return;
    const res = await api.post('/loop/components', {
      pageId: selectedPage.id,
      type,
      content: defaultContent(type),
      order: components.length,
    });
    setComponents((prev) => [...prev, res.data?.data || res.data]);
    setShowToolbar(false);
  };

  const deleteComponent = async (id: string) => {
    await api.delete(`/loop/components/${id}`);
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const updateComponentContent = (id: string, content: any) => {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, content };
          debouncedSave(updated);
          return updated;
        }
        return c;
      })
    );
  };

  const updatePageTitle = async (title: string) => {
    if (!selectedPage) return;
    await api.patch(`/loop/pages/${selectedPage.id}`, { title });
    setSelectedPage({ ...selectedPage, title });
    setPages((prev) => prev.map((p) => (p.id === selectedPage.id ? { ...p, title } : p)));
  };

  return (
    <div className="flex h-full bg-[#0a0a0f] text-white">
      {/* Sidebar */}
      <div className="w-64 bg-[#12121a] border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Loop Pages</h2>
            <button
              onClick={() => setCreatingPage(true)}
              className="p-1 rounded hover:bg-white/5 text-white/50 hover:text-white"
            >
              <Plus size={16} />
            </button>
          </div>
          {creatingPage && (
            <div className="flex gap-2">
              <input
                autoFocus
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm outline-none focus:border-blue-600"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createPage()}
                placeholder="Page title"
              />
              <button onClick={createPage} className="text-blue-400 text-sm hover:text-blue-300">Add</button>
              <button onClick={() => setCreatingPage(false)} className="text-white/30 hover:text-white/50">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {pages.map((page) => (
            <div
              key={page.id}
              onClick={() => setSelectedPage(page)}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                selectedPage?.id === page.id ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-white/70'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="shrink-0" />
                <span className="text-sm truncate">{page.title}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {pages.length === 0 && (
            <p className="text-center text-white/30 text-sm mt-8">No pages yet. Create one to get started.</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPage ? (
          <>
            {/* Page Header */}
            <div className="p-6 border-b border-white/10">
              <input
                className="text-2xl font-bold bg-transparent outline-none w-full text-white"
                value={selectedPage.title}
                onChange={(e) => updatePageTitle(e.target.value)}
              />
              <p className="text-xs text-white/30 mt-1">
                Last updated {new Date(selectedPage.updatedAt).toLocaleDateString()}
              </p>
            </div>

            {/* Components */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {components
                .sort((a, b) => a.order - b.order)
                .map((comp) => (
                  <div
                    key={comp.id}
                    className="group bg-[#1a1a2e] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider">
                        {componentIcon(comp.type)}
                        <span>{comp.type.replace('_', ' ')}</span>
                      </div>
                      <button
                        onClick={() => deleteComponent(comp.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ComponentRenderer
                      component={comp}
                      onChange={(content) => updateComponentContent(comp.id, content)}
                    />
                  </div>
                ))}

              {/* Add Component Button */}
              <div className="relative">
                <button
                  onClick={() => setShowToolbar(!showToolbar)}
                  className="w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-white/30 hover:text-white/50 hover:border-white/20 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={16} />
                  <span className="text-sm">Add Component</span>
                </button>
                {showToolbar && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#12121a] border border-white/10 rounded-xl p-2 shadow-2xl z-10 min-w-[200px]">
                    {COMPONENT_TYPES.map(({ type, label, icon }) => (
                      <button
                        key={type}
                        onClick={() => addComponent(type)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        {icon}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={48} className="mx-auto text-white/10 mb-4" />
              <h3 className="text-lg font-medium text-white/30">Select a page or create a new one</h3>
              <p className="text-sm text-white/20 mt-1">Loop pages contain collaborative components</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
