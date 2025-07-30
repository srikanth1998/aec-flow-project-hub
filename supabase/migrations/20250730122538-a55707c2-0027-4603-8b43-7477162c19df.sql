-- Create expenses table for project expense tracking
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for expenses
CREATE POLICY "Users can view expenses in their organization" 
ON public.expenses 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create expenses in their organization" 
ON public.expenses 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update expenses" 
ON public.expenses 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'pm')
  )
);

CREATE POLICY "Admins can delete expenses" 
ON public.expenses 
FOR DELETE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();