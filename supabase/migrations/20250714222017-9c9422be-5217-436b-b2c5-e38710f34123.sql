-- Fix infinite recursion in profiles policies by creating a security definer function
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM profiles 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert new profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate profiles policies using the function to avoid recursion
CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can insert new profiles in their organization" 
ON public.profiles 
FOR INSERT 
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

-- Update projects policies to use the function as well
DROP POLICY IF EXISTS "Users can view projects in their organization" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects in their organization" ON public.projects;
DROP POLICY IF EXISTS "Project managers and admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Recreate projects policies
CREATE POLICY "Users can view projects in their organization" 
ON public.projects 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create projects in their organization" 
ON public.projects 
FOR INSERT 
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Project managers and admins can update projects" 
ON public.projects 
FOR UPDATE 
USING (
  organization_id = public.get_user_organization_id() AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'pm')
  )
);

CREATE POLICY "Admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (
  organization_id = public.get_user_organization_id() AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);