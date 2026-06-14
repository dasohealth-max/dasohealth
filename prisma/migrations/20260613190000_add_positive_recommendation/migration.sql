-- Add 'Positive' to screening_recommendation enum
-- PostgreSQL allows ADD VALUE but not DROP VALUE — legacy values kept for old records
ALTER TYPE "screening_recommendation" ADD VALUE IF NOT EXISTS 'Positive';
