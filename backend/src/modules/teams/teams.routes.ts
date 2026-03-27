import { Router, Request, Response } from 'express';
import { teamsService } from './teams.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createTeamSchema, updateTeamSchema, addMemberSchema } from './teams.validation';

const router = Router();

// GET /api/v1/teams/workspace/:workspaceId — list teams
router.get('/workspace/:workspaceId', authenticate, async (req: Request, res: Response) => {
  const teams = await teamsService.getTeams(req.params.workspaceId);
  res.json({ success: true, data: teams });
});

// POST /api/v1/teams — create team
router.post('/', authenticate, validate(createTeamSchema), async (req: Request, res: Response) => {
  const { workspaceId, ...data } = req.body;
  const team = await teamsService.createTeam(workspaceId || req.body.workspaceId, req.user!.id, data);
  res.status(201).json({ success: true, data: team });
});

// GET /api/v1/teams/:teamId — get team + members
router.get('/:teamId', authenticate, async (req: Request, res: Response) => {
  const team = await teamsService.getTeam(req.params.teamId);
  res.json({ success: true, data: team });
});

// PATCH /api/v1/teams/:teamId — update team
router.patch('/:teamId', authenticate, validate(updateTeamSchema), async (req: Request, res: Response) => {
  const team = await teamsService.updateTeam(req.params.teamId, req.body);
  res.json({ success: true, data: team });
});

// DELETE /api/v1/teams/:teamId — delete team
router.delete('/:teamId', authenticate, async (req: Request, res: Response) => {
  await teamsService.deleteTeam(req.params.teamId);
  res.json({ success: true, data: { message: 'Team deleted' } });
});

// POST /api/v1/teams/:teamId/members — add member
router.post('/:teamId/members', authenticate, validate(addMemberSchema), async (req: Request, res: Response) => {
  const member = await teamsService.addMember(req.params.teamId, req.body.userId, req.body.role);
  res.status(201).json({ success: true, data: member });
});

// DELETE /api/v1/teams/:teamId/members/:userId — remove member
router.delete('/:teamId/members/:userId', authenticate, async (req: Request, res: Response) => {
  await teamsService.removeMember(req.params.teamId, req.params.userId);
  res.json({ success: true, data: { message: 'Member removed' } });
});

export default router;
