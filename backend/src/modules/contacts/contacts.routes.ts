import { Router, Request, Response } from 'express';
import { contactsService } from './contacts.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createContactSchema,
  updateContactSchema,
  createGroupSchema,
  contactsQuerySchema,
} from './contacts.schema';
import { prisma } from '../../config/database';

const router = Router();

// GET /api/v1/contacts
router.get('/', authenticate, validate(contactsQuerySchema, 'query'), async (req: Request, res: Response) => {
  const result = await contactsService.getContacts(req.user!.id, req.query as never);
  res.json({ success: true, data: result.contacts, pagination: result.pagination });
});

// POST /api/v1/contacts
router.post('/', authenticate, validate(createContactSchema), async (req: Request, res: Response) => {
  const contact = await contactsService.createContact(req.user!.id, req.body);
  res.status(201).json({ success: true, data: contact });
});

// POST /api/v1/contacts/sync
router.post('/sync', authenticate, async (req: Request, res: Response) => {
  await contactsService.syncInternalUsers(req.user!.id);
  res.json({ success: true, data: { synced: true } });
});

// GET /api/v1/contacts/duplicates
router.get('/duplicates', authenticate, async (req: Request, res: Response) => {
  const duplicates = await contactsService.findDuplicates(req.user!.id);
  res.json({ success: true, data: duplicates });
});

// POST /api/v1/contacts/merge
router.post('/merge', authenticate, async (req: Request, res: Response) => {
  const { primaryId, secondaryId } = req.body;
  const contact = await contactsService.mergeContacts(req.user!.id, primaryId, secondaryId);
  res.json({ success: true, data: contact });
});

// GET /api/v1/contacts/groups
router.get('/groups', authenticate, async (req: Request, res: Response) => {
  const groups = await contactsService.getGroups(req.user!.id);
  res.json({ success: true, data: groups });
});

// POST /api/v1/contacts/groups
router.post('/groups', authenticate, validate(createGroupSchema), async (req: Request, res: Response) => {
  const group = await contactsService.createGroup(req.user!.id, req.body);
  res.status(201).json({ success: true, data: group });
});

// DELETE /api/v1/contacts/groups/:groupId
router.delete('/groups/:groupId', authenticate, async (req: Request, res: Response) => {
  await contactsService.deleteGroup(req.user!.id, req.params.groupId);
  res.json({ success: true, data: { deleted: true } });
});

// GET /api/v1/contacts/:contactId
router.get('/:contactId', authenticate, async (req: Request, res: Response) => {
  const contact = await contactsService.getContact(req.user!.id, req.params.contactId);
  res.json({ success: true, data: contact });
});

// PATCH /api/v1/contacts/:contactId
router.patch('/:contactId', authenticate, validate(updateContactSchema), async (req: Request, res: Response) => {
  const contact = await contactsService.updateContact(req.user!.id, req.params.contactId, req.body);
  res.json({ success: true, data: contact });
});

// DELETE /api/v1/contacts/:contactId
router.delete('/:contactId', authenticate, async (req: Request, res: Response) => {
  await contactsService.deleteContact(req.user!.id, req.params.contactId);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/contacts/:contactId/favorite
router.post('/:contactId/favorite', authenticate, async (req: Request, res: Response) => {
  const contact = await contactsService.toggleFavorite(req.user!.id, req.params.contactId);
  res.json({ success: true, data: contact });
});

// POST /api/v1/contacts/:contactId/groups/:groupId
router.post('/:contactId/groups/:groupId', authenticate, async (req: Request, res: Response) => {
  await contactsService.addToGroup(req.user!.id, req.params.contactId, req.params.groupId);
  res.json({ success: true, data: { added: true } });
});

// DELETE /api/v1/contacts/:contactId/groups/:groupId
router.delete('/:contactId/groups/:groupId', authenticate, async (req: Request, res: Response) => {
  await contactsService.removeFromGroup(req.user!.id, req.params.contactId, req.params.groupId);
  res.json({ success: true, data: { removed: true } });
});

// GET /api/v1/contacts/:contactId/vcard
router.get('/:contactId/vcard', authenticate, async (req: Request, res: Response) => {
  const vcard = await contactsService.exportVCard(req.user!.id, req.params.contactId);
  res.setHeader('Content-Type', 'text/vcard');
  res.setHeader('Content-Disposition', `attachment; filename="contact.vcf"`);
  res.send(vcard);
});

// Skills directory (using user profile fields)
router.get('/skills', authenticate, async (req, res, next) => {
  try {
    const { skill } = req.query;
    // Search users by bio containing the skill keyword
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(skill ? { bio: { contains: skill as string, mode: 'insensitive' } } : {}),
      },
      select: { id: true, displayName: true, avatarUrl: true, bio: true, email: true },
      take: 50,
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// Distribution lists (using contact groups as distribution lists)
router.get('/distribution-lists', authenticate, async (req, res, next) => {
  try {
    const groups = await prisma.contactGroup.findMany({
      where: { userId: req.user!.id },
      include: {
        members: {
          include: {
            contact: {
              include: { emails: true },
            },
          },
        },
      },
    });
    res.json({ success: true, data: groups });
  } catch (err) { next(err); }
});

// Contact suggestions (people you interact with but haven't added)
router.get('/suggestions', authenticate, async (req, res, next) => {
  try {
    // Find users you've exchanged emails with but aren't in contacts
    const existingContactUserIds = await prisma.contact.findMany({
      where: { userId: req.user!.id, internalUserId: { not: null } },
      select: { internalUserId: true },
    });
    const excludeIds = new Set([req.user!.id, ...existingContactUserIds.map(c => c.internalUserId!).filter(Boolean)]);

    // Get workspace members as suggestions
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: { userId: { notIn: Array.from(excludeIds) } },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true, email: true, bio: true } } },
      take: 20,
    });

    const suggestions = workspaceMembers.map(m => m.user);
    const uniqueSuggestions = Array.from(new Map(suggestions.map(s => [s.id, s])).values());

    res.json({ success: true, data: uniqueSuggestions });
  } catch (err) { next(err); }
});

// Relationship insights
router.get('/:contactId/insights', authenticate, async (req, res, next) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.contactId },
      include: { emails: true },
    });
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });

    const contactEmailAddrs = contact.emails.map(e => e.email.toLowerCase());

    // Last email exchange
    const lastEmail = await prisma.email.findFirst({
      where: {
        userId: req.user!.id,
        OR: [
          { fromAddress: { in: contactEmailAddrs } },
          { toAddresses: { array_contains: contactEmailAddrs } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { subject: true, createdAt: true },
    });

    // Upcoming meetings together
    const upcomingMeetings = contact.internalUserId ? await prisma.calendarEvent.findMany({
      where: {
        startAt: { gte: new Date() },
        attendees: { some: { userId: contact.internalUserId } },
        calendar: { userId: req.user!.id },
      },
      take: 5,
      orderBy: { startAt: 'asc' },
      select: { title: true, startAt: true },
    }) : [];

    res.json({ success: true, data: { lastEmail, upcomingMeetings } });
  } catch (err) { next(err); }
});

// Organization chart
router.get('/org-chart', authenticate, async (req, res, next) => {
  try {
    // Return all users with their relationships
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        bio: true, // Could contain "Reports to: ..." or title
      },
      orderBy: { displayName: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

export default router;
