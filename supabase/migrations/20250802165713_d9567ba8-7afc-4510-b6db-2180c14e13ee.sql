-- Add tax-related columns to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_tax_override BOOLEAN DEFAULT false;