# Edu-RPG Implementation Plan

## Completed Changes

### 1. Calendar Icon Fix
- **File**: `css/style.css`
- Added `input[type="date"]::-webkit-calendar-picker-indicator` with `filter: invert(0.8)` to brighten the native date picker icon on the dark theme.

### 2. Value Stamp Milestone Notifications
When a student accumulates every 10 approved stamps of the same value type, a milestone notification fires.

**Database** (`supabase-setup.sql`):
- `notifications` table: `recipient_id`, `student_id`, `value_type_name`, `milestone_level`, `message`, `status` (sent/read)
- RLS: users read/update their own, admin reads all, logged-in users can insert

**Milestone logic** (`js/notifications.js`):
- `checkMilestones(studentId, studentName)` — counts all approved stamps per value type (using `count` field), checks for 10-stamp milestones, inserts 2 notification records (student + admin) per milestone, skips duplicates
- Called from: `approveEntry()`, `saveEdit()`, `approveAll()` in `admin-approval.js`, and `submitAdminEntry()` in `admin-students.js`

**Notification bell UI** (`js/notifications.js` + all HTML pages):
- Bell icon with unread count badge in navbar on all pages
- Dropdown panel shows notifications with timestamp
- "읽음" button marks as read
- Initialized via `auth.js` → `initNotificationBell()` after successful auth

### 3. Assignments (과제) Feature
Students can input the number of assignments completed. Each assignment = 5% XP.

**Database** (`supabase-setup.sql`):
- `assignments INTEGER NOT NULL DEFAULT 0` in `daily_entries`

### 4. Writing Type Label Rename
- "5줄" → "감사 일기" (5%)
- "10줄" → "주제 글쓰기" (10%)
- DB values unchanged (`'5%'` / `'10%'`)

### 5. Multiple Titles (up to 5)
Students can enter up to 5 titles per daily entry (each worth 20% XP).

### 6. Admin Page Split + Flexible Penalties + XP Caching + Stamp Counts
Major refactor splitting admin functionality and adding several features.

**Admin page split**:
- `admin-students.html` / `js/admin-students.js` — New page for student management (list, detail, entry add, penalty). Main admin landing page after login.
- `admin.html` / `js/admin.js` — Stripped to settings only (value type + penalty type management)
- `admin-approval.html` — Updated with nav links to both pages

**Flexible penalty types** (replaces `is_lateness`/`is_rebel` booleans):
- 3 penalty categories: 일반 (flat %), 비율형 (rate-based %), 초기화 (full XP reset)
- `penalty_types` table: `is_reset`, `is_rate`, `rate_unit`, `rate_unit_count` columns
- Admin settings form uses type selector dropdown instead of checkboxes

**Multi-penalty application** (`admin-students.html`):
- Dynamic rows: each row has penalty type dropdown + count + rate-unit input (conditional) + note
- "+" button adds rows, "삭제" removes rows
- Live preview sums all rows' deductions
- Each row stored as single DB row with `count` field

**XP caching** (`profiles.total_xp`):
- `recalculateAndSaveXP(studentId)` function computes total XP and writes to `profiles.total_xp`
- Called after: approve, reject, approveAll, saveEdit, admin add entry, penalty apply
- Student list reads from `profiles.total_xp` (no per-student XP queries)
- Duplicated in `admin-approval.js` and `admin-students.js` (no module system)

**Stamp counts** (`entry_value_stamps.count`):
- Student input: checkbox + number input per stamp type
- XP calculation: `points × count` everywhere
- Display: shows `x{count}` label when count > 1
- Milestone counting: uses `+(s.count || 1)` instead of `+1`

**Navigation changes**:
- Admin login redirects to `admin-students.html` (auth.js)
- All admin pages have consistent navbar with links to: 학생 관리, 관리 설정, 승인 관리, 로그아웃

## Migration SQL (for existing databases)

Run these in Supabase SQL Editor:
```sql
-- 1. profiles: add total_xp
ALTER TABLE profiles ADD COLUMN total_xp INTEGER NOT NULL DEFAULT 0;

-- 2. penalty_types: replace is_lateness/is_rebel with flexible type system
ALTER TABLE penalty_types ADD COLUMN is_reset BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE penalty_types ADD COLUMN is_rate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE penalty_types ADD COLUMN rate_unit TEXT;
ALTER TABLE penalty_types ADD COLUMN rate_unit_count INTEGER;
UPDATE penalty_types SET is_reset = true WHERE is_rebel = true;
UPDATE penalty_types SET is_rate = true, rate_unit = '분', rate_unit_count = 10 WHERE is_lateness = true;
ALTER TABLE penalty_types DROP COLUMN is_lateness;
ALTER TABLE penalty_types DROP COLUMN is_rebel;

-- 3. penalties: add count + student_name
ALTER TABLE penalties ADD COLUMN count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE penalties ADD COLUMN student_name TEXT;
UPDATE penalties p SET student_name = pr.name FROM profiles pr WHERE p.student_id = pr.id;

-- 4. entry_value_stamps: add count
ALTER TABLE entry_value_stamps ADD COLUMN count INTEGER NOT NULL DEFAULT 1;

-- 5. profiles RLS: allow admin to update any profile (for total_xp sync)
DROP POLICY "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid() OR is_admin());
```

After migration, deploy updated files and use the XP sync button (or manually recalculate) to backfill `total_xp` for existing students.

## File Change Summary (Refactor #6)
| File | Change |
|------|--------|
| `supabase-setup.sql` | New columns, updated CREATE TABLEs, migration SQL |
| `admin-students.html` | **New**: student management page |
| `js/admin-students.js` | **New**: student list, detail, entry add, multi-penalty, XP recalc |
| `admin.html` | Removed student section, updated penalty type form |
| `js/admin.js` | Removed student functions, new penalty type form logic |
| `admin-approval.html` | Updated nav links, stamp count in edit modal |
| `js/admin-approval.js` | Added `recalculateAndSaveXP`, stamp counts in display/edit |
| `js/notifications.js` | Stamp count in milestone calculation |
| `student-input.html` | Stamp count inputs |
| `js/student-input.js` | Stamp count in form, preview, submit |
| `js/student.js` | Stamp count in progress display |
| `js/auth.js` | Admin redirect → `admin-students.html` |
| `css/style.css` | `.stamp-count-item`, `.penalty-row-item` styles |
| `CLAUDE.md` | Updated to reflect all changes |
