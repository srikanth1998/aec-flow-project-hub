-- Add foreign key constraint for uploaded_by to reference profiles table
ALTER TABLE public.drawings 
ADD CONSTRAINT drawings_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);