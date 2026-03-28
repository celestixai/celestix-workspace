# Infrastructure Fix Report

**Date:** 2026-03-28
**Build Status:** Clean (0 TypeScript errors)

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/src/config/supabase-storage.ts` | Supabase Storage client — upload, download, signed URLs, delete, list |
| `backend/src/config/email-provider.ts` | Resend email SDK — sendEmail(), isEmailConfigured() |

## Files Modified

| File | Changes |
|------|---------|
| `backend/package.json` | Added `@supabase/supabase-js`, `resend` |
| `backend/package-lock.json` | Lock file updated |
| `backend/src/index.ts` | Added `initStorage()` call on startup, `/storage/*` Supabase redirect middleware |
| `backend/src/modules/files/files.routes.ts` | Multer → memoryStorage when Supabase configured, upload to Supabase, download via signed URL redirect |
| `backend/src/modules/auth/auth.routes.ts` | Avatar upload → Supabase `avatars/{userId}/`, stores full URL |
| `backend/src/modules/clips/clips.routes.ts` | Clip upload → Supabase `clips/{userId}/`, stream via signed URL |
| `backend/src/modules/clips/clips.service.ts` | Added `getClipRaw()` for lightweight clip lookup |
| `backend/src/modules/email/email.service.ts` | Resend as primary email provider, SMTP as fallback |
| `backend/src/modules/meetings/meetings.routes.ts` | Added `GET /ice-servers` endpoint for TURN/STUN config |
| `backend/src/modules/ai/ai.service.ts` | Enhanced status with `baseUrl`, `note` fields |

---

## Fix 1: Supabase Storage (Files, Avatars, Clips)

### What changed
- All file uploads now go to Supabase Storage instead of Railway's ephemeral filesystem
- Multer switches to `memoryStorage` when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set
- Downloads redirect to Supabase signed URLs (1-hour expiry)
- `/storage/*` requests redirect to Supabase in production
- Full backward compatibility — falls back to disk storage when env vars are missing

### Storage paths
| Content | Supabase Path |
|---------|--------------|
| User files | `users/{userId}/{uuid}.{ext}` |
| Avatars | `avatars/{userId}/{uuid}.{ext}` |
| Clips | `clips/{userId}/{uuid}.{ext}` |

### Environment variables (Railway)
| Variable | Value | Status |
|----------|-------|--------|
| `SUPABASE_URL` | `https://ntltfmjjegduekfcecrv.supabase.co` | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | (service role JWT) | Already set |
| `SUPABASE_STORAGE_BUCKET` | `celestix-files` | Just set |

### Manual step required
**Create the `celestix-files` bucket in Supabase Dashboard:**
1. Go to https://supabase.com/dashboard → Project ntltfmjjegduekfcecrv
2. Storage → New Bucket → Name: `celestix-files`
3. Toggle **Public bucket** ON
4. Set file size limit: 500MB

---

## Fix 2: Resend Email

### What changed
- New `email-provider.ts` wraps the Resend SDK
- Email service now tries Resend first (if `RESEND_API_KEY` set), falls back to SMTP
- Internal delivery (between Celestix users) still skips external providers

### Environment variables needed
| Variable | Value | Status |
|----------|-------|--------|
| `RESEND_API_KEY` | `re_xxxxx` | **NEEDS SETUP** |
| `EMAIL_FROM` | `workspace@celestix.ai` | **NEEDS SETUP** |

### Manual steps required
1. Sign up at https://resend.com (free: 100 emails/day)
2. Create API Key → copy it
3. Add domain `celestix.ai` → configure DNS records they provide
4. Set `RESEND_API_KEY` and `EMAIL_FROM` in Railway env vars

---

## Fix 3: TURN Server for Video Calls

### What changed
- Added `GET /api/v1/meetings/ice-servers` endpoint
- Returns STUN config by default, plus TURN if env vars are set
- Frontend can fetch this before creating WebRTC peer connections

### Environment variables needed
| Variable | Value | Status |
|----------|-------|--------|
| `STUN_URL` | `stun:stun.l.google.com:19302` | Already in .env |
| `TURN_URL` | `turn:global.relay.metered.ca:443` | **NEEDS SETUP** |
| `TURN_USERNAME` | (from metered.ca) | **NEEDS SETUP** |
| `TURN_PASSWORD` | (from metered.ca) | **NEEDS SETUP** |

### Manual steps required
1. Sign up at https://metered.ca (free: 50GB/month)
2. Dashboard → TURN → Create Credential
3. Set `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` in Railway env vars

---

## Fix 4: AI via Cloudflare Tunnel

### What changed
- AI config already reads `AI_BASE_URL` from env (no code change needed)
- Enhanced AI status endpoint with `note` field for better error messages

### Environment variables needed
| Variable | Value | Status |
|----------|-------|--------|
| `AI_BASE_URL` | `https://xxx.trycloudflare.com/v1` | **NEEDS SETUP** |
| `AI_MODEL` | `llama3.1:8b` | Already set in .env |
| `AI_ENABLED` | `true` | **Set to true when tunnel is up** |

### Manual steps required
1. Install: `winget install Cloudflare.cloudflared`
2. Run locally: `ollama serve` (one terminal)
3. Run tunnel: `cloudflared tunnel --url http://localhost:11434` (another terminal)
4. Copy the `https://xxx.trycloudflare.com` URL
5. Set `AI_BASE_URL=https://xxx.trycloudflare.com/v1` and `AI_ENABLED=true` in Railway

---

## Deployment

### To deploy these changes:
```bash
cd C:/Users/emlok/celestix-workspace
git add backend/src/config/supabase-storage.ts backend/src/config/email-provider.ts
git add backend/src/index.ts backend/src/modules/files/files.routes.ts
git add backend/src/modules/auth/auth.routes.ts backend/src/modules/clips/clips.routes.ts
git add backend/src/modules/clips/clips.service.ts backend/src/modules/email/email.service.ts
git add backend/src/modules/meetings/meetings.routes.ts backend/src/modules/ai/ai.service.ts
git add backend/package.json backend/package-lock.json
git commit -m "feat: Supabase Storage, Resend email, TURN server, AI tunnel support"
git push origin main
```

Railway will auto-deploy from the push.

### Verification after deploy:
```bash
BASE=https://backend-production-d4ea.up.railway.app

# Health check
curl $BASE/api/health

# AI status
curl $BASE/api/v1/ai/status

# ICE servers
curl -H "Authorization: Bearer $TOKEN" $BASE/api/v1/meetings/ice-servers
```

---

## Summary

| Fix | Code Status | Env Vars | Manual Steps |
|-----|------------|----------|--------------|
| Supabase Storage | Done | Set | Create bucket in dashboard |
| Resend Email | Done | Needs API key | Sign up at resend.com |
| TURN Server | Done | Needs credentials | Sign up at metered.ca |
| AI Tunnel | Done (already worked) | Needs tunnel URL | Run cloudflared locally |
