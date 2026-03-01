# Edu-RPG Implementation Plan

## Completed Changes

### 1. Calendar Icon Fix
- **File**: `css/style.css`
- Added `input[type="date"]::-webkit-calendar-picker-indicator` with `filter: invert(0.8)` to brighten the native date picker icon on the dark theme.

### 2. Value Stamp Milestone Notifications
When a student accumulates every 10 approved stamps of the same value type, a milestone notification fires.

**Database** (`supabase-setup.sql`):
- New `notifications` table: `recipient_id`, `student_id`, `value_type_name`, `milestone_level`, `message`, `status` (sent/read)
- RLS: users read/update their own, admin reads all, logged-in users can insert

**Milestone logic** (`js/notifications.js`):
- `checkMilestones(studentId, studentName)` — counts all approved stamps per value type, checks for 10-stamp milestones, inserts 2 notification records (student + admin) per milestone, skips duplicates
- Called from: `approveEntry()`, `saveEdit()`, `approveAll()` in `admin-approval.js`, and `submitAdminEntry()` in `admin.js`

**Notification bell UI** (`js/notifications.js` + all HTML pages):
- Bell icon with unread count badge in navbar on all pages
- Dropdown panel shows notifications with timestamp
- "읽음" button marks as read
- Initialized via `auth.js` → `initNotificationBell()` after successful auth

### 3. Assignments (과제) Feature
Students can input the number of assignments completed. Each assignment = 5% XP.

**Database** (`supabase-setup.sql`):
- Added `assignments INTEGER NOT NULL DEFAULT 0` to `daily_entries`

**Files modified**:
- `student-input.html` / `js/student-input.js` — number input, XP preview, DB insert
- `student.html` / `js/student.js` — "과제" column in progress table
- `admin-approval.html` / `js/admin-approval.js` — shown in approval cards, edit modal includes assignments field
- `admin.html` / `js/admin.js` — admin entry form, student detail table, XP calculation

**Migration SQL** (run on existing DB):
```sql
ALTER TABLE daily_entries ADD COLUMN assignments INTEGER NOT NULL DEFAULT 0;
```

### 4. Writing Type Label Rename
- "5줄" → "감사 일기" (5%)
- "10줄" → "주제 글쓰기" (10%)
- Updated in: `student-input.html`, `admin.html`, `admin-approval.html`, `js/student-input.js`, `js/admin-approval.js`
- DB values unchanged (`'5%'` / `'10%'`)

### 5. Multiple Titles (up to 5)
Students can now enter up to 5 titles per daily entry (each worth 20% XP), replacing the previous single-title checkbox.

**Files modified**:
- `student-input.html` — replaced checkbox + single input with dynamic title rows + "추가" button
- `js/student-input.js` — `addTitleInput()` function (max 5), multi-title XP preview, bulk title insert

## Migration Checklist (for existing deployments)
1. Run in Supabase SQL Editor:
```sql
-- Add assignments column
ALTER TABLE daily_entries ADD COLUMN assignments INTEGER NOT NULL DEFAULT 0;

-- Create notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    value_type_name TEXT NOT NULL,
    milestone_level INTEGER NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'read')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT
    USING (recipient_id = auth.uid() OR is_admin());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
    USING (recipient_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
```
2. Deploy updated files to Netlify

## File Change Summary
| File | Change |
|------|--------|
| `css/style.css` | Calendar icon fix + notification UI styles |
| `supabase-setup.sql` | `assignments` column + `notifications` table + RLS |
| `js/notifications.js` | **New**: milestone check + bell UI |
| `js/auth.js` | Init notification bell after auth |
| `js/student-input.js` | Assignments input, multi-title (up to 5), writing label rename |
| `js/student.js` | Assignments column in progress table |
| `js/admin.js` | Assignments in XP calc, entry form, detail table, milestone check |
| `js/admin-approval.js` | Assignments in approval cards/edit modal, milestone checks, writing label rename |
| `student.html` | Notification bell + assignments column header |
| `student-input.html` | Notification bell + assignments input + multi-title UI + writing label rename |
| `admin.html` | Notification bell + assignments in admin entry form + writing label rename |
| `admin-approval.html` | Notification bell + assignments in edit modal + writing label rename |
| `CLAUDE.md` | Updated to reflect new features |
