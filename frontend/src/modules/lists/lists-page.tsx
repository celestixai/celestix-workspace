import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Plus,
  Search,
  Trash2,
  MoreHorizontal,
  LayoutList,
  LayoutGrid,
  GalleryHorizontalEnd,
  ChevronDown,
  Filter,
  ArrowUpDown,
  Group,
  Type,
  Hash,
  ToggleLeft,
  ListChecks,
  Calendar,
  X,
  Check,
  Pencil,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ColumnType = 'text' | 'number' | 'boolean' | 'choice' | 'date';

interface ListColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[]; // for choice type
  width?: number;
}

interface ListItem {
  id: string;
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ListView {
  id: string;
  name: string;
  type: 'list' | 'board' | 'gallery';
}

interface UserList {
  id: string;
  name: string;
  description?: string;
  columns: ListColumn[];
  views: ListView[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

const COLUMN_TYPE_ICONS: Record<ColumnType, typeof Type> = {
  text: Type,
  number: Hash,
  boolean: ToggleLeft,
  choice: ListChecks,
  date: Calendar,
};

const VIEW_ICONS: Record<string, typeof LayoutList> = {
  list: LayoutList,
  board: LayoutGrid,
  gallery: GalleryHorizontalEnd,
};

/* ------------------------------------------------------------------ */
/*  Lists Page                                                         */
/* ------------------------------------------------------------------ */

export function ListsPage() {
  const [lists, setLists] = useState<UserList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<string>('list');

  // Dialogs
  const [showCreateList, setShowCreateList] = useState(false);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('text');
  const [newColOptions, setNewColOptions] = useState('');

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ itemId: string; colId: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Sort
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const selectedList = lists.find((l) => l.id === selectedListId) || null;
  const columns = selectedList?.columns || [];

  /* -- Fetch lists -- */

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/lists');
      setLists(data.data ?? data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  /* -- Fetch items when list selected -- */

  const fetchItems = useCallback(async (listId: string) => {
    try {
      setItemsLoading(true);
      const { data } = await api.get(`/lists/${listId}/items`);
      setItems(data.data ?? data);
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedListId) {
      fetchItems(selectedListId);
      const list = lists.find((l) => l.id === selectedListId);
      if (list?.views?.length) setActiveView(list.views[0].type);
    } else {
      setItems([]);
    }
  }, [selectedListId, lists, fetchItems]);

  /* -- Sorted & filtered items -- */

  const displayItems = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) =>
        Object.values(item.values).some((v) =>
          String(v ?? '').toLowerCase().includes(q)
        )
      );
    }
    if (sortCol) {
      result.sort((a, b) => {
        const av = String(a.values[sortCol] ?? '');
        const bv = String(b.values[sortCol] ?? '');
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [items, searchQuery, sortCol, sortDir]);

  /* -- Mutations -- */

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      const { data } = await api.post('/lists', { name: newListName.trim() });
      const created = data.data ?? data;
      setLists((prev) => [...prev, created]);
      setSelectedListId(created.id);
      setNewListName('');
      setShowCreateList(false);
    } catch {
      /* ignore */
    }
  };

  const handleDeleteList = async () => {
    if (!selectedListId) return;
    try {
      await api.delete(`/lists/${selectedListId}`);
      setLists((prev) => prev.filter((l) => l.id !== selectedListId));
      setSelectedListId(null);
      setShowDeleteList(false);
    } catch {
      /* ignore */
    }
  };

  const handleAddColumn = async () => {
    if (!selectedListId || !newColName.trim()) return;
    try {
      const payload: Record<string, unknown> = { name: newColName.trim(), type: newColType };
      if (newColType === 'choice' && newColOptions.trim()) {
        payload.options = newColOptions.split(',').map((o) => o.trim()).filter(Boolean);
      }
      const { data } = await api.post(`/lists/${selectedListId}/columns`, payload);
      const updated = data.data ?? data;
      setLists((prev) => prev.map((l) => (l.id === selectedListId ? { ...l, columns: updated.columns ?? [...l.columns, updated] } : l)));
      setNewColName('');
      setNewColType('text');
      setNewColOptions('');
      setShowAddColumn(false);
    } catch {
      /* ignore */
    }
  };

  const handleAddItem = async () => {
    if (!selectedListId) return;
    try {
      const values: Record<string, unknown> = {};
      columns.forEach((col) => {
        if (col.type === 'boolean') values[col.id] = false;
        else if (col.type === 'number') values[col.id] = 0;
        else values[col.id] = '';
      });
      const { data } = await api.post(`/lists/${selectedListId}/items`, { values });
      const created = data.data ?? data;
      setItems((prev) => [...prev, created]);
    } catch {
      /* ignore */
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await api.delete(`/lists/items/${itemId}`);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      /* ignore */
    }
  };

