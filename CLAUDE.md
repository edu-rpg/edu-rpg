# Edu-RPG: Student XP Tracking Website

## Project Overview
RPG-style classroom XP tracker for Korean elementary/middle school teachers. Students submit daily XP entries, teacher (admin) approves them. Maintained by a non-developer.

## Tech Stack
- **Frontend**: Plain HTML + CSS + vanilla JavaScript (no frameworks, no build step)
- **Backend/DB/Auth**: Supabase (PostgreSQL + Auth + JS SDK via CDN)
- **Hosting**: Netlify (static file drag & drop)

## File Structure
```
edu-rpg/
├── index.html              # Login page
├── student.html            # Student progress dashboard (경험치 통장)
├── student-input.html      # Student daily XP input form
├── admin.html              # Admin dashboard (students + value type mgmt)
├── admin-approval.html     # Admin pending entry approval
├── css/style.css           # RPG-themed dark CSS (single file)
├── js/
│   ├── supabase-config.js  # Supabase URL + anon key (gitignored credentials)
│   ├── auth.js             # Login/logout/route guard (shared across all pages)
│   ├── student.js          # Student progress table logic
│   ├── student-input.js    # Student input form logic
│   ├── admin.js            # Admin dashboard logic
│   ├── admin-approval.js   # Admin approval logic
│   └── notifications.js    # Shared milestone check + notification bell UI
├── assets/                 # RPG-themed icons/images
└── supabase-setup.sql      # DB schema, RLS policies, seed data
```

## Database (Supabase PostgreSQL)
- **profiles**: user id/name/role (FK to auth.users)
- **value_types**: admin-managed dynamic subject stamps (국어, 수학, etc.) with points
- **daily_entries**: per-student daily XP record (greetings, assignments, writing, status)
- **entry_value_stamps**: denormalized stamps per entry (snapshots points at time of entry)
- **titles**: student-earned titles (20% XP each, up to 5 per entry)
- **notifications**: milestone alerts when students accumulate every 10 stamps of a value type

RLS enforced: students see only their own data, admin sees all. `is_admin()` SQL helper function.

## Key Concepts
- **Leveling**: every 100% XP = 1 level. Displayed as "Lv.3 42%"
- **XP sources**: 인사 3%, 가치 stamps (dynamic, default 5%), 과제 5% each, 글쓰기 감사일기 5%/주제글쓰기 10%, 칭호 20% each (up to 5)
- **Approval flow**: student submits (status=pending) → admin approves/edits/rejects → approved entries count toward XP
- **Value type snapshots**: when a stamp is recorded, the current point value is copied into entry_value_stamps so historical entries are unaffected by later changes
- **Milestone notifications**: every 10 approved stamps of the same value type triggers notifications to both student and admin. Stored in `notifications` table with sent/read status.

## Development Notes
- All JS loaded via `<script>` tags, no modules/bundler. Supabase SDK loaded from CDN.
- Each HTML page includes: supabase CDN → supabase-config.js → auth.js → notifications.js → page-specific JS
- auth.js provides `getProfile()`, `requireAuth(roles)`, `logout()` — used by all pages
- No routing library; navigation is plain `<a href>` and `window.location.href`
- All UI text is in Korean

## Conventions
- Keep it simple — the maintainer is a non-developer teacher
- No build tools, no npm, no transpilation
- One CSS file for everything
- Inline event handlers (onclick) are acceptable for admin UI simplicity
- Prefer `async/await` with Supabase JS SDK v2
