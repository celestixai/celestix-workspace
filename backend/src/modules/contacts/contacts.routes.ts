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

export default router;
