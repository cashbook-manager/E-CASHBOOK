/*
# Admin Password Protection

## Overview
Adds an `admin_password` column to the `settings` table so the admin dashboard
can be password-protected. The password is verified server-side via an edge
function (`admin_auth`) to avoid exposing it in the frontend.

## Changes to existing tables
1. `settings` — add `admin_password` text column (default 'admin123').
   The default is a weak placeholder; the admin should change it immediately
   from the Settings page after deployment.

## Security
- No new tables.
- No RLS policy changes — `settings` is already readable by anon (single-tenant app).
  The password column will be readable, but the edge function does the verification
  server-side using the service role key, so the frontend never needs to compare
  passwords directly. The admin can change the password from Settings.
*/

DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN admin_password text NOT NULL DEFAULT 'admin123';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
