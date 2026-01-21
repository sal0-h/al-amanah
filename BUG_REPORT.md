# Bug Report - Al-Amanah Codebase

**Last Updated**: January 21, 2026  
**Status**: Flagged for Future Resolution  
**Total Issues**: 20 (3 Critical, 5 High, 7 Medium, 5 Low)

## Critical Bugs (Fix ASAP)

### 1. Race Condition in Auto Reminder Scheduling
- **File**: `backend/app/services/scheduler.py`
- **Severity**: CRITICAL
- **Description**: The `auto_reminder_sent` flag is set after webhook completes, but without transaction isolation. In multi-worker deployments, two instances could both send reminders before either updates the flag, causing duplicate notifications.
- **Impact**: Users receive duplicate task reminders
- **Fix**: Use database-level transaction locking or unique constraint on reminder timestamp

### 2. Datetime Timezone Mismatch in Scheduler
- **File**: `backend/app/services/scheduler.py:23-26`
- **Severity**: CRITICAL
- **Description**: Scheduler uses timezone-aware comparison (`datetime.now(QATAR_TZ)`) but if Event datetimes are stored as naive datetimes, the comparison silently fails. Reminders may never send or send at wrong times.
- **Impact**: Task reminders don't trigger
- **Fix**: Ensure all Event datetimes are stored with timezone info; validate in model

### 3. Partial Import Corruption in Export/Import
- **File**: `backend/app/routers/export.py:227-260`
- **Severity**: CRITICAL
- **Description**: Import creates semesters → weeks → events → tasks with intermediate flushes. If any task fails to create, previous data is committed but import appears failed. Leaves corrupted partial data in database.
- **Impact**: Database inconsistency, orphaned data
- **Fix**: Wrap entire import in single transaction with rollback on any error

---

## High Severity Bugs (Fix Before Production)

