-- Add payment status column to services table
ALTER TABLE public.services 
ADD COLUMN payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'to_be_paid', 'unpaid'));