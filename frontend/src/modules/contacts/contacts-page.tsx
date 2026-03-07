import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Avatar } from '@/components/shared/avatar';
import { toast } from '@/components/ui/toast';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Building2,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Tag,
  X,
  Globe,
  Briefcase,
  Calendar,
  MessageSquare,
  Download,
  Upload,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  company?: string;
  title?: string;
  jobTitle?: string;
  birthday?: string;
  notes?: string;
  address?: string;
  website?: string;
  isFavorite: boolean;
  isStarred?: boolean;
  isInternalUser: boolean;
  emails: Array<{ id: string; email: string; label: string; isPrimary: boolean }>;
  phones: Array<{ id: string; phone: string; label: string; isPrimary: boolean }>;
  addresses?: Array<{ id: string; street?: string; city?: string; state?: string; country?: string; zip?: string; label: string }>;
  groups: Array<{ group: { id: string; name: string; color: string } }>;
  groupIds?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ContactGroup {
  id: string;
  name: string;
  color: string;
  contactCount: number;
  _count?: { members: number };
}

/* ------------------------------------------------------------------ */
/*  Contacts Page                                                      */
/* ------------------------------------------------------------------ */

export function ContactsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [filterFavorite, setFilterFavorite] = useState(false);

  /* -- Queries -- */

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts', selectedGroupId, filterFavorite, searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '200' };
      if (selectedGroupId) params.group = selectedGroupId;
      if (filterFavorite) params.favorite = 'true';
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get('/contacts', { params });
      return data.data as Contact[];
    },
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['contact-groups'],
    queryFn: async () => {
      const { data } = await api.get('/contacts/groups');
      return data.data as ContactGroup[];
    },
  });

  const selectedContact = useMemo(() => {
    return contacts.find((c) => c.id === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  /* -- Group contacts alphabetically -- */

  const groupedContacts = useMemo(() => {
    const sorted = [...contacts].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
    const groups: Record<string, Contact[]> = {};
    sorted.forEach((c) => {
      const letter = c.displayName[0]?.toUpperCase() || '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    return groups;
  }, [contacts]);

  const letters = Object.keys(groupedContacts).sort();

  /* -- Mutations -- */

  const createContact = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/contacts', payload);
      return data.data as Contact;
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-groups'] });
      setShowCreateContact(false);
      setSelectedContactId(contact.id);
      toast('Contact created', 'success');
    },
    onError: () => toast('Failed to create contact', 'error'),
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      await api.patch(`/contacts/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setEditingContact(null);
      toast('Contact updated', 'success');
    },
    onError: () => toast('Failed to update contact', 'error'),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-groups'] });
      setSelectedContactId(null);
      toast('Contact deleted', 'success');
    },
    onError: () => toast('Failed to delete contact', 'error'),
  });

  const toggleFavorite = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/contacts/${id}/favorite`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const createGroup = useMutation({
    mutationFn: async (name: string) => {
      await api.post('/contacts/groups', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-groups'] });
      setShowCreateGroup(false);
      toast('Group created', 'success');
    },
    onError: () => toast('Failed to create group', 'error'),
  });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* ===== Group Sidebar ===== */}
      <aside className="w-[200px] flex-shrink-0 bg-bg-secondary border-r border-border-primary flex flex-col">
        <div className="p-3 flex-shrink-0">
          <Button className="w-full" onClick={() => setShowCreateContact(true)}>
            <UserPlus size={16} />
            New Contact
          </Button>
        </div>

        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          <button
            onClick={() => { setSelectedGroupId(null); setFilterFavorite(false); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              !selectedGroupId && !filterFavorite
                ? 'bg-bg-active text-text-primary font-medium'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            )}
          >
            <Users size={16} />
            <span className="flex-1 text-left">All Contacts</span>
            <span className="text-xs text-text-tertiary">{contacts.length}</span>
          </button>

          <button
            onClick={() => { setSelectedGroupId(null); setFilterFavorite(true); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              filterFavorite
                ? 'bg-bg-active text-text-primary font-medium'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            )}
          >
            <Star size={16} />
            <span className="flex-1 text-left">Favorites</span>
          </button>

          {/* Groups */}
          <div className="pt-4">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Groups
              </span>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="p-0.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
                aria-label="Add group"
              >
                <Plus size={12} />
              </button>
            </div>

            {groupsLoading ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="text-xs text-text-tertiary px-3 py-2">No groups</p>
            ) : (
              groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => { setSelectedGroupId(group.id); setFilterFavorite(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedGroupId === group.id
                      ? 'bg-bg-active text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  <span className="truncate flex-1 text-left">{group.name}</span>
                  <span className="text-xs text-text-tertiary">
                    {group.contactCount ?? group._count?.members ?? 0}
                  </span>
                </button>
              ))
            )}
          </div>
        </nav>

        <div className="p-3 border-t border-border-primary flex-shrink-0 space-y-1">
          <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors">
            <Upload size={12} className="flex-shrink-0" /> Import
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors">
            <Download size={12} className="flex-shrink-0" /> Export
          </button>
        </div>
      </aside>

      {/* ===== Contact List ===== */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border-primary">
        <div className="h-12 flex items-center gap-2 px-3 border-b border-border-primary flex-shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-bg-tertiary border border-border-primary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {contactsLoading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={<Users size={48} />}
              title={searchQuery ? 'No results' : 'No contacts'}
              description={searchQuery ? 'Try a different search term' : 'Add your first contact'}
              action={
                !searchQuery ? (
                  <Button onClick={() => setShowCreateContact(true)}>
                    <UserPlus size={14} /> Add Contact
                  </Button>
                ) : undefined
              }
            />
          ) : (
            letters.map((letter) => (
              <div key={letter}>
                <div className="px-4 py-1.5 bg-bg-secondary/50 sticky top-0 z-10">
                  <span className="text-xs font-bold text-accent-blue">{letter}</span>
                </div>
                {groupedContacts[letter].map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                      selectedContactId === contact.id ? 'bg-bg-active' : 'hover:bg-bg-hover'
                    )}
                  >
                    <Avatar src={contact.avatarUrl} name={contact.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-text-primary truncate">{contact.displayName}</p>
                        {(contact.isFavorite || contact.isStarred) && (
                          <Star size={10} className="text-accent-amber flex-shrink-0" fill="currentColor" />
                        )}
                      </div>
                      {contact.company && (
                        <p className="text-xs text-text-tertiary truncate">{contact.company}</p>
                      )}
                      {contact.emails?.[0] && (
                        <p className="text-xs text-text-tertiary truncate">{contact.emails[0].email}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== Contact Detail Panel ===== */}
      <aside className="w-[380px] flex-shrink-0 bg-bg-secondary flex flex-col overflow-y-auto">
        {selectedContact ? (
          <div className="flex-1">
            {/* Header */}
            <div className="p-6 text-center border-b border-border-primary">
              <Avatar
                src={selectedContact.avatarUrl}
                name={selectedContact.displayName}
                size="xl"
                className="mx-auto mb-3"
              />
              <h2 className="text-xl font-semibold text-text-primary">{selectedContact.displayName}</h2>
              {(selectedContact.title || selectedContact.jobTitle) && (
                <p className="text-sm text-text-secondary mt-0.5">{selectedContact.title || selectedContact.jobTitle}</p>
              )}
              {selectedContact.company && (
                <p className="text-sm text-text-tertiary flex items-center gap-1 justify-center mt-0.5">
                  <Building2 size={12} /> {selectedContact.company}
                </p>
              )}

              <div className="flex items-center justify-center gap-2 mt-4">
                {selectedContact.emails?.[0] && (
                  <a
                    href={`mailto:${selectedContact.emails[0].email}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-accent-blue transition-colors"
                  >
                    <Mail size={12} /> Email
                  </a>
                )}
                {selectedContact.phones?.[0] && (
                  <a
                    href={`tel:${selectedContact.phones[0].phone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-accent-blue transition-colors"
                  >
                    <Phone size={12} /> Call
                  </a>
                )}
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-accent-blue transition-colors">
                  <MessageSquare size={12} /> Message
                </button>
              </div>
            </div>

            {/* Info sections */}
            <div className="p-4 space-y-4">
              {/* Emails */}
              {selectedContact.emails?.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Email</h3>
                  {selectedContact.emails.map((email) => (
                    <div key={email.id} className="flex items-start gap-3 py-1.5">
                      <Mail size={14} className="text-text-tertiary mt-0.5" />
                      <div>
                        <p className="text-sm text-text-primary">{email.email}</p>
                        <p className="text-[10px] text-text-tertiary capitalize">{email.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Phones */}
              {selectedContact.phones?.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Phone</h3>
                  {selectedContact.phones.map((phone) => (
                    <div key={phone.id} className="flex items-start gap-3 py-1.5">
                      <Phone size={14} className="text-text-tertiary mt-0.5" />
                      <div>
                        <p className="text-sm text-text-primary">{phone.phone}</p>
                        <p className="text-[10px] text-text-tertiary capitalize">{phone.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Addresses */}
              {selectedContact.addresses && selectedContact.addresses.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Address</h3>
                  {selectedContact.addresses.map((addr) => (
                    <div key={addr.id} className="flex items-start gap-3 py-1.5">
                      <MapPin size={14} className="text-text-tertiary mt-0.5" />
                      <div>
                        <p className="text-sm text-text-primary">
                          {[addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(', ')}
                        </p>
                        <p className="text-[10px] text-text-tertiary capitalize">{addr.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Birthday */}
              {selectedContact.birthday && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Birthday</h3>
                  <div className="flex items-center gap-3 py-1.5">
                    <Calendar size={14} className="text-text-tertiary" />
                    <p className="text-sm text-text-primary">
                      {new Date(selectedContact.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedContact.notes && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Notes</h3>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{selectedContact.notes}</p>
                </div>
              )}

              {/* Groups */}
              {selectedContact.groups?.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">Groups</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedContact.groups.map((g) => (
                      <span
                        key={g.group.id}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-border-secondary"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.group.color }} />
                        {g.group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border-primary flex items-center gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditingContact(selectedContact)}>
                <Pencil size={14} /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFavorite.mutate(selectedContact.id)}
                className={(selectedContact.isFavorite || selectedContact.isStarred) ? 'text-accent-amber' : ''}
                aria-label="Toggle favorite"
              >
                <Star size={14} fill={(selectedContact.isFavorite || selectedContact.isStarred) ? 'currentColor' : 'none'} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteContact.mutate(selectedContact.id)} className="text-accent-red hover:text-accent-red" aria-label="Delete contact">
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Users size={48} />}
            title="Select a contact"
            description="Choose a contact to view their details"
            className="flex-1"
          />
        )}
      </aside>

      {/* ===== Create Contact Modal ===== */}
      <ContactFormModal
        open={showCreateContact}
        onClose={() => setShowCreateContact(false)}
        onSubmit={(payload) => createContact.mutate(payload)}
        loading={createContact.isPending}
        title="New Contact"
      />

      {/* ===== Edit Contact Modal ===== */}
      {editingContact && (
        <ContactFormModal
          open={true}
          onClose={() => setEditingContact(null)}
          onSubmit={(payload) => updateContact.mutate({ id: editingContact.id, ...payload })}
          loading={updateContact.isPending}
          title="Edit Contact"
          initialData={editingContact}
        />
      )}

      {/* ===== Create Group Modal ===== */}
      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreate={(name) => createGroup.mutate(name)}
        loading={createGroup.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Contact Form Modal                                                 */
/* ------------------------------------------------------------------ */

function ContactFormModal({
  open,
  onClose,
  onSubmit,
  loading,
  title,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  loading: boolean;
  title: string;
  initialData?: Contact;
}) {
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');
  const [email, setEmail] = useState(initialData?.emails?.[0]?.email || '');
  const [phone, setPhone] = useState(initialData?.phones?.[0]?.phone || '');
  const [company, setCompany] = useState(initialData?.company || '');
  const [jobTitle, setJobTitle] = useState(initialData?.title || initialData?.jobTitle || '');
  const [website, setWebsite] = useState(initialData?.website || '');
  const [birthday, setBirthday] = useState(initialData?.birthday || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = () => {
    if (!displayName.trim()) {
      toast('Name is required', 'error');
      return;
    }
    onSubmit({
      displayName: displayName.trim(),
      company: company.trim() || undefined,
      title: jobTitle.trim() || undefined,
      birthday: birthday || undefined,
      notes: notes.trim() || undefined,
      emails: email ? [{ email: email.trim(), label: 'personal', isPrimary: true }] : [],
      phones: phone ? [{ phone: phone.trim(), label: 'mobile', isPrimary: true }] : [],
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <Input
          label="Name"
          placeholder="John Doe"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={14} />}
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="+1 555-0123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            icon={<Phone size={14} />}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Company"
            placeholder="Acme Inc."
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            icon={<Building2 size={14} />}
          />
          <Input
            label="Job Title"
            placeholder="Software Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            icon={<Briefcase size={14} />}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Website"
            placeholder="https://example.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            icon={<Globe size={14} />}
          />
          <Input
            label="Birthday"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} loading={loading} disabled={!displayName.trim()}>
          {initialData ? 'Save Changes' : 'Create Contact'}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Group Modal                                                 */
/* ------------------------------------------------------------------ */

function CreateGroupModal({
  open,
  onClose,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Group" size="sm">
      <div className="space-y-4">
        <Input
          label="Group name"
          placeholder="e.g. Team, Family, Friends"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} loading={loading} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}
