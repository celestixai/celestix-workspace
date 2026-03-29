import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  LineChart,
  PieChart,
  LayoutGrid,
  Plus,
  ArrowLeft,
  Filter,
  Share2,
  Trash2,
  Settings,
  Database,
  GripVertical,
  X,
  ChevronDown,
  Upload,
  Table,
  Hash,
  ScatterChart,
} from 'lucide-react';

type ChartType = 'bar' | 'line' | 'pie' | 'kpi' | 'table' | 'scatter';

interface DataField {
  id: string;
  name: string;
  type: 'number' | 'string' | 'date';
}

interface Visualization {
  id: string;
  type: ChartType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  xAxis?: string;
  yAxis?: string;
  colorField?: string;
  data: number[];
  labels: string[];
}

interface Report {
  id: string;
  title: string;
  chartCount: number;
  lastUpdated: string;
  dataSource: string;
  visualizations: Visualization[];
  filters: string[];
}

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  { type: 'bar', label: 'Bar Chart', icon: <BarChart3 size={20} /> },
  { type: 'line', label: 'Line Chart', icon: <LineChart size={20} /> },
  { type: 'pie', label: 'Pie Chart', icon: <PieChart size={20} /> },
  { type: 'kpi', label: 'KPI Card', icon: <Hash size={20} /> },
  { type: 'table', label: 'Table', icon: <Table size={20} /> },
  { type: 'scatter', label: 'Scatter', icon: <ScatterChart size={20} /> },
];

const DATA_SOURCES = ['CSV Upload', 'Spreadsheet', 'List', 'Form'];

const SAMPLE_FIELDS: DataField[] = [
  { id: 'f1', name: 'Revenue', type: 'number' },
  { id: 'f2', name: 'Expenses', type: 'number' },
  { id: 'f3', name: 'Date', type: 'date' },
  { id: 'f4', name: 'Category', type: 'string' },
  { id: 'f5', name: 'Region', type: 'string' },
  { id: 'f6', name: 'Units Sold', type: 'number' },
  { id: 'f7', name: 'Profit Margin', type: 'number' },
];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function BarChartSVG({ data, labels, width, height }: { data: number[]; labels: string[]; width: number; height: number }) {
  const maxVal = Math.max(...data, 1);
  const barWidth = Math.max(10, (width - 60) / data.length - 4);
  const chartH = height - 40;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {data.map((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = 40 + i * (barWidth + 4);
        const y = chartH - barH + 10;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} rx={2} className="fill-cx-brand opacity-80 hover:opacity-100 transition-opacity" />
            <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" className="fill-text-secondary text-[9px]">
              {labels[i] || ''}
            </text>
            <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" className="fill-text-secondary text-[9px]">
              {val}
            </text>
          </g>
        );
      })}
      <line x1={38} y1={10} x2={38} y2={chartH + 10} className="stroke-border-primary" strokeWidth={1} />
      <line x1={38} y1={chartH + 10} x2={width} y2={chartH + 10} className="stroke-border-primary" strokeWidth={1} />
    </svg>
  );
}

function LineChartSVG({ data, labels, width, height }: { data: number[]; labels: string[]; width: number; height: number }) {
  const maxVal = Math.max(...data, 1);
  const chartH = height - 40;
  const stepX = (width - 60) / Math.max(data.length - 1, 1);

  const points = data.map((val, i) => {
    const x = 40 + i * stepX;
    const y = chartH - (val / maxVal) * chartH + 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" className="stroke-cx-brand" strokeWidth={2} strokeLinejoin="round" />
      {data.map((val, i) => {
        const x = 40 + i * stepX;
        const y = chartH - (val / maxVal) * chartH + 10;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3} className="fill-cx-brand" />
            <text x={x} y={height - 4} textAnchor="middle" className="fill-text-secondary text-[9px]">
              {labels[i] || ''}
            </text>
          </g>
        );
      })}
      <line x1={38} y1={10} x2={38} y2={chartH + 10} className="stroke-border-primary" strokeWidth={1} />
      <line x1={38} y1={chartH + 10} x2={width} y2={chartH + 10} className="stroke-border-primary" strokeWidth={1} />
    </svg>
  );
}