### 4. Missing Input Validation on Discord IDs
- **File**: `backend/app/routers/users.py:113`
- **Severity**: HIGH
- **Description**: Discord IDs accepted as any string without validation. Discord IDs must be 18 digits. Invalid IDs fail silently when webhooks try to mention them (`<@invalid>` doesn't work).
- **Impact**: Users not notified even though system thinks they were
- **Fix**: Add regex validation: `^\d{18}$` for Discord IDs

### 5. Permission Tracking Loss in Task Completion
- **File**: `backend/app/routers/tasks.py:133, 162`
- **Severity**: HIGH
- **Description**: `completed_by` is set to the current user, but admins can complete tasks on behalf of members. Audit logs show member did work when admin triggered it. Violates accountability.
- **Impact**: Audit trail conflates admin actions with member actions
- **Fix**: Add separate `trigger_user_id` field to track who initiated the action

### 6. Session Cookie Security Gap
- **File**: `backend/app/middleware/auth.py:53-60`
- **Severity**: HIGH
- **Description**: `secure` flag on session cookie depends on `HTTPS_ONLY` environment variable. During development it's `False`. No SameSite policy documented. On unencrypted networks, session hijacking is possible.
- **Impact**: Session cookie vulnerable to theft on WiFi networks
- **Fix**: Always set `secure=True` and `samesite='Lax'` in production; add CSRF token

### 7. N+1 Query Problem in Dashboard
- **File**: `backend/app/routers/dashboard.py:95-120`
- **Severity**: HIGH
- **Description**: For each task, separate queries fetch User (assignee), Team, and completer. With 100 tasks = 300+ queries. Should use `.joinedload()` or `.selectinload()`.
- **Impact**: Dashboard loads in 10+ seconds for large semesters
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

### 8. Race Condition in Semester Activation
- **File**: `backend/app/routers/semesters.py:34-37`
- **Severity**: MEDIUM
- **Description**: When updating semester to active, code deactivates all others THEN updates new one. Brief window where NO semester is active. Dashboard shows empty if accessed during this window.
- **Impact**: Brief data inconsistency window
- **Fix**: Use single transaction with UPDATE ... WHERE clause

### 9. Unhandled Promise Rejection in Frontend
- **File**: `frontend/src/pages/Dashboard.tsx:41`
- **Severity**: MEDIUM
- **Description**: Error handling swallows error details. No error boundary or error logging service. Production errors invisible.
- **Impact**: Difficult to debug production issues
- **Fix**: Add error boundary component + Sentry integration

### 10. Silent Failure on Missing Teams in Templates
- **File**: `backend/app/routers/templates.py:287`
- **Severity**: MEDIUM
- **Description**: If a team name in template doesn't exist, task is created UNASSIGNED instead of failing. User thinks it's team-assigned but it's not.
- **Impact**: Tasks silently lose their team assignments
- **Fix**: Return 400 error if any team not found during template creation

### 11. Missing Timeout & Retry on Discord Webhooks
- **File**: `backend/app/services/discord.py:24`
- **Severity**: MEDIUM
- **Description**: Webhook has 10s timeout but no retry logic. If Discord slow, blocks entire scheduler. Multiple reminders queue = 1000s of blocking.
- **Impact**: Scheduler hangs under slow Discord conditions
- **Fix**: Add exponential backoff retry + configurable timeout

### 12. Type Mismatch in Discord ID Storage
- **File**: `backend/app/models/user.py`
- **Severity**: MEDIUM
- **Description**: Discord IDs stored as `String(20)` but must be 18 digits exactly. No validation. Frontend batch import doesn't validate.
- **Impact**: Invalid Discord IDs silently fail in notifications
- **Fix**: Use `String(18)` and add `Annotated[str, StringConstraints(min_length=18, max_length=18, pattern=r'^\d+$')]`

### 13. Inconsistent Week Boundary Semantics
- **File**: `backend/app/routers/weeks.py:582-584`
- **Severity**: MEDIUM  
- **Description**: Week end_date calculated as `start_date + 6 days`. Comments are misleading about inclusion. Users confused whether Sunday is included.
- **Impact**: User confusion about week boundaries
- **Fix**: Add explicit comment + consider using ISO week standards

### 14. Logging Injection Vulnerability
- **File**: `backend/app/services/audit.py:64`
- **Severity**: MEDIUM
- **Description**: Task titles directly interpolated into logs: `f"Task '{task.title}'..."`. Titles with newlines/special chars break log parsing.
- **Impact**: Log injection could hide errors or create false audit entries
- **Fix**: Use structured logging with separate fields

---

## Low Severity Bugs (Fix When Refactoring)

### 15. Fragile Datetime String Slicing
- **File**: `frontend/src/pages/AdminPanel.tsx:1025`
- **Severity**: LOW
- **Description**: `datetime.slice(0, 16)` assumes ISO 8601 format. If server returns different format, breaks. Should use proper date parsing.
- **Impact**: Fragile to format changes
- **Fix**: Use `new Date().toISOString()` and proper parsing

### 16. Unused Rollback in Error Handling
- **File**: `backend/app/routers/export.py:248`
- **Severity**: LOW
- **Description**: Redundant `db.rollback()` after exception. SQLAlchemy already handles this. Ineffective pattern.
- **Impact**: None, cosmetic
- **Fix**: Remove redundant rollback

### 17. Missing Cascade Delete Audit
- **File**: `backend/app/models/task_assignment.py:11`
- **Severity**: LOW
- **Description**: When user deleted, TaskAssignments cascade-deleted without audit log. History lost.
- **Impact**: No audit trail for user deletions
- **Fix**: Add ON DELETE hook to log cascade deletions

### 18. Potential Session Leak in Scheduler
- **File**: `backend/app/services/scheduler.py:49-52`
- **Severity**: LOW
- **Description**: Database session may remain open if exception during query. Long-running scheduler could accumulate open connections under error conditions.
- **Impact**: Connection pool exhaustion during errors
- **Fix**: Ensure `finally` block always closes session

### 19. Inconsistent Batch Import Error Handling
- **File**: `backend/app/routers/users.py:124-131`
- **Severity**: LOW
- **Description**: Batch import catches all exceptions as strings, losing stack traces. Hard to debug in production.
- **Impact**: Difficult debugging
- **Fix**: Log full exception with traceback to separate log file

### 20. Overly Permissive CORS Configuration
- **File**: `backend/app/main.py:42`
- **Severity**: LOW
- **Description**: CORS allows any HTTPS origin. While Cloudflare enforces HTTPS, better to whitelist domains.
- **Impact**: Any HTTPS site can make requests (low risk due to session auth)
- **Fix**: Restrict to `https://yourdomain.com` (or use environment variable)

---

## Quick Fixes (Could be Done in 1-2 hours)

These are low-hanging fruit that don't require refactoring:

1. **Add Discord ID validation** - 15 minutes
2. **Add team existence check in templates** - 10 minutes
3. **Remove unused rollback** - 2 minutes
4. **Fix CORS configuration** - 5 minutes
5. **Improve error messages** - 20 minutes

---

## Architecture-Level Fixes (Requires Planning)

These require design changes:

1. **Fix scheduler race conditions** - Requires: Database locking OR Redis-based state management
2. **Fix N+1 queries** - Requires: Refactor dashboard query strategy
3. **Fix timezone issues** - Requires: Audit all datetime handling, enforce timezone-aware storage
4. **Add error boundary + Sentry** - Requires: Frontend architecture change
5. **Fix import transactions** - Requires: Restructure export/import logic

---

## Recommended Fix Priority

**Phase 1 (Critical - 2-3 hours)**
- [ ] Race condition in reminders (use database lock)
- [ ] Fix import transaction isolation
- [ ] Validate Discord IDs

**Phase 2 (High - 4-5 hours)**
- [ ] N+1 query dashboard optimization
- [ ] Add permission tracking (`trigger_user_id`)
- [ ] Improve session security

**Phase 3 (Medium - 3-4 hours)**
- [ ] Silent failure fixes (teams, error handling)
- [ ] Semester activation transaction fix
- [ ] Add error boundaries to frontend

**Phase 4 (Low - 1-2 hours)**
- [ ] Quick wins (CORS, validation, logging)
- [ ] Code cleanup and refactoring

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

