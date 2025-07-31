-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create vendors/payees table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  default_category_id UUID REFERENCES public.expense_categories(id),
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for expense_categories
CREATE POLICY "Users can view categories in their organization" 
ON public.expense_categories 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create categories in their organization" 
ON public.expense_categories 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update categories" 
ON public.expense_categories 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin'::user_role OR role = 'pm'::user_role)
  )
);

CREATE POLICY "Admins can delete categories" 
ON public.expense_categories 
FOR DELETE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::user_role
  )
);

-- Create RLS policies for vendors
CREATE POLICY "Users can view vendors in their organization" 
ON public.vendors 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create vendors in their organization" 
ON public.vendors 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update vendors" 
ON public.vendors 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin'::user_role OR role = 'pm'::user_role)
  )
);

CREATE POLICY "Admins can delete vendors" 
ON public.vendors 
FOR DELETE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::user_role
  )
);

-- Add foreign key to vendors table for default category
ALTER TABLE public.vendors 
ADD CONSTRAINT vendors_default_category_fk 
FOREIGN KEY (default_category_id) REFERENCES public.expense_categories(id);

-- Create triggers for updating timestamps
CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.expense_categories (organization_id, name, description) 
VALUES 
  ((SELECT get_user_organization_id()), 'Office Supplies', 'General office supplies and equipment'),
  ((SELECT get_user_organization_id()), 'Travel', 'Business travel expenses'),
  ((SELECT get_user_organization_id()), 'Meals & Entertainment', 'Business meals and client entertainment'),
  ((SELECT get_user_organization_id()), 'Professional Services', 'Legal, accounting, and consulting fees'),
  ((SELECT get_user_organization_id()), 'Marketing', 'Advertising and promotional expenses'),
  ((SELECT get_user_organization_id()), 'Utilities', 'Phone, internet, electricity, etc.'),
  ((SELECT get_user_organization_id()), 'Equipment', 'Computer hardware, tools, and equipment'),
  ((SELECT get_user_organization_id()), 'Software', 'Software licenses and subscriptions'),
  ((SELECT get_user_organization_id()), 'Insurance', 'Business insurance premiums'),
  ((SELECT get_user_organization_id()), 'Other', 'Miscellaneous business expenses');