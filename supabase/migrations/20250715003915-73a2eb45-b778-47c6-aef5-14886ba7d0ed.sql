-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  estimated_hours DECIMAL(10,2),
  actual_hours DECIMAL(10,2) DEFAULT 0,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2) DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_assignments table for multiple users working on a task
CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  hours_spent DECIMAL(10,2) DEFAULT 0,
  cost_incurred DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  date_worked DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id, date_worked)
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
CREATE POLICY "Users can view tasks in their organization" 
ON public.tasks 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create tasks in their organization" 
ON public.tasks 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Project managers and admins can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (organization_id = get_user_organization_id() AND (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'pm')
  )
  OR created_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Project managers and admins can delete tasks" 
ON public.tasks 
FOR DELETE 
USING (organization_id = get_user_organization_id() AND (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'pm')
  )
  OR created_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
));

-- RLS policies for task_assignments
CREATE POLICY "Users can view task assignments in their organization" 
ON public.task_assignments 
FOR SELECT 
USING (
  task_id IN (
    SELECT id FROM tasks WHERE organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can create their own task assignments" 
ON public.task_assignments 
FOR INSERT 
WITH CHECK (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND task_id IN (
    SELECT id FROM tasks WHERE organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can update their own task assignments" 
ON public.task_assignments 
FOR UPDATE 
USING (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND task_id IN (
    SELECT id FROM tasks WHERE organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can delete their own task assignments" 
ON public.task_assignments 
FOR DELETE 
USING (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND task_id IN (
    SELECT id FROM tasks WHERE organization_id = get_user_organization_id()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_task_assignments_updated_at
BEFORE UPDATE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();