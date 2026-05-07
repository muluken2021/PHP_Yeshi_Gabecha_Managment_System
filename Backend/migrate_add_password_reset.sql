-- Run this in phpMyAdmin on your yeshih_gabcha database
-- Adds the password reset OTP columns to the users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS passwordResetOtp       VARCHAR(6)  DEFAULT NULL AFTER twoFactorTempToken,
  ADD COLUMN IF NOT EXISTS passwordResetOtpExpiry DATETIME    DEFAULT NULL AFTER passwordResetOtp;
