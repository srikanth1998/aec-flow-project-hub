-- Create services table for storing services offered by the organization
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  unit TEXT DEFAULT 'hour', -- hour, day, fixed, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, overdue
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_items table for services in invoices
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL,
  service_id UUID,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table for recording payments
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT, -- cash, check, bank_transfer, etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for services
CREATE POLICY "Users can view services in their organization" 
ON public.services 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create services in their organization" 
ON public.services 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update services" 
ON public.services 
FOR UPDATE 
USING (organization_id = get_user_organization_id() AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND (role = 'admin'::user_role OR role = 'pm'::user_role)
));

CREATE POLICY "Admins can delete services" 
ON public.services 
FOR DELETE 
USING (organization_id = get_user_organization_id() AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'::user_role
));

-- RLS policies for invoices
CREATE POLICY "Users can view invoices in their organization" 
ON public.invoices 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create invoices in their organization" 
ON public.invoices 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update invoices" 
ON public.invoices 
FOR UPDATE 
USING (organization_id = get_user_organization_id() AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND (role = 'admin'::user_role OR role = 'pm'::user_role)
));

CREATE POLICY "Admins can delete invoices" 
ON public.invoices 
FOR DELETE 
USING (organization_id = get_user_organization_id() AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'::user_role
));

-- RLS policies for invoice_items
CREATE POLICY "Users can view invoice items in their organization" 
ON public.invoice_items 
FOR SELECT 
USING (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
));

CREATE POLICY "Users can create invoice items" 
ON public.invoice_items 
FOR INSERT 
WITH CHECK (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
));

CREATE POLICY "Users can update invoice items" 
ON public.invoice_items 
FOR UPDATE 
USING (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
));

CREATE POLICY "Users can delete invoice items" 
ON public.invoice_items 
FOR DELETE 
USING (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
));

-- RLS policies for payments
CREATE POLICY "Users can view payments in their organization" 
ON public.payments 
FOR SELECT 
USING (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
));

CREATE POLICY "Users can create payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
));

CREATE POLICY "Admins can update payments" 
ON public.payments 
FOR UPDATE 
USING (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
) AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'::user_role
));

CREATE POLICY "Admins can delete payments" 
ON public.payments 
FOR DELETE 
USING (invoice_id IN (
  SELECT id FROM invoices WHERE organization_id = get_user_organization_id()
) AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'::user_role
));

-- Add foreign key constraints
ALTER TABLE public.invoices ADD CONSTRAINT fk_invoices_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD CONSTRAINT fk_invoice_items_service FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- Add triggers for updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically calculate balance due
CREATE OR REPLACE FUNCTION calculate_balance_due()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_due = NEW.total_amount - NEW.paid_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_balance_due_trigger
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_balance_due();

-- Function to update invoice totals when payments are added/updated/deleted
CREATE OR REPLACE FUNCTION update_invoice_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  invoice_uuid UUID;
  total_paid DECIMAL(10,2);
BEGIN
  -- Get the invoice ID from either NEW or OLD record
  invoice_uuid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate total paid amount for this invoice
  SELECT COALESCE(SUM(amount), 0) 
  INTO total_paid
  FROM public.payments 
  WHERE invoice_id = invoice_uuid;
  
  -- Update the invoice
  UPDATE public.invoices 
  SET paid_amount = total_paid,
      updated_at = now()
  WHERE id = invoice_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_paid_amount_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_paid_amount();