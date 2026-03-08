import { Router, Request, Response } from 'express';
import { videoEditorService } from './video-editor.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  createExportJobSchema,
} from './video-editor.schema';

const router = Router();

// ==========================================
// PROJECT ROUTES
// ==========================================

// GET /api/v1/video-editor/projects
router.get('/projects', authenticate, async (req: Request, res: Response) => {
  const projects = await videoEditorService.getProjects(req.user!.id);
  res.json({ success: true, data: projects });
});

// POST /api/v1/video-editor/projects
router.post('/projects', authenticate, validate(createProjectSchema), async (req: Request, res: Response) => {
  const project = await videoEditorService.createProject(req.user!.id, req.body);
  res.status(201).json({ success: true, data: project });
});

// GET /api/v1/video-editor/projects/:projectId
router.get('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  const project = await videoEditorService.getProjectById(req.user!.id, req.params.projectId);
  res.json({ success: true, data: project });
});

// PATCH /api/v1/video-editor/projects/:projectId
router.patch('/projects/:projectId', authenticate, validate(updateProjectSchema), async (req: Request, res: Response) => {
  const project = await videoEditorService.updateProject(req.user!.id, req.params.projectId, req.body);
  res.json({ success: true, data: project });
});

// DELETE /api/v1/video-editor/projects/:projectId
router.delete('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  await videoEditorService.deleteProject(req.user!.id, req.params.projectId);
  res.json({ success: true, data: { message: 'Video project deleted' } });
});

// ==========================================
// EXPORT JOB ROUTES
// ==========================================

// GET /api/v1/video-editor/projects/:projectId/exports
router.get('/projects/:projectId/exports', authenticate, async (req: Request, res: Response) => {
  const exportJobs = await videoEditorService.getExportJobs(req.user!.id, req.params.projectId);
  res.json({ success: true, data: exportJobs });
});

// POST /api/v1/video-editor/projects/:projectId/exports
router.post('/projects/:projectId/exports', authenticate, validate(createExportJobSchema), async (req: Request, res: Response) => {
  const exportJob = await videoEditorService.createExportJob(req.user!.id, req.params.projectId, req.body);
  res.status(201).json({ success: true, data: exportJob });
});

// GET /api/v1/video-editor/projects/:projectId/exports/:jobId
router.get('/projects/:projectId/exports/:jobId', authenticate, async (req: Request, res: Response) => {
  const exportJob = await videoEditorService.getExportJob(req.user!.id, req.params.projectId, req.params.jobId);
  res.json({ success: true, data: exportJob });
});

export default router;
