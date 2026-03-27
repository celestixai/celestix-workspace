import { Router, Request, Response } from 'express';
import { bookingsService } from './bookings.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createBookingPageSchema,
  updateBookingPageSchema,
  createServiceSchema,
  updateServiceSchema,
  bookAppointmentSchema,
  cancelAppointmentSchema,
} from './bookings.schema';

const router = Router();

// ─── Authenticated Routes ──────────────────────────────────────────

// GET /api/v1/bookings/pages — List my booking pages
router.get('/pages', authenticate, async (req: Request, res: Response) => {
  const pages = await bookingsService.getMyPages(req.user!.id);
  res.json({ success: true, data: pages });
});

// POST /api/v1/bookings/pages — Create booking page
router.post('/pages', authenticate, validate(createBookingPageSchema), async (req: Request, res: Response) => {
  const page = await bookingsService.createPage(req.user!.id, req.body);
  res.status(201).json({ success: true, data: page });
});

// PATCH /api/v1/bookings/pages/:pageId — Update page
router.patch('/pages/:pageId', authenticate, validate(updateBookingPageSchema), async (req: Request, res: Response) => {
  const page = await bookingsService.updatePage(req.params.pageId, req.user!.id, req.body);
  res.json({ success: true, data: page });
});

// DELETE /api/v1/bookings/pages/:pageId — Delete page
router.delete('/pages/:pageId', authenticate, async (req: Request, res: Response) => {
  await bookingsService.deletePage(req.params.pageId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/bookings/pages/:pageId/services — Add service
router.post('/pages/:pageId/services', authenticate, validate(createServiceSchema), async (req: Request, res: Response) => {
  const service = await bookingsService.addService(req.params.pageId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: service });
});

// PATCH /api/v1/bookings/services/:serviceId — Update service
router.patch('/services/:serviceId', authenticate, validate(updateServiceSchema), async (req: Request, res: Response) => {
  const service = await bookingsService.updateService(req.params.serviceId, req.user!.id, req.body);
  res.json({ success: true, data: service });
});

// DELETE /api/v1/bookings/services/:serviceId — Delete service
router.delete('/services/:serviceId', authenticate, async (req: Request, res: Response) => {
  await bookingsService.deleteService(req.params.serviceId, req.user!.id);
  res.json({ success: true, data: { deleted: true } });
});

// POST /api/v1/bookings/services/:serviceId/staff — Add staff
router.post('/services/:serviceId/staff', authenticate, async (req: Request, res: Response) => {
  const { staffUserId, schedule } = req.body;
  const staff = await bookingsService.addStaff(req.params.serviceId, req.user!.id, staffUserId, schedule);
  res.status(201).json({ success: true, data: staff });
});

// DELETE /api/v1/bookings/services/:serviceId/staff/:staffUserId — Remove staff
router.delete('/services/:serviceId/staff/:staffUserId', authenticate, async (req: Request, res: Response) => {
  await bookingsService.removeStaff(req.params.serviceId, req.user!.id, req.params.staffUserId);
  res.json({ success: true, data: { removed: true } });
});

// GET /api/v1/bookings/appointments — My appointments (as staff)
router.get('/appointments', authenticate, async (req: Request, res: Response) => {
  const appointments = await bookingsService.getMyAppointments(req.user!.id);
  res.json({ success: true, data: appointments });
});

// GET /api/v1/bookings/pages/:pageId/appointments — Page appointments (admin)
router.get('/pages/:pageId/appointments', authenticate, async (req: Request, res: Response) => {
  const appointments = await bookingsService.getPageAppointments(req.params.pageId, req.user!.id);
  res.json({ success: true, data: appointments });
});

// ─── Public Routes (no auth) ──────────────────────────────────────

// GET /api/v1/bookings/public/:slug — Get booking page by slug
router.get('/public/:slug', async (req: Request, res: Response) => {
  const page = await bookingsService.getPageBySlug(req.params.slug);
  res.json({ success: true, data: page });
});

// GET /api/v1/bookings/public/:slug/slots — Get available slots
router.get('/public/:slug/slots', async (req: Request, res: Response) => {
  const { serviceId, date } = req.query;
  if (!serviceId || !date) {
    res.status(400).json({ success: false, error: 'serviceId and date are required query parameters' });
    return;
  }
  const slots = await bookingsService.getAvailableSlots(
    req.params.slug,
    serviceId as string,
    date as string
  );
  res.json({ success: true, data: slots });
});

// POST /api/v1/bookings/public/:slug/book — Book appointment
router.post('/public/:slug/book', validate(bookAppointmentSchema), async (req: Request, res: Response) => {
  const appointment = await bookingsService.bookAppointment(req.body);
  res.status(201).json({ success: true, data: appointment });
});

// POST /api/v1/bookings/public/cancel — Cancel appointment
router.post('/public/cancel', validate(cancelAppointmentSchema), async (req: Request, res: Response) => {
  const appointment = await bookingsService.cancelAppointment(req.body.cancelToken);
  res.json({ success: true, data: appointment });
});

export default router;
