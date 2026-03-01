-- ============================================
-- Edu-RPG: Supabase Database Setup
-- ============================================
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- After running, create user accounts via Authentication > Users

-- 1. Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin'))
);

-- 2. Value types table (admin-managed)
CREATE TABLE value_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 5,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Daily entries table
CREATE TABLE daily_entries (
    id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    greetings BOOLEAN NOT NULL DEFAULT false,
    assignments INTEGER NOT NULL DEFAULT 0,
    writing_type TEXT NOT NULL DEFAULT 'none' CHECK (writing_type IN ('none', '5%', '10%')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Entry value stamps table (denormalized)
CREATE TABLE entry_value_stamps (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
    value_type_id INTEGER NOT NULL REFERENCES value_types(id),
    date DATE NOT NULL,
    student_name TEXT NOT NULL,
    value_name TEXT NOT NULL,
    points INTEGER NOT NULL
);

-- 5. Titles table
CREATE TABLE titles (
    id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
    title_name TEXT NOT NULL,
    date_earned DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved'))
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE value_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_value_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- === profiles ===
-- Everyone can read profiles (needed for name lookups)
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
-- Allow insert during signup (handled by trigger below)
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid() OR is_admin());

-- === value_types ===
-- Everyone can read value types
CREATE POLICY "value_types_select" ON value_types FOR SELECT USING (true);
-- Only admin can insert/update
CREATE POLICY "value_types_insert" ON value_types FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "value_types_update" ON value_types FOR UPDATE USING (is_admin());

-- === daily_entries ===
-- Students can read their own entries; admin can read all
CREATE POLICY "entries_select" ON daily_entries FOR SELECT
    USING (student_id = auth.uid() OR is_admin());
-- Students can insert their own entries
CREATE POLICY "entries_insert" ON daily_entries FOR INSERT
    WITH CHECK (student_id = auth.uid() OR is_admin());
-- Only admin can update entries (for approval)
CREATE POLICY "entries_update" ON daily_entries FOR UPDATE USING (is_admin());
-- Only admin can delete entries
CREATE POLICY "entries_delete" ON daily_entries FOR DELETE USING (is_admin());

-- === entry_value_stamps ===
-- Students see their own stamps; admin sees all
CREATE POLICY "stamps_select" ON entry_value_stamps FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM daily_entries
            WHERE daily_entries.id = entry_value_stamps.entry_id
            AND (daily_entries.student_id = auth.uid() OR is_admin())
        )
    );
-- Students can insert stamps for their own entries
CREATE POLICY "stamps_insert" ON entry_value_stamps FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM daily_entries
            WHERE daily_entries.id = entry_value_stamps.entry_id
            AND (daily_entries.student_id = auth.uid() OR is_admin())
        )
    );
-- Admin can delete stamps (for edit)
CREATE POLICY "stamps_delete" ON entry_value_stamps FOR DELETE USING (is_admin());

-- === titles ===
-- Students see their own titles; admin sees all
CREATE POLICY "titles_select" ON titles FOR SELECT
    USING (student_id = auth.uid() OR is_admin());
-- Students can insert their own titles
CREATE POLICY "titles_insert" ON titles FOR INSERT
    WITH CHECK (student_id = auth.uid() OR is_admin());
-- Admin can update titles (for approval)
CREATE POLICY "titles_update" ON titles FOR UPDATE USING (is_admin());
-- Admin can delete titles
CREATE POLICY "titles_delete" ON titles FOR DELETE USING (is_admin());

-- 6. Notifications table (milestone alerts)
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

-- Users can read their own notifications; admin can read all
CREATE POLICY "notifications_select" ON notifications FOR SELECT
    USING (recipient_id = auth.uid() OR is_admin());
-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
    USING (recipient_id = auth.uid());
-- Logged-in users can insert notifications (triggered during approval)
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Seed Data: Default value types
-- ============================================
INSERT INTO value_types (name, points, active) VALUES
    ('국어', 5, true),
    ('수학', 5, true),
    ('과학', 5, true),
    ('미술', 5, true),
    ('음악', 5, true);

-- ============================================
-- SETUP INSTRUCTIONS
-- ============================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Go to Authentication > Users > Add User
--    - Create admin: email + password, then run:
--      INSERT INTO profiles (id, name, role) VALUES ('<admin-user-uuid>', '선생님', 'admin');
--    - Create students: email + password, then run:
--      INSERT INTO profiles (id, name, role) VALUES ('<student-user-uuid>', '학생이름', 'student');
-- 3. Copy your Supabase URL and anon key from Settings > API
-- 4. Paste them into js/supabase-config.js
-- 5. Deploy the folder to Netlify (drag & drop)
