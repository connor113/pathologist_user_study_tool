-- Migration 007: First-login auth flow
-- Adds email and must_change_password fields to support initial password setup

-- Add email column (nullable for existing users)
ALTER TABLE users ADD COLUMN email VARCHAR(255);

-- Add must_change_password column (default false for existing users)
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT false;

-- Confirmation message
SELECT 'Added email and must_change_password columns to users table' AS status;
