# Bug Report - Al-Amanah Codebase

**Last Updated**: January 23, 2026  
**Status**: Flagged for Future Resolution  
**Total Issues**: 23 (1 Critical, 4 High, 9 Medium, 9 Low)
**Deployment Context**: Single server, Qatar timezone (+3), Week starts Sunday

## Critical Bugs (Fix ASAP)

### 1. Partial Import Corruption in Export/Import
- **File**: `backend/app/routers/export.py:227-295`
- **Severity**: CRITICAL
- **Description**: Import creates semesters → weeks → events → tasks with intermediate flushes. If any task fails to create (e.g., missing user/team), previous data is committed but import appears failed. Each semester is in its own try-catch but commits happen mid-semester, leaving partial data.
- **Impact**: Database inconsistency, orphaned weeks/events without tasks
- **Fix**: Wrap entire import in single transaction with rollback on any error; OR move commit to end of each semester block
- **Code Evidence**: Line 287 commits after each semester, but errors in tasks leave orphaned events

---

## High Severity Bugs (Fix Before Production)

### 2. Missing Input Validation on Discord IDs
- **File**: `backend/app/models/user.py:20`, `backend/app/routers/users.py`
- **Severity**: HIGH
- **Description**: Discord IDs accepted as `String(20)` without validation. Discord IDs must be exactly 18 digits. Invalid IDs fail silently when webhooks try to mention them (`<@invalid>` doesn't work). No regex validation on create/update.
- **Impact**: Users not notified even though system thinks they were
- **Fix**: Add regex validation: `^\d{18}$` in schema and model constraint

### 3. Permission Tracking Loss in Task Completion
- **File**: `backend/app/routers/tasks.py:133, 162`
- **Severity**: HIGH
- **Description**: `completed_by` is set to the current user, but admins can complete tasks on behalf of members. Audit logs show member did work when admin triggered it. Violates accountability.
- **Impact**: Audit trail conflates admin actions with member actions
- **Fix**: Add separate `triggered_by_admin_id` field to track who initiated the action

### 4. Session Cookie Missing Domain Attribute
- **File**: `backend/app/routers/auth.py:54`
- **Severity**: HIGH
- **Description**: Session cookie has `secure=settings.USE_HTTPS` and `samesite='lax'`, but no `domain` attribute. For subdomain deployment (e.g., tasks.cmuqmsa.org), cookie won't work across subdomains if needed. Also `USE_HTTPS` defaults to False - must be manually set True in production.
- **Impact**: Cookie configuration fragile; requires manual .env edit
- **Fix**: Auto-detect HTTPS from Cloudflare headers (cf-visitor); add domain config; warn if USE_HTTPS=False in production

### 5. N+1 Query Problem in Dashboard
- **File**: `backend/app/routers/dashboard.py:95-120`
- **Severity**: HIGH
- **Description**: For each task, separate queries fetch User (assignee), Team, and completer. With 100 tasks = 300+ queries. Should use `.joinedload()` or `.selectinload()`. Single server mitigates but still slow.
- **Impact**: Dashboard loads in 3-5 seconds for large semesters (tolerable but poor UX)
- **Fix**: Use SQLAlchemy eager loading:
  ```python
  tasks = db.query(Task).options(
    joinedload(Task.assigned_user),
    joinedload(Task.assigned_team),
    joinedload(Task.completed_user)
  ).all()
  ```

---

## Medium Severity Bugs (Fix Before 1.0 Release)

### 6. Unhandled Promise Rejection in Frontend
- **File**: `frontend/src/pages/Dashboard.tsx:30`, `frontend/src/pages/AdminPanel.tsx` (multiple locations)
- **Severity**: MEDIUM
- **Description**: Error handling logs to console but doesn't show user-friendly error messages. No error boundary or error logging service. Production errors invisible. Example: `catch (err) { console.error('Failed to load:', err); }` with no user feedback.
- **Impact**: Users see silent failures, difficult to debug production issues
- **Fix**: Add toast notification system + error boundary component + optional Sentry integration

### 7. Silent Failure on Missing Teams in Templates
- **File**: `backend/app/routers/templates.py:260`
- **Severity**: MEDIUM
- **Description**: If a team name in template doesn't exist, task is created with `assigned_team_id=None` instead of failing. User thinks it's team-assigned but it's not. Line 259-262 silently sets to None if team not found.
- **Impact**: Tasks silently lose their team assignments
- **Fix**: Return 400 error if any team not found during template creation OR collect missing teams and show warning

### 8. Missing Timeout & Retry on Discord Webhooks
- **File**: `backend/app/services/discord.py:24`
- **Severity**: MEDIUM
- **Description**: Webhook has 10s timeout but no retry logic. If Discord slow/down, notification fails permanently. Single server makes blocking less critical but still bad UX.
- **Impact**: Lost notifications during Discord outages
- **Fix**: Add exponential backoff retry (3 attempts) + async queue for resilience

### 9. Type Mismatch in Discord ID Storage
- **File**: `backend/app/models/user.py:20`
- **Severity**: MEDIUM
- **Description**: Discord IDs stored as `String(20)` but must be exactly 18 digits. No validation at model level. Frontend batch import doesn't validate. Allows `String(5)` or `String(25)` to be stored.
- **Impact**: Invalid Discord IDs silently fail in notifications
- **Fix**: Use `String(18)` with check constraint `LENGTH(discord_id) = 18 AND discord_id GLOB '[0-9]*'`

### 10. Inconsistent Week Boundary Semantics  
- **File**: `frontend/src/pages/AdminPanel.tsx:450-455`
- **Severity**: MEDIUM  
- **Description**: Week end_date calculated as `start_date + 6 days`. Comment says "Auto-calculated" but for Sunday start, this gives Sunday-Saturday (7 days inclusive). No documentation whether Sunday is week start or end. User clarified: week STARTS Sunday, so Sunday-Saturday is correct. But UI allows manual override, creating confusion.
- **Impact**: User confusion about week boundaries when manually editing
- **Fix**: Add explicit tooltip: "Week runs Sunday (start) to Saturday (end) - 7 days inclusive"

### 11. Logging Injection Vulnerability
- **File**: `backend/app/services/audit.py:64`
- **Severity**: MEDIUM
- **Description**: Task titles directly interpolated into logs: `f"Task '{task.title}'..."`. Titles with newlines/special chars break log parsing. Could inject fake log entries.
- **Impact**: Log injection could hide errors or create false audit entries
- **Fix**: Use structured logging with separate fields OR escape/sanitize strings

### 12. PWA Manifest Missing Critical Fields
- **File**: `frontend/public/manifest.webmanifest`
- **Severity**: MEDIUM
- **Description**: Missing `id`, `scope`, `orientation` fields. Icons claim `purpose: "any maskable"` but icons aren't actually maskable (no safe zone). iOS requires exact 180x180 apple-touch-icon but manifest only has 192x192.
- **Impact**: iOS icon may still not show; PWA install may behave inconsistently
- **Fix**: Add proper maskable icon with padding, add missing manifest fields, ensure 180x180 apple-touch-icon

### 13. Theme Reactivity Bug - Logo Not Updating
- **File**: `frontend/src/pages/Dashboard.tsx:73`, `Login.tsx:35`, `AdminPanel.tsx:28`
- **Severity**: MEDIUM
- **Description**: Logo source uses `theme === 'dark'` ternary, but if theme changes after mount, image src changes but browser may cache old image. No `key` prop to force remount.
- **Impact**: Logo doesn't update when toggling dark mode until hard refresh
- **Fix**: Add `key={theme}` to `<img>` tag to force remount on theme change

### 14. Missing CORS Preflight Cache
- **File**: `backend/app/main.py:42-58`
- **Severity**: MEDIUM
- **Description**: CORS middleware configured but no `max_age` for preflight caching. Every OPTIONS request hits server. With frequent API calls, generates unnecessary traffic.
- **Impact**: Performance degradation from repeated preflight requests
- **Fix**: Add `max_age=3600` to CORS config to cache preflight for 1 hour

---

## Low Severity Bugs (Fix When Refactoring)

### 15. Fragile Datetime String Slicing
- **File**: `frontend/src/pages/AdminPanel.tsx` (event forms)
- **Severity**: LOW
- **Description**: Datetime handling uses `.split('T')[0]` and similar patterns. Fragile to format changes. Should use proper date parsing.
- **Impact**: Fragile to format changes
- **Fix**: Use `new Date().toISOString()` and proper parsing libraries

### 16. Unused Rollback in Error Handling
- **File**: `backend/app/routers/export.py:290`
- **Severity**: LOW
- **Description**: Explicit `db.rollback()` after exception. SQLAlchemy already handles this automatically. Ineffective pattern.
- **Impact**: None, cosmetic
- **Fix**: Remove redundant rollback (or keep for documentation purposes)

### 17. Missing Cascade Delete Audit
- **File**: `backend/app/models/task_assignment.py`, `backend/app/models/comment.py`
- **Severity**: LOW
- **Description**: When user deleted, TaskAssignments and Comments cascade-deleted without audit log. History lost. No ON DELETE hook.
- **Impact**: No audit trail for cascade deletions
- **Fix**: Add SQLAlchemy event listener to log cascade deletions before they happen

### 18. Potential Session Leak in Scheduler
- **File**: `backend/app/services/scheduler.py:49-52`
- **Severity**: LOW
- **Description**: Database session created with `SessionLocal()` but exception handling uses `finally: db.close()`. Single server deployment makes this lower risk but good practice to ensure cleanup.
- **Impact**: Connection pool exhaustion during errors (unlikely with SQLite)
- **Fix**: Wrap in try-finally OR use context manager: `with SessionLocal() as db:`

### 19. Inconsistent Batch Import Error Handling
- **File**: `backend/app/routers/users.py:124-131`
- **Severity**: LOW
- **Description**: Batch import catches all exceptions as strings with `str(e)`, losing stack traces. Hard to debug in production.
- **Impact**: Difficult debugging
- **Fix**: Log full exception with traceback using `logging.exception()`

### 20. No Input Sanitization on User Display Names
- **File**: `backend/app/routers/users.py`, `backend/app/models/user.py:19`
- **Severity**: LOW
- **Description**: Display names allow any string up to 100 chars. No sanitization of HTML/script tags. While not directly injectable (React escapes), could cause XSS if display name rendered unsafely elsewhere.
- **Impact**: Potential XSS if display name rendered in unsafe context
- **Fix**: Strip HTML tags from display names OR validate against safe character set

### 21. Missing Week Number Uniqueness Validation in Frontend
- **File**: `frontend/src/pages/AdminPanel.tsx:445-492` (WeekForm)
- **Severity**: LOW
- **Description**: Frontend allows duplicate week numbers. Backend catches it (line 51 in weeks.py) but user sees generic error. Should validate client-side.
- **Impact**: Poor UX - cryptic error message
- **Fix**: Check existing weeks before submit and show friendly message

### 22. Hardcoded Qatar Timezone in Scheduler
- **File**: `backend/app/services/scheduler.py:19`
- **Severity**: LOW
- **Description**: `QATAR_TZ = ZoneInfo("Asia/Qatar")` is hardcoded. If deployed elsewhere, reminders send at wrong times. Should be configurable.
- **Impact**: Wrong reminder times if deployed outside Qatar (not a current concern)
- **Fix**: Add `TIMEZONE` to config.py with default "Asia/Qatar"

### 23. No Pagination on Audit Logs API
- **File**: `backend/app/routers/audit.py`
- **Severity**: LOW
- **Description**: Audit log endpoint has `page`/`per_page` params but returns ALL matching logs if not specified. With 10k+ logs, this could timeout.
- **Impact**: Slow audit log page with large datasets (currently okay)
- **Fix**: Enforce default pagination (e.g., max 100 per page)

---

## Bugs Resolved or Not Applicable (Based on Current Deployment)

### ~~Race Condition in Auto Reminder Scheduling~~ - **NOT APPLICABLE**
- **Reason**: Single server deployment eliminates race conditions. No multi-worker setup.
- **Status**: No fix needed for current architecture

### ~~Race Condition in Semester Activation~~ - **NOT APPLICABLE**  
- **Reason**: Single server means no concurrent requests to activate semesters simultaneously
- **Status**: No fix needed; brief window is imperceptible to single user

### ~~Datetime Timezone Mismatch in Scheduler~~ - **VERIFIED CORRECT**
- **File**: `backend/app/models/event.py:12`
- **Status**: Event model uses `DateTime(timezone=True)`, scheduler uses `QATAR_TZ = ZoneInfo("Asia/Qatar")`. Properly configured for Qatar +3 timezone.
- **No action needed**

### ~~Overly Permissive CORS~~ - **ACCEPTABLE FOR CURRENT SETUP**
- **Reason**: Cloudflare tunnel enforces HTTPS; session-based auth (not bearer tokens) provides CSRF protection
- **Status**: Low risk with current architecture; can restrict to domain later if needed

---

## Quick Wins (Can be done in 1-2 hours)

These are low-hanging fruit that don't require refactoring:

1. **Add Discord ID validation** (schema + model) - 20 minutes  
2. **Add team existence check in templates** - 15 minutes  
3. **Fix logo reactivity with key prop** - 5 minutes  
4. **Add PWA manifest missing fields** - 15 minutes  
5. **Add CORS preflight caching** - 5 minutes  
6. **Fix week boundary tooltip** - 5 minutes
7. **Add toast notification for errors** - 30 minutes (using existing alert pattern)
8. **Remove unused rollback** - 2 minutes

**Total estimated time**: ~1.5 hours for all quick wins

---

## Architecture-Level Fixes (Requires Planning)

These require design changes:

1. **Fix import transactions** - Requires: Refactor to single transaction OR per-semester commits with proper error handling (30 mins)
2. **Fix N+1 queries** - Requires: Refactor dashboard query strategy with eager loading (45 mins)  
3. **Add error boundary + toast system** - Requires: Frontend architecture change for notification system (2 hours)
4. **Permission tracking enhancement** - Requires: Database migration to add triggered_by field (45 mins)
5. **Structured logging** - Requires: Switch to logging library with JSON output (1 hour)

---

## Recommended Fix Priority

**Phase 1 (Critical - 1 hour)**
- [ ] Fix import transaction isolation (wrap each semester in try-commit-rollback)
- [ ] Validate Discord IDs (model + schema)
- [ ] Add team validation in templates

**Phase 2 (High - 2 hours)**
- [ ] N+1 query dashboard optimization (eager loading)
- [ ] Auto-detect HTTPS from Cloudflare headers
- [ ] Add toast notification system for errors

**Phase 3 (Medium - 2 hours)**
- [ ] Add PWA manifest fields and proper maskable icons
- [ ] Fix logo theme reactivity (key prop)
- [ ] Add CORS preflight caching
- [ ] Structured logging for audit/task events

**Phase 4 (Low - 1 hour)**
- [ ] Quick wins (tooltips, sanitization, pagination defaults)
- [ ] Code cleanup (unused rollback, etc.)

**Total estimated time for all phases**: ~6 hours

---

## Testing Recommendations

After fixes:
- [ ] Add stress test for scheduler (simulate duplicate reminders)
- [ ] Add test for import with missing teams
- [ ] Add test for datetime timezone handling
- [ ] Add test for Discord ID validation
- [ ] Load test dashboard with 1000+ tasks
- [ ] Test session security (no HttpOnly without secure flag in production)

---

## Notes for Maintainers

- **No data loss** has occurred yet from these bugs (location removal completed safely)
- **All bugs are fixable** without major architecture changes
- **Most are defensive** (better error handling, validation)
- **Scheduler and Import bugs** are the most critical - fix first
- **N+1 query is performance** not correctness - noticeable but not breaking
- **Run tests** after any fixes - test suite is comprehensive (173 tests)

