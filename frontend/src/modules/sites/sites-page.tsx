import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Plus,
  ArrowLeft,
  Globe,
  FileText,
  Image,
  Type,
  Link2,
  Users,
  Newspaper,
  Code,
  Layout,
  Columns2,
  Columns3,
  Settings,
  ChevronDown,
  ChevronRight,
  Trash2,
  Eye,
  Edit3,
  X,
  GripVertical,
  ExternalLink,
  Star,
  Megaphone,
  PanelTop,
} from 'lucide-react';

type SiteType = 'Team' | 'Communication';

type WebPartType = 'hero' | 'news' | 'text' | 'quicklinks' | 'people' | 'image' | 'embed';

type SectionLayout = 'full' | '2-col' | '3-col';

interface NavLink {
  id: string;
  label: string;
  url: string;
}

interface WebPart {
  id: string;
  type: WebPartType;
  title?: string;
  content?: string;
  imageUrl?: string;
  links?: { label: string; url: string; icon: string }[];
  people?: { name: string; role: string; avatar: string }[];
  embedUrl?: string;
}

interface Section {
  id: string;
  layout: SectionLayout;
  webParts: WebPart[];
}

interface Page {
  id: string;
  title: string;
  sections: Section[];
}

interface NewsPost {
  id: string;
  title: string;
  coverImage: string;
  body: string;
  published: boolean;
  createdAt: string;
}

interface Site {
  id: string;
  name: string;
  type: SiteType;
  description: string;
  themeColor: string;
  pages: Page[];
  news: NewsPost[];
  navLinks: NavLink[];
}

const WEB_PART_TYPES: { type: WebPartType; label: string; icon: React.ReactNode }[] = [
  { type: 'hero', label: 'Hero', icon: <PanelTop size={18} /> },
  { type: 'news', label: 'News Feed', icon: <Newspaper size={18} /> },
  { type: 'text', label: 'Text Block', icon: <Type size={18} /> },
  { type: 'quicklinks', label: 'Quick Links', icon: <Link2 size={18} /> },
  { type: 'people', label: 'People', icon: <Users size={18} /> },
  { type: 'image', label: 'Image', icon: <Image size={18} /> },
  { type: 'embed', label: 'Embed', icon: <Code size={18} /> },
];

const THEME_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#60A5FA', '#F97316'];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function createDefaultWebPart(type: WebPartType): WebPart {
  const base: WebPart = { id: generateId(), type };
  switch (type) {
    case 'hero':
      return { ...base, title: 'Welcome to Our Site', content: 'Your one-stop portal for everything.', imageUrl: '' };
    case 'news':
      return { ...base, title: 'Latest News' };
    case 'text':
      return { ...base, content: 'Enter your rich text content here. You can describe processes, share updates, or document guidelines.' };
    case 'quicklinks':
      return {
        ...base,
        title: 'Quick Links',
        links: [
          { label: 'HR Portal', url: '#', icon: 'users' },
          { label: 'IT Support', url: '#', icon: 'headset' },
          { label: 'Benefits', url: '#', icon: 'heart' },
          { label: 'Calendar', url: '#', icon: 'calendar' },
        ],
      };
    case 'people':
      return {
        ...base,
        title: 'Team Members',
        people: [
          { name: 'Alex Chen', role: 'Team Lead', avatar: '' },
          { name: 'Maria Santos', role: 'Designer', avatar: '' },
          { name: 'James Park', role: 'Developer', avatar: '' },
        ],
      };
    case 'image':
      return { ...base, imageUrl: '' };
    case 'embed':
      return { ...base, embedUrl: '' };
    default:
      return base;
  }
}

