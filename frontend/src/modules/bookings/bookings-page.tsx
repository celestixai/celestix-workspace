import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Plus,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  Link2,
  Trash2,
  Pencil,
  X,
  Users,
  Globe,
  Mail,
  Phone,
  ChevronLeft,
  Filter,
  Search,
  CalendarCheck,
  CalendarX,
  MoreHorizontal,
  Copy,
  LayoutGrid,
  LayoutList,
  Timer,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BookingPage {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  serviceCount: number;
  appointmentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface BookingService {
  id: string;
  name: string;
  description?: string;
  duration: number; // minutes
  bufferTime: number; // minutes
  price: number;
  currency: string;
  isActive: boolean;
  pageId: string;
}

interface Appointment {
  id: string;
  serviceName: string;
  serviceId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  notes?: string;
  pageId: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-cx-success/10', text: 'text-cx-success' },
  pending: { bg: 'bg-cx-warning/10', text: 'text-cx-warning' },
  cancelled: { bg: 'bg-cx-danger/10', text: 'text-cx-danger' },
  completed: { bg: 'bg-cx-brand/10', text: 'text-cx-brand' },
};

/* ------------------------------------------------------------------ */
/*  Bookings Page                                                      */
/* ------------------------------------------------------------------ */

export function BookingsPage() {
  const [pages, setPages] = useState<BookingPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<BookingPage | null>(null);
  const [services, setServices] = useState<BookingService[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Dialogs
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [showEditPage, setShowEditPage] = useState(false);
  const [showDeletePage, setShowDeletePage] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<BookingService | null>(null);

  // Create/edit page form
  const [pageName, setPageName] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageDesc, setPageDesc] = useState('');

  // Service form
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDuration, setSvcDuration] = useState(30);
  const [svcBuffer, setSvcBuffer] = useState(0);
  const [svcPrice, setSvcPrice] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* -- Fetch pages -- */

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/bookings/pages');
      setPages(data.data ?? data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  /* -- Fetch page detail -- */

  const fetchPageDetail = useCallback(async (page: BookingPage) => {
    try {
      const [svcRes, apptRes] = await Promise.all([
        api.get(`/bookings/pages/${page.id}/services`).catch(() => ({ data: { data: [] } })),
        api.get(`/bookings/pages/${page.id}/appointments`).catch(() => ({ data: { data: [] } })),
      ]);
      setServices(svcRes.data.data ?? svcRes.data ?? []);
      setAppointments(apptRes.data.data ?? apptRes.data ?? []);
    } catch {
      setServices([]);
      setAppointments([]);
    }
  }, []);

  useEffect(() => {
    if (selectedPage) fetchPageDetail(selectedPage);
  }, [selectedPage, fetchPageDetail]);

  /* -- Filtered appointments -- */

  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter !== 'all' && appt.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        appt.guestName.toLowerCase().includes(q) ||
        appt.guestEmail.toLowerCase().includes(q) ||
        appt.serviceName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* -- Page CRUD -- */

  const handleCreatePage = async () => {
    if (!pageName.trim()) return;
    try {
      const { data } = await api.post('/bookings/pages', {
        name: pageName.trim(),
        slug: pageSlug.trim() || pageName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: pageDesc.trim() || undefined,
      });
      const created = data.data ?? data;
      setPages((prev) => [...prev, created]);
      setPageName('');
      setPageSlug('');
      setPageDesc('');
      setShowCreatePage(false);
    } catch {
      /* ignore */
    }
  };

  const handleEditPage = async () => {
    if (!selectedPage || !pageName.trim()) return;
    try {
      const { data } = await api.patch(`/bookings/pages/${selectedPage.id}`, {
        name: pageName.trim(),
        slug: pageSlug.trim(),
        description: pageDesc.trim() || undefined,
      });
      const updated = data.data ?? data;
      setPages((prev) => prev.map((p) => (p.id === selectedPage.id ? { ...p, ...updated } : p)));
      setSelectedPage((prev) => prev ? { ...prev, ...updated } : prev);
      setShowEditPage(false);
    } catch {
      /* ignore */
    }
  };

  const handleDeletePage = async () => {
    if (!selectedPage) return;
    try {
      await api.delete(`/bookings/pages/${selectedPage.id}`);
      setPages((prev) => prev.filter((p) => p.id !== selectedPage.id));
      setSelectedPage(null);
      setShowDeletePage(false);
    } catch {
      /* ignore */
    }
  };

  /* -- Service CRUD -- */

  const openServiceDialog = (service?: BookingService) => {
    if (service) {
      setEditingService(service);
      setSvcName(service.name);
      setSvcDesc(service.description || '');
      setSvcDuration(service.duration);
      setSvcBuffer(service.bufferTime);
      setSvcPrice(service.price);
    } else {
      setEditingService(null);
      setSvcName('');
      setSvcDesc('');
      setSvcDuration(30);
      setSvcBuffer(0);
      setSvcPrice(0);
    }
    setShowServiceDialog(true);
  };

  const handleSaveService = async () => {
    if (!selectedPage || !svcName.trim()) return;
    try {
      if (editingService) {
        const { data } = await api.patch(`/bookings/pages/${selectedPage.id}/services`, {
          id: editingService.id,
          name: svcName.trim(),
          description: svcDesc.trim() || undefined,
          duration: svcDuration,
          bufferTime: svcBuffer,
          price: svcPrice,
        });
        const updated = data.data ?? data;
        setServices((prev) => prev.map((s) => (s.id === editingService.id ? { ...s, ...updated } : s)));
      } else {
        const { data } = await api.post(`/bookings/pages/${selectedPage.id}/services`, {
          name: svcName.trim(),
          description: svcDesc.trim() || undefined,
          duration: svcDuration,
          bufferTime: svcBuffer,
          price: svcPrice,
        });
        const created = data.data ?? data;
        setServices((prev) => [...prev, created]);
      }
      setShowServiceDialog(false);
    } catch {
      /* ignore */
    }
  };

  /* -- Cancel appointment -- */

  const handleCancelAppointment = async (apptId: string) => {
    try {
      await api.patch(`/bookings/appointments/${apptId}`, { status: 'cancelled' });
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: 'cancelled' as const } : a))
      );
    } catch {
      /* ignore */
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  // Detail view
  if (selectedPage) {
    return (
      <div className="flex flex-col h-full bg-[#09090B]">
        {/* Header */}
        <div className="h-14 flex items-center gap-3 px-6 border-b border-white/10 flex-shrink-0">
          <button
            onClick={() => setSelectedPage(null)}
            className="p-1 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{selectedPage.name}</h2>
            <p className="text-xs text-white/40 truncate">/{selectedPage.slug}</p>
          </div>
          <button
            onClick={() => {
              setPageName(selectedPage.name);
              setPageSlug(selectedPage.slug);
              setPageDesc(selectedPage.description || '');
              setShowEditPage(true);
            }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
            title="Edit page"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setShowDeletePage(true)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-cx-danger transition-colors"
            title="Delete page"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Calendar integration note */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-cx-brand/10 border border-cx-brand/20">
            <Calendar size={16} className="text-cx-brand flex-shrink-0" />
            <p className="text-sm text-cx-brand">
              Booked appointments will automatically appear on your Calendar module.
            </p>
          </div>

          {/* Services */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Services</h3>
              <button
                onClick={() => openServiceDialog()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-cx-brand text-white hover:bg-[var(--cx-brand-hover)] transition-colors"
              >
                <Plus size={12} />
                Add Service
              </button>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-8 rounded-lg border border-dashed border-white/10">
                <Timer size={28} className="mx-auto text-white/15 mb-2" />
                <p className="text-sm text-white/40">No services yet</p>
                <p className="text-xs text-white/25 mt-1">Add services that people can book</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {services.map((svc) => (
                  <div key={svc.id} className="bg-cx-bg border border-white/10 rounded-lg p-4 hover:border-white/15 transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-white">{svc.name}</h4>
                      <button
                        onClick={() => openServiceDialog(svc)}
                        className="p-1 rounded hover:bg-white/5 text-white/20 group-hover:text-white/50 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                    {svc.description && (
                      <p className="text-xs text-white/40 mb-3 line-clamp-2">{svc.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {svc.duration}m
                      </span>
                      {svc.bufferTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Timer size={11} />
                          {svc.bufferTime}m buffer
                        </span>
                      )}
                      {svc.price > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={11} />
                          {svc.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Appointments */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Appointments</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 pl-7 pr-3 rounded-lg bg-cx-bg border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand w-36"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-7 px-2 rounded-lg bg-cx-bg border border-white/10 text-xs text-white/70 focus:outline-none focus:border-cx-brand"
                >
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {filteredAppointments.length === 0 ? (
              <div className="text-center py-8 rounded-lg border border-dashed border-white/10">
                <CalendarCheck size={28} className="mx-auto text-white/15 mb-2" />
                <p className="text-sm text-white/40">No appointments</p>
              </div>
            ) : (
              <div className="bg-cx-bg border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-[11px] font-medium text-white/40 uppercase tracking-wider px-4 py-2.5">Guest</th>
                      <th className="text-left text-[11px] font-medium text-white/40 uppercase tracking-wider px-4 py-2.5">Service</th>
                      <th className="text-left text-[11px] font-medium text-white/40 uppercase tracking-wider px-4 py-2.5">Date & Time</th>
                      <th className="text-left text-[11px] font-medium text-white/40 uppercase tracking-wider px-4 py-2.5">Status</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((appt) => {
                      const style = STATUS_STYLES[appt.status] || STATUS_STYLES.pending;
                      return (
                        <tr key={appt.id} className="border-b border-white/5 hover:bg-white/[0.02] group">
                          <td className="px-4 py-3">
                            <p className="text-sm text-white">{appt.guestName}</p>
                            <p className="text-xs text-white/40 flex items-center gap-1">
                              <Mail size={10} />
                              {appt.guestEmail}
                            </p>
                            {appt.guestPhone && (
                              <p className="text-xs text-white/30 flex items-center gap-1 mt-0.5">
                                <Phone size={10} />
                                {appt.guestPhone}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/70">{appt.serviceName}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-white/70">{formatDate(appt.date)}</p>
                            <p className="text-xs text-white/40">{appt.startTime} - {appt.endTime}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              {appt.status}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                              <button
                                onClick={() => handleCancelAppointment(appt.id)}
                                className="p-1 rounded hover:bg-white/5 text-white/20 opacity-0 group-hover:opacity-100 hover:text-cx-danger transition-all"
                                title="Cancel appointment"
                              >
                                <CalendarX size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Edit Page Dialog */}
        {showEditPage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowEditPage(false)}>
            <div className="bg-cx-bg border border-white/10 rounded-xl w-[440px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Edit Booking Page</h3>
                <button onClick={() => setShowEditPage(false)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Name</label>
                  <input type="text" value={pageName} onChange={(e) => setPageName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Slug</label>
                  <input type="text" value={pageSlug} onChange={(e) => setPageSlug(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Description</label>
                  <textarea rows={3} value={pageDesc} onChange={(e) => setPageDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowEditPage(false)} className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={handleEditPage} disabled={!pageName.trim()} className="px-3 py-1.5 rounded-lg text-sm bg-cx-brand text-white hover:bg-[var(--cx-brand-hover)] transition-colors disabled:opacity-40">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Page Dialog */}
        {showDeletePage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowDeletePage(false)}>
            <div className="bg-cx-bg border border-white/10 rounded-xl w-[380px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-white mb-2">Delete Booking Page</h3>
              <p className="text-sm text-white/50 mb-5">
                Delete <span className="text-white font-medium">{selectedPage.name}</span>? All services and appointments will be removed.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDeletePage(false)} className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={handleDeletePage} className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-500 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Service Dialog */}
        {showServiceDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowServiceDialog(false)}>
            <div className="bg-cx-bg border border-white/10 rounded-xl w-[440px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">{editingService ? 'Edit Service' : 'Add Service'}</h3>
                <button onClick={() => setShowServiceDialog(false)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Service Name</label>
                  <input type="text" placeholder="e.g. Consultation" value={svcName} onChange={(e) => setSvcName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Description</label>
                  <textarea rows={2} placeholder="Optional description" value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand resize-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Duration (min)</label>
                    <input type="number" min={5} step={5} value={svcDuration} onChange={(e) => setSvcDuration(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/10 text-sm text-white focus:outline-none focus:border-cx-brand" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Buffer (min)</label>
                    <input type="number" min={0} step={5} value={svcBuffer} onChange={(e) => setSvcBuffer(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/10 text-sm text-white focus:outline-none focus:border-cx-brand" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Price ($)</label>
                    <input type="number" min={0} step={0.01} value={svcPrice} onChange={(e) => setSvcPrice(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/10 text-sm text-white focus:outline-none focus:border-cx-brand" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowServiceDialog(false)} className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={handleSaveService} disabled={!svcName.trim()} className="px-3 py-1.5 rounded-lg text-sm bg-cx-brand text-white hover:bg-[var(--cx-brand-hover)] transition-colors disabled:opacity-40">
                    {editingService ? 'Save' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -- Pages list view -- */

  return (
    <div className="flex flex-col h-full bg-[#09090B]">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-6 border-b border-white/10 flex-shrink-0">
        <Calendar size={18} className="text-cx-brand" />
        <h1 className="text-base font-display text-white">Bookings</h1>
        <div className="flex-1" />
        <div className="flex items-center bg-cx-bg rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
          >
            <LayoutList size={14} />
          </button>
        </div>
        <button
          onClick={() => {
            setPageName('');
            setPageSlug('');
            setPageDesc('');
            setShowCreatePage(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-cx-brand text-white hover:bg-[var(--cx-brand-hover)] transition-colors"
        >
          <Plus size={14} />
          New Booking Page
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`bg-cx-bg border border-white/10 rounded-lg animate-pulse ${viewMode === 'grid' ? 'h-36' : 'h-16'}`} />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Calendar size={48} className="text-white/10 mb-3" />
            <p className="text-base text-white/50 mb-1">No booking pages</p>
            <p className="text-sm text-white/30 mb-4">Create a booking page to let people schedule appointments</p>
            <button
              onClick={() => setShowCreatePage(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cx-brand text-white text-sm hover:bg-[var(--cx-brand-hover)] transition-colors"
            >
              <Plus size={14} />
              Create Booking Page
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((page) => (
              <div
                key={page.id}
                onClick={() => setSelectedPage(page)}
                className="bg-cx-bg border border-white/10 rounded-lg p-5 cursor-pointer hover:border-white/20 hover:bg-cx-bg/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cx-brand/15 flex items-center justify-center">
                      <Calendar size={14} className="text-cx-brand" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{page.name}</h3>
                      <p className="text-xs text-white/30">/{page.slug}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${page.isActive ? 'bg-green-400' : 'bg-white/20'}`} title={page.isActive ? 'Active' : 'Inactive'} />
                </div>
                {page.description && (
                  <p className="text-xs text-white/40 mb-3 line-clamp-2">{page.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Timer size={11} />{page.serviceCount ?? 0} services</span>
                  <span className="flex items-center gap-1"><Users size={11} />{page.appointmentCount ?? 0} bookings</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {pages.map((page) => (
              <div
                key={page.id}
                onClick={() => setSelectedPage(page)}
                className="flex items-center gap-4 bg-cx-bg border border-white/10 rounded-lg px-4 py-3 cursor-pointer hover:border-white/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-cx-brand/15 flex items-center justify-center flex-shrink-0">
                  <Calendar size={14} className="text-cx-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">{page.name}</h3>
                  <p className="text-xs text-white/30">/{page.slug}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span>{page.serviceCount ?? 0} services</span>
                  <span>{page.appointmentCount ?? 0} bookings</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${page.isActive ? 'bg-green-400' : 'bg-white/20'}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Page Dialog */}
      {showCreatePage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreatePage(false)}>
          <div className="bg-cx-bg border border-white/10 rounded-xl w-[440px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Create Booking Page</h3>
              <button onClick={() => setShowCreatePage(false)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Name</label>
                <input autoFocus type="text" placeholder="My Booking Page" value={pageName}
                  onChange={(e) => {
                    setPageName(e.target.value);
                    if (!pageSlug || pageSlug === pageName.toLowerCase().replace(/\s+/g, '-')) {
                      setPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Slug</label>
                <div className="flex items-center gap-0">
                  <span className="h-9 flex items-center px-3 rounded-l-lg bg-cx-bg border border-r-0 border-white/10 text-xs text-white/30">/</span>
                  <input type="text" placeholder="my-booking-page" value={pageSlug} onChange={(e) => setPageSlug(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-r-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Description (optional)</label>
                <textarea rows={3} placeholder="Describe what this booking page is for..." value={pageDesc} onChange={(e) => setPageDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-cx-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cx-brand resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreatePage(false)} className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={handleCreatePage} disabled={!pageName.trim()} className="px-3 py-1.5 rounded-lg text-sm bg-cx-brand text-white hover:bg-[var(--cx-brand-hover)] transition-colors disabled:opacity-40">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
