import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, DollarSign, User, Edit, Save, X, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectTasksProps {
  projectId: string;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: string;
  estimated_hours: number;
  actual_hours: number;
  estimated_cost: number;
  actual_cost: number;
  created_at: string;
  task_assignments: TaskAssignment[];
}

interface TaskAssignment {
  id: string;
  user_id: string;
  hours_spent: number;
  cost_incurred: number;
  notes: string;
  date_worked: string;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export const ProjectTasks = ({ projectId }: ProjectTasksProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    name: "",
    description: "",
    estimated_hours: "",
    estimated_cost: "",
  });
  const [newAssignment, setNewAssignment] = useState({
    taskId: "",
    userId: "",
    hours: "",
    cost: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
    fetchCurrentUserProfile();
  }, [projectId]);

  const fetchCurrentUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setCurrentUserProfile(data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("first_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_assignments (
            *,
            profiles (
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.name.trim() || !currentUserProfile) return;

    try {
      const { data: projectData } = await supabase
        .from("projects")
        .select("organization_id")
        .eq("id", projectId)
        .single();

      const { error } = await supabase
        .from("tasks")
        .insert({
          project_id: projectId,
          name: newTask.name,
          description: newTask.description,
          estimated_hours: newTask.estimated_hours ? parseFloat(newTask.estimated_hours) : null,
          estimated_cost: newTask.estimated_cost ? parseFloat(newTask.estimated_cost) : null,
          created_by: currentUserProfile.id,
          organization_id: projectData?.organization_id,
        });

      if (error) throw error;

      setNewTask({ name: "", description: "", estimated_hours: "", estimated_cost: "" });
      setShowNewTaskForm(false);
      fetchTasks();
      toast({
        title: "Success",
        description: "Task created successfully.",
      });
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddAssignment = async (taskId: string) => {
    if (!newAssignment.userId || !newAssignment.hours) return;

    try {
      const { error } = await supabase
        .from("task_assignments")
        .insert({
          task_id: taskId,
          user_id: newAssignment.userId,
          hours_spent: parseFloat(newAssignment.hours),
          cost_incurred: newAssignment.cost ? parseFloat(newAssignment.cost) : 0,
          notes: newAssignment.notes,
        });

      if (error) throw error;

      setNewAssignment({ taskId: "", userId: "", hours: "", cost: "", notes: "" });
      fetchTasks();
      toast({
        title: "Success",
        description: "Time entry added successfully.",
      });
    } catch (error) {
      console.error("Error adding assignment:", error);
      toast({
        title: "Error",
        description: "Failed to add time entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-24 bg-muted rounded"></div>
            <div className="h-24 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <Button onClick={() => setShowNewTaskForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {showNewTaskForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="taskName">Task Name</Label>
              <Input
                id="taskName"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                placeholder="Enter task name"
              />
            </div>
            <div>
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea
                id="taskDescription"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Enter task description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  step="0.5"
                  value={newTask.estimated_hours}
                  onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="estimatedCost">Estimated Cost</Label>
                <Input
                  id="estimatedCost"
                  type="number"
                  step="0.01"
                  value={newTask.estimated_cost}
                  onChange={(e) => setNewTask({ ...newTask, estimated_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateTask}>
                <Save className="h-4 w-4 mr-2" />
                Create Task
              </Button>
              <Button variant="outline" onClick={() => setShowNewTaskForm(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{task.name}</CardTitle>
                  <Badge variant={getStatusColor(task.status)} className="mt-2">
                    {task.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              {task.description && (
                <p className="text-muted-foreground">{task.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {task.actual_hours || 0}h / {task.estimated_hours || 0}h
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    ${task.actual_cost || 0} / ${task.estimated_cost || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {task.task_assignments?.length || 0} assignee(s)
                  </span>
                </div>
              </div>

              {task.task_assignments && task.task_assignments.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Time Entries</h4>
                  <div className="space-y-2">
                    {task.task_assignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">
                            {assignment.profiles.first_name} {assignment.profiles.last_name}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {assignment.hours_spent}h • ${assignment.cost_incurred}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(assignment.date_worked).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Add Time Entry</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Select
                    value={newAssignment.taskId === task.id ? newAssignment.userId : ""}
                    onValueChange={(value) => setNewAssignment({ ...newAssignment, taskId: task.id, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.first_name} {profile.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="Hours"
                    value={newAssignment.taskId === task.id ? newAssignment.hours : ""}
                    onChange={(e) => setNewAssignment({ ...newAssignment, taskId: task.id, hours: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cost"
                    value={newAssignment.taskId === task.id ? newAssignment.cost : ""}
                    onChange={(e) => setNewAssignment({ ...newAssignment, taskId: task.id, cost: e.target.value })}
                  />
                  <Button 
                    size="sm" 
                    onClick={() => handleAddAssignment(task.id)}
                    disabled={!newAssignment.userId || !newAssignment.hours || newAssignment.taskId !== task.id}
                  >
                    Add Entry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first task to start tracking work and progress.
            </p>
            <Button onClick={() => setShowNewTaskForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Task
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};