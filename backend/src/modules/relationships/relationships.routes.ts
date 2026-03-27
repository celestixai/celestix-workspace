import { Router, Request, Response } from 'express';
import { relationshipsService } from './relationships.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createRelationshipSchema } from './relationships.validation';

const router = Router();

// POST /api/v1/tasks/:taskId/relationships — create relationship
router.post(
  '/:taskId/relationships',
  authenticate,
  validate(createRelationshipSchema),
  async (req: Request, res: Response) => {
    const rel = await relationshipsService.createRelationship(
      req.params.taskId,
      req.body.targetTaskId,
      req.body.type,
      req.user!.id,
    );
    res.status(201).json({ success: true, data: rel });
  },
);

// GET /api/v1/tasks/:taskId/relationships — get relationships (grouped)
router.get('/:taskId/relationships', authenticate, async (req: Request, res: Response) => {
  const relationships = await relationshipsService.getRelationships(req.params.taskId);
  res.json({ success: true, data: relationships });
});

// DELETE /api/v1/tasks/relationships/:relationshipId — delete relationship
router.delete(
  '/relationships/:relationshipId',
  authenticate,
  async (req: Request, res: Response) => {
    await relationshipsService.deleteRelationship(req.params.relationshipId, req.user!.id);
    res.json({ success: true, data: { message: 'Relationship deleted' } });
  },
);

// GET /api/v1/tasks/:taskId/dependency-warnings — check dependency warnings
router.get('/:taskId/dependency-warnings', authenticate, async (req: Request, res: Response) => {
  const warnings = await relationshipsService.getDependencyWarnings(req.params.taskId);
  res.json({ success: true, data: warnings });
});

export default router;
