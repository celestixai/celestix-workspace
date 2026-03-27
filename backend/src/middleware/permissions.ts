import { Request, Response, NextFunction } from 'express';
import { Permission, ResourceType } from '../modules/permissions/permissions.types';
import { permissionsService } from '../modules/permissions/permissions.service';

/**
 * Middleware factory that checks whether the authenticated user
 * has the required permission on the resource identified by a route param.
 *
 * Usage:
 *   router.delete('/:spaceId', authenticate, checkPermission(Permission.SPACE_DELETE, 'space', 'spaceId'), handler);
 */
export function checkPermission(
  permission: Permission,
  resourceType: ResourceType,
  paramName: string // e.g. 'spaceId', 'folderId', 'listId', 'taskId'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const resourceId = req.params[paramName];

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (!resourceId) {
      return res.status(400).json({ success: false, error: `Missing ${paramName}` });
    }

    try {
      await permissionsService.requirePermission(userId, permission, resourceType, resourceId);
      next();
    } catch (error) {
      next(error);
    }
  };
}
