import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authService } from './auth.service';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rate-limit';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setup2FASchema,
} from './auth.schema';
import { config } from '../../config';
import fs from 'fs';

const router = Router();

// Avatar upload config
const avatarDir = path.resolve(config.storage.path, 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: config.storage.maxAvatarSize },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// POST /api/v1/auth/register
router.post('/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.cookie('token', result.accessToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.status(201).json({ success: true, data: result });
});

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  const maxAge = req.body.rememberMe
    ? 30 * 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;
  res.cookie('token', result.accessToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge,
  });
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshToken(refreshToken);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.substring(7) || req.cookies?.token;
  await authService.logout(req.user!.id, token);
  res.clearCookie('token');
  res.json({ success: true, data: { message: 'Logged out' } });
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const profile = await authService.getProfile(req.user!.id);
  res.json({ success: true, data: profile });
});

// PATCH /api/v1/auth/profile
router.patch('/profile', authenticate, validate(updateProfileSchema), async (req: Request, res: Response) => {
  const user = await authService.updateProfile(req.user!.id, req.body);
  res.json({ success: true, data: user });
});

// POST /api/v1/auth/avatar
router.post('/avatar', authenticate, avatarUpload.single('avatar'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }
  const avatarUrl = `/storage/avatars/${req.file.filename}`;
  const user = await authService.updateAvatar(req.user!.id, avatarUrl);
  res.json({ success: true, data: user });
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response) => {
  await authService.changePassword(req.user!.id, req.body);
  res.json({ success: true, data: { message: 'Password changed' } });
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  res.json({ success: true, data: { message: 'If that email exists, a reset link has been sent' } });
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, data: { message: 'Password reset successful' } });
});

// POST /api/v1/auth/2fa/setup
router.post('/2fa/setup', authenticate, async (req: Request, res: Response) => {
  const result = await authService.setup2FA(req.user!.id);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/2fa/verify
router.post('/2fa/verify', authenticate, validate(setup2FASchema), async (req: Request, res: Response) => {
  const result = await authService.verify2FA(req.user!.id, req.body.totpCode);
  res.json({ success: true, data: result });
});

// POST /api/v1/auth/2fa/disable
router.post('/2fa/disable', authenticate, validate(setup2FASchema), async (req: Request, res: Response) => {
  const result = await authService.disable2FA(req.user!.id, req.body.totpCode);
  res.json({ success: true, data: result });
});

// GET /api/v1/auth/sessions
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  const sessions = await authService.getSessions(req.user!.id);
  res.json({ success: true, data: sessions });
});

// DELETE /api/v1/auth/sessions/:sessionId
router.delete('/sessions/:sessionId', authenticate, async (req: Request, res: Response) => {
  await authService.revokeSession(req.user!.id, req.params.sessionId);
  res.json({ success: true, data: { message: 'Session revoked' } });
});

// GET /api/v1/auth/users — search users
router.get('/users', authenticate, async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const users = await authService.getUsers(search);
  res.json({ success: true, data: users });
});

export default router;