function WebPartRenderer({ webPart, site, themeColor }: { webPart: WebPart; site: Site; themeColor: string }) {
  switch (webPart.type) {
    case 'hero':
      return (
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-cx-brand/20 to-purple-600/20 p-8 min-h-[200px] flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-[var(--cx-text-1)] mb-2">{webPart.title}</h2>
          <p className="text-[var(--cx-text-2)]">{webPart.content}</p>
        </div>
      );
    case 'news':
      return (
        <div>
          <h3 className="text-lg font-semibold text-[var(--cx-text-1)] mb-3">{webPart.title}</h3>
          <div className="space-y-2">
            {site.news.filter((n) => n.published).slice(0, 3).map((post) => (
              <div key={post.id} className="flex gap-3 p-3 bg-cx-bg rounded-lg border border-white/8/50">
                <div className="w-16 h-16 rounded bg-cx-surface shrink-0 flex items-center justify-center">
                  <Newspaper size={16} className="text-[var(--cx-text-2)]/30" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[var(--cx-text-1)]">{post.title}</h4>
                  <p className="text-xs text-[var(--cx-text-2)] mt-0.5 line-clamp-2">{post.body}</p>
                  <span className="text-[10px] text-[var(--cx-text-2)]">{post.createdAt}</span>
                </div>
              </div>
            ))}
            {site.news.filter((n) => n.published).length === 0 && (
              <p className="text-sm text-[var(--cx-text-2)] py-4 text-center">No published news yet</p>
            )}
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="prose prose-invert max-w-none">
          <p className="text-[var(--cx-text-1)] text-sm leading-relaxed whitespace-pre-wrap">{webPart.content}</p>
        </div>
      );
    case 'quicklinks':
      return (
        <div>
          <h3 className="text-lg font-semibold text-[var(--cx-text-1)] mb-3">{webPart.title}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {webPart.links?.map((link, i) => (
              <a key={i} href={link.url} className="flex flex-col items-center gap-2 p-3 bg-cx-bg rounded-lg border border-white/8/50 hover:border-cx-brand/50 transition-colors">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: themeColor + '20' }}>
                  <Link2 size={16} style={{ color: themeColor }} />
                </div>
                <span className="text-xs text-[var(--cx-text-1)] text-center">{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      );
    case 'people':
      return (
        <div>
          <h3 className="text-lg font-semibold text-[var(--cx-text-1)] mb-3">{webPart.title}</h3>
          <div className="grid grid-cols-3 gap-3">
            {webPart.people?.map((person, i) => (
              <div key={i} className="flex flex-col items-center p-3 bg-cx-bg rounded-lg border border-white/8/50">
                <div className="w-12 h-12 rounded-full bg-cx-surface flex items-center justify-center mb-2">
                  <span className="text-[var(--cx-text-2)] text-sm font-medium">{person.name.charAt(0)}</span>
                </div>
                <span className="text-sm text-[var(--cx-text-1)] font-medium text-center">{person.name}</span>
                <span className="text-xs text-[var(--cx-text-2)]">{person.role}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'image':
      return (
        <div className="aspect-video bg-cx-bg rounded-lg border border-white/8/50 flex items-center justify-center">
          {webPart.imageUrl ? (
            <img src={webPart.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Image size={32} className="text-[var(--cx-text-2)]/20" />
          )}
        </div>
      );
    case 'embed':
      return (
        <div className="aspect-video bg-cx-bg rounded-lg border border-white/8/50 flex items-center justify-center">
          {webPart.embedUrl ? (
            <iframe src={webPart.embedUrl} className="w-full h-full rounded-lg" title="Embed" />
          ) : (
            <div className="text-center">
              <Code size={24} className="text-[var(--cx-text-2)]/30 mx-auto mb-1" />
              <span className="text-xs text-[var(--cx-text-2)]">Paste embed URL</span>
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

export function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pages' | 'news' | 'settings'>('pages');
  const [showWebPartPicker, setShowWebPartPicker] = useState<{ sectionId: string } | null>(null);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  useEffect(() => {
    api.get('/sites').then((res: any) => {
      const arr = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : null;
      if (arr) setSites(arr);
    }).catch(() => {
      setSites([
        {
          id: '1',
          name: 'Engineering Hub',
          type: 'Team',
          description: 'Central hub for the engineering team',
          themeColor: '#3B82F6',
          navLinks: [
            { id: 'n1', label: 'Home', url: '#' },
            { id: 'n2', label: 'Docs', url: '#' },
            { id: 'n3', label: 'Wiki', url: '#' },
          ],
          pages: [
            {
              id: 'p1',
              title: 'Home',
              sections: [
                { id: 's1', layout: 'full', webParts: [createDefaultWebPart('hero')] },
                { id: 's2', layout: '2-col', webParts: [createDefaultWebPart('news'), createDefaultWebPart('quicklinks')] },
                { id: 's3', layout: 'full', webParts: [createDefaultWebPart('people')] },
              ],
            },
            { id: 'p2', title: 'Documentation', sections: [{ id: 's4', layout: 'full', webParts: [createDefaultWebPart('text')] }] },
          ],
          news: [
            { id: 'nw1', title: 'Sprint 42 Recap', coverImage: '', body: 'Great progress this sprint! We shipped 12 features and fixed 8 bugs. Highlights include the new dashboard and improved search.', published: true, createdAt: '2026-03-05' },
            { id: 'nw2', title: 'New Team Members', coverImage: '', body: 'Please welcome Sarah and Mike to the engineering team!', published: true, createdAt: '2026-03-01' },
          ],
        },
        {
          id: '2',
          name: 'Company News',
          type: 'Communication',
          description: 'Official company announcements',
          themeColor: '#10B981',
          navLinks: [],
          pages: [{ id: 'p3', title: 'Home', sections: [] }],
          news: [],
        },
      ]);
    });
  }, []);

  const updateSite = (updater: (s: Site) => Site) => {
    setActiveSite((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      setSites((ss) => ss.map((s) => (s.id === updated.id ? updated : s)));
      return updated;
    });
  };

  const activePage = activeSite?.pages.find((p) => p.id === activePageId) || activeSite?.pages[0];

  const handleCreateSite = () => {
    const newSite: Site = {
      id: generateId(),
      name: 'New Site',
      type: 'Team',
      description: '',
      themeColor: '#3B82F6',
      navLinks: [],
      pages: [{ id: generateId(), title: 'Home', sections: [] }],
      news: [],
    };
    setSites((prev) => [...prev, newSite]);
    setActiveSite(newSite);
    setActivePageId(newSite.pages[0].id);
  };

  const handleAddPage = () => {
    if (!activeSite) return;
    const newPage: Page = { id: generateId(), title: 'New Page', sections: [] };
    updateSite((s) => ({ ...s, pages: [...s.pages, newPage] }));
    setActivePageId(newPage.id);
  };

  const handleDeletePage = (pageId: string) => {
    if (!activeSite) return;
    updateSite((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== pageId) }));
    if (activePageId === pageId) {
      setActivePageId(activeSite.pages[0]?.id || null);
    }
  };

  const handleAddSection = (layout: SectionLayout) => {
    if (!activeSite || !activePage) return;
    const newSection: Section = { id: generateId(), layout, webParts: [] };
    updateSite((s) => ({
      ...s,
      pages: s.pages.map((p) => (p.id === activePage.id ? { ...p, sections: [...p.sections, newSection] } : p)),
    }));
    setShowSectionPicker(false);
  };

  const handleAddWebPart = (sectionId: string, type: WebPartType) => {
    if (!activeSite || !activePage) return;
    const wp = createDefaultWebPart(type);
    updateSite((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === activePage.id
          ? { ...p, sections: p.sections.map((sec) => (sec.id === sectionId ? { ...sec, webParts: [...sec.webParts, wp] } : sec)) }
          : p
      ),
    }));
    setShowWebPartPicker(null);
  };

  const handleDeleteWebPart = (sectionId: string, webPartId: string) => {
    if (!activeSite || !activePage) return;
    updateSite((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === activePage.id
          ? {
              ...p,
              sections: p.sections.map((sec) =>
                sec.id === sectionId ? { ...sec, webParts: sec.webParts.filter((wp) => wp.id !== webPartId) } : sec
              ),
            }
          : p
      ),
    }));
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!activeSite || !activePage) return;
    updateSite((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === activePage.id ? { ...p, sections: p.sections.filter((sec) => sec.id !== sectionId) } : p
      ),
    }));
  };

  const handleCreateNews = () => {
    if (!activeSite) return;
    const post: NewsPost = {
      id: generateId(),
      title: 'Untitled Post',
      coverImage: '',
      body: '',
      published: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    updateSite((s) => ({ ...s, news: [...s.news, post] }));
    setEditingNewsId(post.id);
  };

  const handleUpdateNews = (newsId: string, updates: Partial<NewsPost>) => {
    updateSite((s) => ({
      ...s,
      news: s.news.map((n) => (n.id === newsId ? { ...n, ...updates } : n)),
    }));
  };

  const handleAddNavLink = () => {
    if (!activeSite) return;
    const link: NavLink = { id: generateId(), label: 'New Link', url: '#' };
    updateSite((s) => ({ ...s, navLinks: [...s.navLinks, link] }));
  };

  // --- Site List View ---
  if (!activeSite) {
    return (
      <div className="h-full flex flex-col bg-cx-bg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="font-display text-xl text-[var(--cx-text-1)]">Sites</h1>
            <p className="text-sm text-[var(--cx-text-3)] mt-1">Build intranet portals and team sites</p>
          </div>
          <button
            onClick={handleCreateSite}
            className="flex items-center gap-2 px-4 py-2 bg-cx-brand text-white rounded-lg hover:bg-cx-brand-hover transition-colors"
          >
            <Plus size={16} />
            New Site
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto px-6">
          {sites.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No sites yet"
              description="Build and publish websites for your team"
              actionLabel="+ Create Site"
              onAction={handleCreateSite}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => { setActiveSite(site); setActivePageId(site.pages[0]?.id || null); }}
                  className="bg-cx-surface border border-white/8 rounded-xl p-5 text-left hover:border-cx-brand/50 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: site.themeColor + '20' }}>
                      <Globe size={20} style={{ color: site.themeColor }} />
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      site.type === 'Team' ? 'bg-cx-brand/10 text-cx-brand' : 'bg-cx-success/10 text-cx-success'
                    )}>
                      {site.type}
                    </span>
                  </div>
                  <h3 className="text-[var(--cx-text-1)] font-semibold mb-1 group-hover:text-cx-brand transition-colors">
                    {site.name}
                  </h3>
                  <p className="text-xs text-[var(--cx-text-2)] line-clamp-1">{site.description || 'No description'}</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--cx-text-2)] mt-3">
                    <span>{site.pages.length} pages</span>
                    <span className="w-1 h-1 rounded-full bg-text-secondary/30" />
                    <span>{site.news.length} news</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const editingNews = activeSite.news.find((n) => n.id === editingNewsId);

  // --- Site Editor View ---
  return (
    <div className="h-full bg-cx-bg flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-cx-surface border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveSite(null); setActiveTab('pages'); }} className="text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]">
            <ArrowLeft size={18} />
          </button>
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: activeSite.themeColor + '20' }}>
            <Globe size={14} style={{ color: activeSite.themeColor }} />
          </div>
          <input
            value={activeSite.name}
            onChange={(e) => updateSite((s) => ({ ...s, name: e.target.value }))}
            className="bg-transparent text-[var(--cx-text-1)] font-semibold text-lg border-none outline-none focus:ring-1 focus:ring-cx-brand/30 rounded px-1"
          />
        </div>
        <div className="flex items-center gap-1 bg-cx-bg rounded-lg p-0.5">
          {(['pages', 'news', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors',
                activeTab === tab ? 'bg-cx-surface text-[var(--cx-text-1)]' : 'text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'pages' && (
          <>
            {/* Left: Page Navigation */}
            <div className="w-52 bg-cx-surface border-r border-white/8 flex flex-col shrink-0">
              <div className="p-3 border-b border-white/8 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--cx-text-2)] uppercase tracking-wider">Pages</h3>
                <button onClick={handleAddPage} className="text-[var(--cx-text-2)] hover:text-cx-brand">
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {activeSite.pages.map((page) => (
                  <div
                    key={page.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors group',
                      activePageId === page.id || (!activePageId && page.id === activeSite.pages[0]?.id)
                        ? 'bg-cx-brand/10 text-cx-brand'
                        : 'text-[var(--cx-text-1)] hover:bg-cx-bg'
                    )}
                  >
                    <FileText size={12} className="shrink-0" />
                    <button onClick={() => setActivePageId(page.id)} className="flex-1 text-left truncate">
                      {page.title}
                    </button>
                    {activeSite.pages.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
                        className="opacity-0 group-hover:opacity-100 text-[var(--cx-text-2)] hover:text-cx-danger shrink-0"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Page Builder */}
            <div className="flex-1 overflow-y-auto p-6">
              {activePage && (
                <div className="max-w-4xl mx-auto">
                  <input
                    value={activePage.title}
                    onChange={(e) => {
                      updateSite((s) => ({
                        ...s,
                        pages: s.pages.map((p) => (p.id === activePage.id ? { ...p, title: e.target.value } : p)),
                      }));
                    }}
                    className="text-xl font-bold text-[var(--cx-text-1)] bg-transparent border-none outline-none mb-6 w-full"
                    placeholder="Page Title"
                  />

                  {activePage.sections.map((section) => (
                    <div key={section.id} className="mb-4 border border-white/8/50 rounded-xl p-4 bg-cx-surface/30 relative group">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] text-[var(--cx-text-2)] uppercase tracking-wider flex items-center gap-1">
                          {section.layout === 'full' && <><Layout size={10} /> Full Width</>}
                          {section.layout === '2-col' && <><Columns2 size={10} /> 2 Columns</>}
                          {section.layout === '3-col' && <><Columns3 size={10} /> 3 Columns</>}
                        </span>
                        <button
                          onClick={() => handleDeleteSection(section.id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--cx-text-2)] hover:text-cx-danger transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className={cn(
                        'gap-4',
                        section.layout === 'full' && 'grid grid-cols-1',
                        section.layout === '2-col' && 'grid grid-cols-2',
                        section.layout === '3-col' && 'grid grid-cols-3'
                      )}>
                        {section.webParts.map((wp) => (
                          <div key={wp.id} className="relative group/wp">
                            <button
                              onClick={() => handleDeleteWebPart(section.id, wp.id)}
                              className="absolute top-1 right-1 opacity-0 group-hover/wp:opacity-100 bg-cx-surface/80 p-1 rounded text-[var(--cx-text-2)] hover:text-cx-danger z-10 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                            <WebPartRenderer webPart={wp} site={activeSite} themeColor={activeSite.themeColor} />
                          </div>
                        ))}

                        {/* Add Web Part */}
                        <div className="relative">
                          <button
                            onClick={() => setShowWebPartPicker(showWebPartPicker?.sectionId === section.id ? null : { sectionId: section.id })}
                            className="w-full py-6 border border-dashed border-white/8 rounded-lg flex items-center justify-center gap-1 text-[var(--cx-text-2)] text-xs hover:border-cx-brand/50 hover:text-cx-brand transition-colors"
                          >
                            <Plus size={12} /> Add Web Part
                          </button>
                          {showWebPartPicker?.sectionId === section.id && (
                            <div className="absolute left-0 top-full mt-1 bg-cx-surface border border-white/8 rounded-xl shadow-2xl p-3 z-20 min-w-[280px]">
                              <div className="grid grid-cols-3 gap-2">
                                {WEB_PART_TYPES.map((wpt) => (
                                  <button
                                    key={wpt.type}
                                    onClick={() => handleAddWebPart(section.id, wpt.type)}
                                    className="flex flex-col items-center gap-1 p-2 rounded-lg border border-white/8 hover:border-cx-brand hover:bg-cx-brand/5 transition-colors"
                                  >
                                    <span className="text-[var(--cx-text-1)]">{wpt.icon}</span>
                                    <span className="text-[10px] text-[var(--cx-text-2)]">{wpt.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Section */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSectionPicker(!showSectionPicker)}
                      className="w-full py-4 border-2 border-dashed border-white/8 rounded-xl flex items-center justify-center gap-2 text-[var(--cx-text-2)] hover:border-cx-brand/50 hover:text-cx-brand transition-colors"
                    >
                      <Plus size={16} /> Add Section
                    </button>
                    {showSectionPicker && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-cx-surface border border-white/8 rounded-xl shadow-2xl p-3 z-20 flex gap-2">
                        {([
                          { layout: 'full' as SectionLayout, icon: <Layout size={20} />, label: 'Full Width' },
                          { layout: '2-col' as SectionLayout, icon: <Columns2 size={20} />, label: '2 Columns' },
                          { layout: '3-col' as SectionLayout, icon: <Columns3 size={20} />, label: '3 Columns' },
                        ]).map((opt) => (
                          <button
                            key={opt.layout}
                            onClick={() => handleAddSection(opt.layout)}
                            className="flex flex-col items-center gap-1 p-3 rounded-lg border border-white/8 hover:border-cx-brand hover:bg-cx-brand/5 transition-colors min-w-[80px]"
                          >
                            <span className="text-[var(--cx-text-1)]">{opt.icon}</span>
                            <span className="text-[10px] text-[var(--cx-text-2)]">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'news' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              {!editingNews ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">News Posts</h2>
                    <button
                      onClick={handleCreateNews}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-cx-brand text-white rounded-lg hover:bg-cx-brand/90"
                    >
                      <Plus size={14} /> New Post
                    </button>
                  </div>
                  <div className="space-y-2">
                    {activeSite.news.map((post) => (
                      <div key={post.id} className="flex items-center gap-4 p-4 bg-cx-surface border border-white/8 rounded-xl">
                        <div className="w-16 h-16 rounded-lg bg-cx-bg flex items-center justify-center shrink-0">
                          <Newspaper size={20} className="text-[var(--cx-text-2)]/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[var(--cx-text-1)] font-medium">{post.title}</h3>
                          <p className="text-xs text-[var(--cx-text-2)] mt-0.5 truncate">{post.body || 'No content yet'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[var(--cx-text-2)]">{post.createdAt}</span>
                            <span className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                              post.published ? 'bg-cx-success/10 text-cx-success' : 'bg-cx-warning/10 text-cx-warning'
                            )}>
                              {post.published ? 'Published' : 'Draft'}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => setEditingNewsId(post.id)} className="text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]">
                          <Edit3 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <button
                    onClick={() => setEditingNewsId(null)}
                    className="flex items-center gap-1 text-sm text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)] mb-4"
                  >
                    <ArrowLeft size={14} /> Back to posts
                  </button>
                  <input
                    value={editingNews.title}
                    onChange={(e) => handleUpdateNews(editingNews.id, { title: e.target.value })}
                    className="w-full text-xl font-bold text-[var(--cx-text-1)] bg-transparent border-none outline-none mb-4"
                    placeholder="Post Title"
                  />
                  <div className="mb-4">
                    <label className="block text-xs text-[var(--cx-text-2)] mb-1">Cover Image URL</label>
                    <input
                      value={editingNews.coverImage}
                      onChange={(e) => handleUpdateNews(editingNews.id, { coverImage: e.target.value })}
                      className="w-full bg-cx-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs text-[var(--cx-text-2)] mb-1">Body</label>
                    <textarea
                      value={editingNews.body}
                      onChange={(e) => handleUpdateNews(editingNews.id, { body: e.target.value })}
                      rows={12}
                      className="w-full bg-cx-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none resize-none"
                      placeholder="Write your news post..."
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateNews(editingNews.id, { published: !editingNews.published })}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium',
                      editingNews.published
                        ? 'bg-cx-warning/10 text-cx-warning hover:bg-cx-warning/20'
                        : 'bg-cx-brand text-white hover:bg-cx-brand/90'
                    )}
                  >
                    {editingNews.published ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-lg font-semibold text-[var(--cx-text-1)]">Site Settings</h2>

              <div>
                <label className="block text-xs text-[var(--cx-text-2)] mb-1">Site Name</label>
                <input
                  value={activeSite.name}
                  onChange={(e) => updateSite((s) => ({ ...s, name: e.target.value }))}
                  className="w-full bg-cx-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--cx-text-2)] mb-1">Description</label>
                <textarea
                  value={activeSite.description}
                  onChange={(e) => updateSite((s) => ({ ...s, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-cx-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--cx-text-2)] mb-1">Site Type</label>
                <select
                  value={activeSite.type}
                  onChange={(e) => updateSite((s) => ({ ...s, type: e.target.value as SiteType }))}
                  className="w-full bg-cx-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-[var(--cx-text-1)] outline-none"
                >
                  <option value="Team">Team</option>
                  <option value="Communication">Communication</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--cx-text-2)] mb-2">Theme Color</label>
                <div className="flex gap-2">
                  {THEME_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateSite((s) => ({ ...s, themeColor: c }))}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-colors',
                        activeSite.themeColor === c ? 'border-white' : 'border-transparent hover:border-white/30'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[var(--cx-text-2)]">Navigation Links</label>
                  <button onClick={handleAddNavLink} className="text-[var(--cx-text-2)] hover:text-cx-brand">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {activeSite.navLinks.map((link) => (
                    <div key={link.id} className="flex items-center gap-2">
                      <input
                        value={link.label}
                        onChange={(e) =>
                          updateSite((s) => ({
                            ...s,
                            navLinks: s.navLinks.map((l) => (l.id === link.id ? { ...l, label: e.target.value } : l)),
                          }))
                        }
                        className="flex-1 bg-cx-surface border border-white/8 rounded-lg px-3 py-1.5 text-sm text-[var(--cx-text-1)] outline-none"
                        placeholder="Label"
                      />
                      <input
                        value={link.url}
                        onChange={(e) =>
                          updateSite((s) => ({
                            ...s,
                            navLinks: s.navLinks.map((l) => (l.id === link.id ? { ...l, url: e.target.value } : l)),
                          }))
                        }
                        className="flex-1 bg-cx-surface border border-white/8 rounded-lg px-3 py-1.5 text-sm text-[var(--cx-text-1)] outline-none"
                        placeholder="URL"
                      />
                      <button
                        onClick={() => updateSite((s) => ({ ...s, navLinks: s.navLinks.filter((l) => l.id !== link.id) }))}
                        className="text-[var(--cx-text-2)] hover:text-cx-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