  const handleCellSave = async (itemId: string, colId: string, value: unknown) => {
    setEditingCell(null);
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newValues = { ...item.values, [colId]: value };
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, values: newValues } : i)));
    try {
      await api.patch(`/lists/items/${itemId}`, { values: newValues });
    } catch {
      /* revert on error */
      setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
    }
  };

  const handleSort = (colId: string) => {
    if (sortCol === colId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  /* -- Cell renderer -- */

  const renderCell = (item: ListItem, col: ListColumn) => {
    const value = item.values[col.id];
    const isEditing = editingCell?.itemId === item.id && editingCell?.colId === col.id;

    if (col.type === 'boolean') {
      return (
        <button
          onClick={() => handleCellSave(item.id, col.id, !value)}
          className="flex items-center justify-center w-full h-full"
        >
          <div className={`w-4 h-4 rounded border ${value ? 'bg-blue-600 border-blue-600' : 'border-white/20'} flex items-center justify-center`}>
            {!!value && <Check size={10} className="text-white" />}
          </div>
        </button>
      );
    }

    if (isEditing) {
      if (col.type === 'choice' && col.options?.length) {
        return (
          <select
            autoFocus
            value={String(editValue)}
            onChange={(e) => {
              setEditValue(e.target.value);
              handleCellSave(item.id, col.id, e.target.value);
            }}
            onBlur={() => handleCellSave(item.id, col.id, editValue)}
            className="w-full h-full bg-[#1a1a2e] text-white text-sm px-2 py-1 border border-blue-600 rounded outline-none"
          >
            <option value="">-- Select --</option>
            {col.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }

      return (
        <input
          autoFocus
          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            const finalVal = col.type === 'number' ? Number(editValue) || 0 : editValue;
            handleCellSave(item.id, col.id, finalVal);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const finalVal = col.type === 'number' ? Number(editValue) || 0 : editValue;
              handleCellSave(item.id, col.id, finalVal);
            }
            if (e.key === 'Escape') setEditingCell(null);
          }}
          className="w-full h-full bg-[#1a1a2e] text-white text-sm px-2 py-1 border border-blue-600 rounded outline-none"
        />
      );
    }

    return (
      <div
        className="w-full h-full px-2 py-1.5 cursor-text truncate text-sm text-white/80 hover:text-white"
        onClick={() => {
          setEditingCell({ itemId: item.id, colId: col.id });
          setEditValue(String(value ?? ''));
        }}
      >
        {col.type === 'choice' && value ? (
          <span className="inline-block px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 text-xs">
            {String(value)}
          </span>
        ) : (
          String(value ?? '')
        )}
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Lists Sidebar ===== */}
      <aside className="w-[240px] flex-shrink-0 bg-[#12121a] border-r border-white/10 flex flex-col">
        <div className="h-12 flex items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
          <span className="text-sm font-semibold text-white">Lists</span>
          <button
            onClick={() => setShowCreateList(true)}
            className="p-1 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            title="New list"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="space-y-1 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8">
              <LayoutList size={32} className="mx-auto text-white/20 mb-2" />
              <p className="text-sm text-white/50">No lists yet</p>
              <button
                onClick={() => setShowCreateList(true)}
                className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create your first list
              </button>
            </div>
          ) : (
            <div className="space-y-0.5">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    selectedListId === list.id
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <LayoutList size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1">{list.name}</span>
                  <span className="text-[10px] text-white/30">{list.itemCount ?? 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ===== Main Area ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0f]">
        {selectedList ? (
          <>
            {/* Toolbar */}
            <div className="h-12 flex items-center gap-3 px-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white truncate">{selectedList.name}</h2>

              <div className="flex-1" />

              {/* View tabs */}
              <div className="flex items-center bg-[#12121a] rounded-lg p-0.5">
                {(['list', 'board', 'gallery'] as const).map((view) => {
                  const Icon = VIEW_ICONS[view];
                  return (
                    <button
                      key={view}
                      onClick={() => setActiveView(view)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                        activeView === view
                          ? 'bg-white/10 text-white'
                          : 'text-white/50 hover:text-white/70'
                      }`}
                    >
                      <Icon size={12} />
                      {view.charAt(0).toUpperCase() + view.slice(1)}
                    </button>
                  );
                })}
              </div>

              <div className="w-px h-5 bg-white/10" />

              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-7 pr-3 rounded-lg bg-[#12121a] border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-600 w-40"
                />
              </div>

              {/* Filter & Sort buttons */}
              <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors">
                <Filter size={12} />
                Filter
              </button>
              <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors">
                <ArrowUpDown size={12} />
                Sort
              </button>
              <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors">
                <Group size={12} />
                Group
              </button>

              <div className="w-px h-5 bg-white/10" />

              <button
                onClick={() => setShowDeleteList(true)}
                className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                title="Delete list"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {itemsLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 rounded bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : (
                <table className="w-full border-collapse min-w-max">
                  {/* Header */}
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="w-10 px-2 py-2 text-left text-[11px] font-medium text-white/30 uppercase tracking-wider">
                        #
                      </th>
                      {columns.map((col) => {
                        const TypeIcon = COLUMN_TYPE_ICONS[col.type] || Type;
                        return (
                          <th
                            key={col.id}
                            onClick={() => handleSort(col.id)}
                            className="px-2 py-2 text-left text-[11px] font-medium text-white/50 uppercase tracking-wider cursor-pointer hover:text-white/70 transition-colors select-none"
                            style={{ minWidth: col.width || 150 }}
                          >
                            <div className="flex items-center gap-1.5">
                              <TypeIcon size={11} />
                              <span>{col.name}</span>
                              {sortCol === col.id && (
                                <ArrowUpDown size={10} className="text-blue-400" />
                              )}
                            </div>
                          </th>
                        );
                      })}
                      <th className="w-10 px-2 py-2">
                        <button
                          onClick={() => setShowAddColumn(true)}
                          className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white/50 transition-colors"
                          title="Add column"
                        >
                          <Plus size={12} />
                        </button>
                      </th>
                    </tr>
                  </thead>

                  {/* Body */}
                  <tbody>
                    {displayItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] group"
                      >
                        <td className="px-2 py-1 text-xs text-white/20">
                          <div className="flex items-center gap-1">
                            <span>{idx + 1}</span>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/5 text-white/20 hover:text-red-400 transition-all"
                              title="Delete item"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                        {columns.map((col) => (
                          <td key={col.id} className="px-0 py-0 border-r border-white/5">
                            {renderCell(item, col)}
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Add item row */}
              {!itemsLoading && (
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-white/30 hover:text-white/60 hover:bg-white/[0.02] transition-colors border-b border-white/5"
                >
                  <Plus size={14} />
                  Add item
                </button>
              )}

              {/* Empty state */}
              {!itemsLoading && items.length === 0 && columns.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <LayoutList size={40} className="text-white/10 mb-3" />
                  <p className="text-sm text-white/50 mb-1">This list is empty</p>
                  <p className="text-xs text-white/30 mb-4">Add columns to define your data structure</p>
                  <button
                    onClick={() => setShowAddColumn(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors"
                  >
                    <Plus size={14} />
                    Add Column
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <LayoutList size={48} className="text-white/10 mb-3" />
            <p className="text-base text-white/50 mb-1">Select a list</p>
            <p className="text-sm text-white/30">Choose a list from the sidebar or create a new one</p>
          </div>
        )}
      </main>

      {/* ===== Create List Dialog ===== */}
      {showCreateList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreateList(false)}>
          <div className="bg-[#12121a] border border-white/10 rounded-xl w-[400px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Create List</h3>
              <button onClick={() => setShowCreateList(false)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Name</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="My List"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                  className="w-full h-9 px-3 rounded-lg bg-[#1a1a2e] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreateList(false)}
                  className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                  className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete List Dialog ===== */}
      {showDeleteList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowDeleteList(false)}>
          <div className="bg-[#12121a] border border-white/10 rounded-xl w-[380px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-2">Delete List</h3>
            <p className="text-sm text-white/50 mb-5">
              Are you sure you want to delete <span className="text-white font-medium">{selectedList?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteList(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteList}
                className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Add Column Dialog ===== */}
      {showAddColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddColumn(false)}>
          <div className="bg-[#12121a] border border-white/10 rounded-xl w-[420px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Add Column</h3>
              <button onClick={() => setShowAddColumn(false)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Column Name</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Column name"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[#1a1a2e] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Type</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['text', 'number', 'boolean', 'choice', 'date'] as ColumnType[]).map((type) => {
                    const Icon = COLUMN_TYPE_ICONS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setNewColType(type)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                          newColType === type
                            ? 'border-blue-600 bg-blue-600/10 text-blue-400'
                            : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
                        }`}
                      >
                        <Icon size={14} />
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
              {newColType === 'choice' && (
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Options (comma separated)</label>
                  <input
                    type="text"
                    placeholder="Option 1, Option 2, Option 3"
                    value={newColOptions}
                    onChange={(e) => setNewColOptions(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[#1a1a2e] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddColumn(false)}
                  className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddColumn}
                  disabled={!newColName.trim()}
                  className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add Column
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
