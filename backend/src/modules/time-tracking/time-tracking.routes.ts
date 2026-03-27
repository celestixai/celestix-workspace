import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { timeTrackingService } from './time-tracking.service';
import {
  reportQuerySchema,
  timesheetQuerySchema,
  timesheetEntrySchema,
  timesheetEntryUpdateSchema,
  billableRatesSchema,
} from './time-tracking.validation';

const router = Router();

// ==========================================
// REPORTS
// ==========================================

// GET /api/v1/time-tracking/report
router.get('/report', authenticate, validate(reportQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { startDate, endDate, groupBy } = req.query as any;
  const report = await timeTrackingService.getReport(req.user!.id, startDate, endDate, groupBy);
  res.json({ success: true, data: report });
});

// GET /api/v1/time-tracking/report/summary
router.get('/report/summary', authenticate, validate(reportQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as any;
  const summary = await timeTrackingService.getReportSummary(req.user!.id, startDate, endDate);
  res.json({ success: true, data: summary });
});

// GET /api/v1/time-tracking/report/detailed
router.get('/report/detailed', authenticate, validate(reportQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as any;
  const entries = await timeTrackingService.getDetailedReport(req.user!.id, startDate, endDate);
  res.json({ success: true, data: entries });
});

// GET /api/v1/time-tracking/report/export
router.get('/report/export', authenticate, validate(reportQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as any;
  const csv = await timeTrackingService.exportReport(req.user!.id, startDate, endDate, 'csv');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="time-report-${startDate}-${endDate}.csv"`);
  res.send(csv);
});

// GET /api/v1/time-tracking/report/billing
router.get('/report/billing', authenticate, validate(reportQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as any;
  const billing = await timeTrackingService.getBillingReport(req.user!.id, startDate, endDate);
  res.json({ success: true, data: billing });
});

// ==========================================
// TIMESHEET
// ==========================================

// GET /api/v1/time-tracking/timesheet
router.get('/timesheet', authenticate, validate(timesheetQuerySchema, 'query'), async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || req.user!.id;
  const weekStart = req.query.weekStart as string;
  const timesheet = await timeTrackingService.getTimesheet(userId, weekStart);
  res.json({ success: true, data: timesheet });
});

// POST /api/v1/time-tracking/timesheet/entry
router.post('/timesheet/entry', authenticate, validate(timesheetEntrySchema), async (req: Request, res: Response) => {
  const { taskId, date, minutes, note, isBillable } = req.body;
  const entry = await timeTrackingService.addTimesheetEntry(req.user!.id, date, taskId, minutes, note, isBillable);
  res.status(201).json({ success: true, data: entry });
});

// PATCH /api/v1/time-tracking/timesheet/entry/:entryId
router.patch('/timesheet/entry/:entryId', authenticate, validate(timesheetEntryUpdateSchema), async (req: Request, res: Response) => {
  const { minutes, note } = req.body;
  const entry = await timeTrackingService.updateTimesheetEntry(req.params.entryId, minutes, note);
  res.json({ success: true, data: entry });
});

// ==========================================
// BILLING SETTINGS
// ==========================================

// PUT /api/v1/time-tracking/settings/billable-rates
router.put('/settings/billable-rates', authenticate, validate(billableRatesSchema), async (req: Request, res: Response) => {
  const { workspaceId, defaultRate, userRates } = req.body;
  const rates = await timeTrackingService.setBillableRates(workspaceId || 'default', defaultRate, userRates);
  res.json({ success: true, data: rates });
});

export default router;