function PieChartSVG({ data, labels, width, height }: { data: number[]; labels: string[]; width: number; height: number }) {
  const total = data.reduce((s, v) => s + v, 0) || 1;
  const cx = width / 2;
  const cy = (height - 20) / 2;
  const r = Math.min(cx, cy) - 10;
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

  let cumAngle = -Math.PI / 2;
  const slices = data.map((val, i) => {
    const angle = (val / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: colors[i % colors.length], label: labels[i] || '', val };
  });

  return (
    <svg width={width} height={height}>
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} className="opacity-80 hover:opacity-100 transition-opacity" stroke="#111113" strokeWidth={1} />
      ))}
      <g transform={`translate(${width - 80}, 10)`}>
        {slices.map((s, i) => (
          <g key={i} transform={`translate(0, ${i * 16})`}>
            <rect width={10} height={10} rx={2} fill={s.color} />
            <text x={14} y={9} className="fill-text-secondary text-[9px]">{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function KPICard({ data, title }: { data: number[]; title: string }) {
  const value = data[0] || 0;
  const prev = data[1] || 0;
  const change = prev ? (((value - prev) / prev) * 100).toFixed(1) : '0.0';
  const isPositive = value >= prev;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span className="text-[var(--cx-text-2)] text-xs uppercase tracking-wider">{title}</span>
      <span className="text-4xl font-bold text-[var(--cx-text-1)]">{value.toLocaleString()}</span>
      <span className={cn('text-sm font-medium', isPositive ? 'text-cx-success' : 'text-cx-danger')}>
        {isPositive ? '+' : ''}{change}% vs prior
      </span>
    </div>
  );
}

function TableChart({ data, labels }: { data: number[]; labels: string[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/8">
          <th className="text-left py-1 px-2 text-[var(--cx-text-2)] font-medium">Label</th>
          <th className="text-right py-1 px-2 text-[var(--cx-text-2)] font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {labels.map((label, i) => (
          <tr key={i} className="border-b border-white/8/50 hover:bg-cx-bg/50">
            <td className="py-1 px-2 text-[var(--cx-text-1)]">{label}</td>
            <td className="py-1 px-2 text-right text-[var(--cx-text-1)]">{data[i] ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScatterChartSVG({ data, width, height }: { data: number[]; width: number; height: number }) {
  const maxVal = Math.max(...data, 1);
  const chartH = height - 30;
  const chartW = width - 50;

  return (
    <svg width={width} height={height}>
      <line x1={38} y1={10} x2={38} y2={chartH + 10} className="stroke-border-primary" strokeWidth={1} />
      <line x1={38} y1={chartH + 10} x2={width - 10} y2={chartH + 10} className="stroke-border-primary" strokeWidth={1} />
      {data.map((val, i) => {
        const x = 40 + (i / Math.max(data.length - 1, 1)) * chartW;
        const y = chartH - (val / maxVal) * chartH + 10;
        return <circle key={i} cx={x} cy={y} r={4} className="fill-cx-brand opacity-70 hover:opacity-100" />;
      })}
    </svg>
  );
}

function VisualizationRenderer({ viz, width, height }: { viz: Visualization; width: number; height: number }) {
  switch (viz.type) {
    case 'bar':
      return <BarChartSVG data={viz.data} labels={viz.labels} width={width} height={height} />;
    case 'line':
      return <LineChartSVG data={viz.data} labels={viz.labels} width={width} height={height} />;
    case 'pie':
      return <PieChartSVG data={viz.data} labels={viz.labels} width={width} height={height} />;
    case 'kpi':
      return <KPICard data={viz.data} title={viz.title} />;
    case 'table':
      return <TableChart data={viz.data} labels={viz.labels} />;
    case 'scatter':
      return <ScatterChartSVG data={viz.data} width={width} height={height} />;
    default:
      return null;
  }
}

export function AnalyticsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [selectedViz, setSelectedViz] = useState<Visualization | null>(null);
  const [showChartPicker, setShowChartPicker] = useState(false);
  const [dataSourceOpen, setDataSourceOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [dragItem, setDragItem] = useState<string | null>(null);

  useEffect(() => {
    api.get('/analytics/reports').then((res: any) => {
      const arr = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : null;
      if (arr) setReports(arr);
    }).catch(() => {
      setReports([
        {
          id: '1',
          title: 'Q4 Revenue Dashboard',
          chartCount: 4,
          lastUpdated: '2026-03-05',
          dataSource: 'Spreadsheet',
          filters: [],
          visualizations: [
            { id: 'v1', type: 'bar', title: 'Revenue by Region', x: 0, y: 0, width: 1, height: 1, data: [42, 58, 35, 67, 49], labels: ['NA', 'EU', 'APAC', 'LATAM', 'MEA'] },
            { id: 'v2', type: 'line', title: 'Monthly Trend', x: 1, y: 0, width: 1, height: 1, data: [20, 35, 28, 45, 52, 48], labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'] },
            { id: 'v3', type: 'kpi', title: 'Total Revenue', x: 0, y: 1, width: 1, height: 1, data: [251000, 230000], labels: [] },
            { id: 'v4', type: 'pie', title: 'By Category', x: 1, y: 1, width: 1, height: 1, data: [40, 25, 20, 15], labels: ['SaaS', 'Services', 'Hardware', 'Other'] },
          ],
        },
        {
          id: '2',
          title: 'HR Metrics',
          chartCount: 2,
          lastUpdated: '2026-03-01',
          dataSource: 'List',
          filters: [],
          visualizations: [],
        },
      ]);
    });
  }, []);

  const handleCreateReport = () => {
    const newReport: Report = {
      id: generateId(),
      title: 'Untitled Report',
      chartCount: 0,
      lastUpdated: new Date().toISOString().split('T')[0],
      dataSource: 'CSV Upload',
      visualizations: [],
      filters: [],
    };
    setReports((prev) => [...prev, newReport]);
    setActiveReport(newReport);
  };

  const handleAddVisualization = (type: ChartType) => {
    if (!activeReport) return;
    const sampleData = type === 'kpi' ? [12450, 11200] : [30, 50, 20, 45, 60, 35];
    const sampleLabels = type === 'kpi' ? [] : ['A', 'B', 'C', 'D', 'E', 'F'];
    const newViz: Visualization = {
      id: generateId(),
      type,
      title: `${CHART_TYPES.find((c) => c.type === type)?.label || 'Chart'}`,
      x: activeReport.visualizations.length % 2,
      y: Math.floor(activeReport.visualizations.length / 2),
      width: 1,
      height: 1,
      data: sampleData,
      labels: sampleLabels,
    };
    const updated = {
      ...activeReport,
      visualizations: [...activeReport.visualizations, newViz],
      chartCount: activeReport.chartCount + 1,
    };
    setActiveReport(updated);
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedViz(newViz);
    setShowChartPicker(false);
  };

  const handleDeleteViz = (vizId: string) => {
    if (!activeReport) return;
    const updated = {
      ...activeReport,
      visualizations: activeReport.visualizations.filter((v) => v.id !== vizId),
      chartCount: activeReport.chartCount - 1,
    };
    setActiveReport(updated);
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedViz?.id === vizId) setSelectedViz(null);
  };

  const handleUpdateVizTitle = (vizId: string, title: string) => {
    if (!activeReport) return;
    const updated = {
      ...activeReport,
      visualizations: activeReport.visualizations.map((v) => (v.id === vizId ? { ...v, title } : v)),
    };
    setActiveReport(updated);
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedViz?.id === vizId) setSelectedViz({ ...selectedViz, title });
  };

  const handlePublish = () => {
    if (!activeReport) return;
    api.post('/analytics/reports/publish', { reportId: activeReport.id }).catch(() => {});
  };

  // --- Report List View ---
  if (!activeReport) {
    return (
      <div className="h-full flex flex-col bg-cx-bg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-display text-xl text-[var(--cx-text-1)]">Analytics</h1>
            <p className="text-sm text-[var(--cx-text-3)] mt-1">Build interactive reports and dashboards</p>
          </div>
          <button
            onClick={handleCreateReport}
            className="flex items-center gap-2 px-4 py-2 bg-cx-brand text-white rounded-lg hover:bg-cx-brand-hover transition-colors"
          >
            <Plus size={16} />
            New Report
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report)}
                className="bg-cx-surface border border-white/8 rounded-xl p-5 text-left hover:border-cx-brand/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <BarChart3 size={20} className="text-cx-brand" />
                  <span className="text-xs text-[var(--cx-text-2)]">{report.lastUpdated}</span>
                </div>
                <h3 className="text-[var(--cx-text-1)] font-semibold mb-1 group-hover:text-cx-brand transition-colors">
                  {report.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-[var(--cx-text-2)] mt-2">
                  <span className="flex items-center gap-1">
                    <LayoutGrid size={12} />
                    {report.chartCount} charts
                  </span>
                  <span className="flex items-center gap-1">
                    <Database size={12} />
                    {report.dataSource}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Editor View ---
  return (
    <div className="h-full bg-cx-bg flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-cx-surface border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveReport(null); setSelectedViz(null); }} className="text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]">
            <ArrowLeft size={18} />
          </button>
          <input
            value={activeReport.title}
            onChange={(e) => {
              const updated = { ...activeReport, title: e.target.value };
              setActiveReport(updated);
              setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            }}
            className="bg-transparent text-[var(--cx-text-1)] font-semibold text-lg border-none outline-none focus:ring-1 focus:ring-cx-brand/30 rounded px-1"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Data Source Selector */}
          <div className="relative">
            <button
              onClick={() => setDataSourceOpen(!dataSourceOpen)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--cx-text-2)] border border-white/8 rounded-lg hover:bg-cx-bg"
            >
              <Database size={14} />
              {activeReport.dataSource}
              <ChevronDown size={14} />
            </button>
            {dataSourceOpen && (
              <div className="absolute right-0 top-full mt-1 bg-cx-surface border border-white/8 rounded-lg shadow-xl z-20 min-w-[160px]">
                {DATA_SOURCES.map((ds) => (
                  <button
                    key={ds}
                    onClick={() => {
                      const updated = { ...activeReport, dataSource: ds };
                      setActiveReport(updated);
                      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                      setDataSourceOpen(false);
                    }}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-sm hover:bg-cx-bg transition-colors',
                      ds === activeReport.dataSource ? 'text-cx-brand' : 'text-[var(--cx-text-1)]'
                    )}
                  >
                    {ds}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handlePublish} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-cx-brand text-white rounded-lg hover:bg-cx-brand/90">
            <Share2 size={14} />
            Publish
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-cx-surface/50 border-b border-white/8 shrink-0">
        <Filter size={14} className="text-[var(--cx-text-2)]" />
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Add filter..."
          className="bg-transparent text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-2)]/50 outline-none flex-1"
        />
        {activeReport.filters.map((f, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-cx-brand/10 text-cx-brand text-xs rounded-full">
            {f}
            <X size={10} className="cursor-pointer" />
          </span>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Data Fields */}
        <div className="w-56 bg-cx-surface border-r border-white/8 p-3 overflow-y-auto shrink-0">
          <h3 className="text-xs font-semibold text-[var(--cx-text-2)] uppercase tracking-wider mb-3">Data Fields</h3>
          {SAMPLE_FIELDS.map((field) => (
            <div
              key={field.id}
              draggable
              onDragStart={() => setDragItem(field.id)}
              onDragEnd={() => setDragItem(null)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-grab hover:bg-cx-bg transition-colors mb-0.5',
                dragItem === field.id ? 'bg-cx-brand/10 text-cx-brand' : 'text-[var(--cx-text-1)]'
              )}
            >
              <GripVertical size={12} className="text-[var(--cx-text-2)]/50" />
              <span className={cn(
                'w-2 h-2 rounded-full',
                field.type === 'number' ? 'bg-cx-brand' : field.type === 'date' ? 'bg-amber-400' : 'bg-green-400'
              )} />
              {field.name}
            </div>
          ))}
          <div className="mt-4 pt-3 border-t border-white/8">
            <button className="flex items-center gap-1 text-xs text-cx-brand hover:text-cx-brand/80">
              <Upload size={12} />
              Upload CSV
            </button>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-2 gap-4 min-h-full">
            {activeReport.visualizations.map((viz) => (
              <div
                key={viz.id}
                onClick={() => setSelectedViz(viz)}
                className={cn(
                  'bg-cx-surface border rounded-xl p-4 cursor-pointer transition-all relative group',
                  selectedViz?.id === viz.id ? 'border-cx-brand ring-1 ring-cx-brand/20' : 'border-white/8 hover:border-white/8/80'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-[var(--cx-text-1)]">{viz.title}</h4>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteViz(viz.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--cx-text-2)] hover:text-cx-danger transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="w-full h-48 flex items-center justify-center">
                  <VisualizationRenderer viz={viz} width={320} height={180} />
                </div>
              </div>
            ))}

            {/* Add Visualization Button */}
            <div className="relative">
              <button
                onClick={() => setShowChartPicker(!showChartPicker)}
                className="w-full h-64 border-2 border-dashed border-white/8 rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--cx-text-2)] hover:border-cx-brand/50 hover:text-cx-brand transition-colors"
              >
                <Plus size={24} />
                <span className="text-sm">Add Visualization</span>
              </button>

              {showChartPicker && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cx-surface border border-white/8 rounded-xl shadow-2xl p-4 z-20 min-w-[280px]">
                  <h4 className="text-sm font-semibold text-[var(--cx-text-1)] mb-3">Choose Chart Type</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {CHART_TYPES.map((ct) => (
                      <button
                        key={ct.type}
                        onClick={() => handleAddVisualization(ct.type)}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg border border-white/8 hover:border-cx-brand hover:bg-cx-brand/5 transition-colors"
                      >
                        <span className="text-[var(--cx-text-1)]">{ct.icon}</span>
                        <span className="text-xs text-[var(--cx-text-2)]">{ct.label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowChartPicker(false)} className="mt-3 text-xs text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)] w-full text-center">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Config */}
        <div className="w-64 bg-cx-surface border-l border-white/8 p-4 overflow-y-auto shrink-0">
          {selectedViz ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--cx-text-1)]">Configuration</h3>
                <Settings size={14} className="text-[var(--cx-text-2)]" />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--cx-text-2)] mb-1">Title</label>
                  <input
                    value={selectedViz.title}
                    onChange={(e) => handleUpdateVizTitle(selectedViz.id, e.target.value)}
                    className="w-full bg-cx-bg border border-white/8 rounded-lg px-3 py-1.5 text-sm text-[var(--cx-text-1)] outline-none focus:border-cx-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--cx-text-2)] mb-1">Chart Type</label>
                  <div className="grid grid-cols-3 gap-1">
                    {CHART_TYPES.map((ct) => (
                      <button
                        key={ct.type}
                        onClick={() => {
                          if (!activeReport) return;
                          const updatedViz = { ...selectedViz, type: ct.type };
                          const updated = {
                            ...activeReport,
                            visualizations: activeReport.visualizations.map((v) => (v.id === selectedViz.id ? updatedViz : v)),
                          };
                          setActiveReport(updated);
                          setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                          setSelectedViz(updatedViz);
                        }}
                        className={cn(
                          'flex flex-col items-center gap-0.5 p-1.5 rounded text-xs transition-colors',
                          selectedViz.type === ct.type ? 'bg-cx-brand/10 text-cx-brand' : 'text-[var(--cx-text-2)] hover:bg-cx-bg'
                        )}
                      >
                        {ct.icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[var(--cx-text-2)] mb-1">X-Axis Field</label>
                  <select className="w-full bg-cx-bg border border-white/8 rounded-lg px-3 py-1.5 text-sm text-[var(--cx-text-1)] outline-none">
                    <option value="">Select field...</option>
                    {SAMPLE_FIELDS.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[var(--cx-text-2)] mb-1">Y-Axis Field</label>
                  <select className="w-full bg-cx-bg border border-white/8 rounded-lg px-3 py-1.5 text-sm text-[var(--cx-text-1)] outline-none">
                    <option value="">Select field...</option>
                    {SAMPLE_FIELDS.filter((f) => f.type === 'number').map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[var(--cx-text-2)] mb-1">Color</label>
                  <div className="flex gap-1.5">
                    {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'].map((c) => (
                      <button
                        key={c}
                        className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white/30 transition-colors"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--cx-text-2)] text-sm">
              <Settings size={24} className="mb-2 opacity-30" />
              <p>Select a visualization to configure</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
