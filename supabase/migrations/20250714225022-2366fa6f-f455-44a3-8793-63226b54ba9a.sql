-- Update the handle_new_user function to create organization and admin profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id uuid;
  user_email text;
BEGIN
  -- Get the user's email from the auth metadata or email field
  user_email := COALESCE(NEW.raw_user_meta_data ->> 'email', NEW.email);
  
  -- Create a new organization for this user
  INSERT INTO public.organizations (name)
  VALUES (user_email || '''s Organization')
  RETURNING id INTO new_org_id;
  
  -- Create a profile for the user as admin of their new organization
  INSERT INTO public.profiles (
    user_id,
    organization_id, 
    role,
    email,
    first_name,
    last_name
  )
  VALUES (
    NEW.id,
    new_org_id,
    'admin'::user_role,
    user_email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  RETURN NEW;
END;
$function$;

-- Create the trigger to call this function when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();