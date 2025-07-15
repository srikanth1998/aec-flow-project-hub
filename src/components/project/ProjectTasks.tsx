import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, X, Trash2 } from "lucide-react";

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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [columnNames, setColumnNames] = useState({
    name: "Task Name",
    status: "Status",
    estimated_hours: "Est. Hours",
    actual_hours: "Actual Hours",
    estimated_cost: "Est. Cost",
    actual_cost: "Actual Cost",
    assigned_user: "Assigned User",
  });
  const [customColumns, setCustomColumns] = useState<Array<{id: string, name: string, type: 'text' | 'number' | 'select'}>>([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newRow, setNewRow] = useState<any>({
    name: "",
    status: "pending",
    estimated_hours: "",
    actual_hours: "",
    estimated_cost: "",
    actual_cost: "",
    assigned_user: "",
  });
  const [isAddingRow, setIsAddingRow] = useState(false);
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
    if (!newRow.name.trim() || !currentUserProfile) return;

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
          name: newRow.name,
          status: newRow.status,
          estimated_hours: newRow.estimated_hours ? parseFloat(newRow.estimated_hours) : null,
          actual_hours: newRow.actual_hours ? parseFloat(newRow.actual_hours) : null,
          estimated_cost: newRow.estimated_cost ? parseFloat(newRow.estimated_cost) : null,
          actual_cost: newRow.actual_cost ? parseFloat(newRow.actual_cost) : null,
          created_by: currentUserProfile.id,
          organization_id: projectData?.organization_id,
        });

      if (error) throw error;

      // Add task assignment if user is selected
      if (newRow.assigned_user && newRow.actual_hours) {
        await supabase
          .from("task_assignments")
          .insert({
            task_id: (await supabase
              .from("tasks")
              .select("id")
              .eq("name", newRow.name)
              .eq("project_id", projectId)
              .single()).data?.id,
            user_id: newRow.assigned_user,
            hours_spent: parseFloat(newRow.actual_hours),
            cost_incurred: newRow.actual_cost ? parseFloat(newRow.actual_cost) : 0,
          });
      }

      const resetRow: any = {
        name: "",
        status: "pending",
        estimated_hours: "",
        actual_hours: "",
        estimated_cost: "",
        actual_cost: "",
        assigned_user: "",
      };
      customColumns.forEach(col => {
        resetRow[col.id] = "";
      });
      setNewRow(resetRow);
      setIsAddingRow(false);
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

  const handleUpdateTask = async (taskId: string, field: string, value: string) => {
    try {
      const updateData: any = {};
      
      if (field === 'estimated_hours' || field === 'actual_hours') {
        updateData[field] = value ? parseFloat(value) : null;
      } else if (field === 'estimated_cost' || field === 'actual_cost') {
        updateData[field] = value ? parseFloat(value) : null;
      } else {
        updateData[field] = value;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);

      if (error) throw error;

      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      fetchTasks();
      toast({
        title: "Success",
        description: "Task deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addCustomColumn = () => {
    if (!newColumnName.trim()) return;
    
    const newColumn = {
      id: `custom_${Date.now()}`,
      name: newColumnName,
      type: 'text' as const
    };
    
    setCustomColumns([...customColumns, newColumn]);
    setNewRow({ ...newRow, [newColumn.id]: "" });
    setNewColumnName("");
    setShowAddColumn(false);
  };

  const deleteCustomColumn = (columnId: string) => {
    setCustomColumns(customColumns.filter(col => col.id !== columnId));
    const updatedNewRow = { ...newRow };
    delete updatedNewRow[columnId];
    setNewRow(updatedNewRow);
  };

  const canDeleteColumn = (columnKey: string) => {
    const coreColumns = ['name', 'status', 'estimated_hours', 'actual_hours', 'estimated_cost', 'actual_cost', 'assigned_user'];
    return !coreColumns.includes(columnKey);
  };

  const renderColumnHeader = (key: string, label: string, width: string) => (
    <TableHead key={key} className={width}>
      <div className="flex items-center justify-between group">
        {editingColumn === key ? (
          <Input
            value={key.startsWith('custom_') ? customColumns.find(col => col.id === key)?.name || label : columnNames[key as keyof typeof columnNames]}
            onChange={(e) => {
              if (key.startsWith('custom_')) {
                setCustomColumns(customColumns.map(col => 
                  col.id === key ? { ...col, name: e.target.value } : col
                ));
              } else {
                setColumnNames({ ...columnNames, [key]: e.target.value });
              }
            }}
            onBlur={() => setEditingColumn(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditingColumn(null);
            }}
            className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1 font-semibold"
            autoFocus
          />
        ) : (
          <div 
            onClick={() => setEditingColumn(key)}
            className="cursor-pointer hover:bg-muted/20 p-1 rounded flex-1"
          >
            {label}
            {canDeleteColumn(key) && (
              <span className="text-xs text-muted-foreground ml-1">(hover to delete)</span>
            )}
          </div>
        )}
        {canDeleteColumn(key) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteCustomColumn(key)}
            className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground ml-1 transition-all"
            title="Delete column"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </TableHead>
  );

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddColumn(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Column
          </Button>
          <Button onClick={() => setIsAddingRow(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {showAddColumn && (
        <div className="mb-4 p-4 border rounded-lg bg-muted/20">
          <div className="flex items-center gap-2">
            <Input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Enter column name"
              className="max-w-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomColumn();
                if (e.key === 'Escape') {
                  setShowAddColumn(false);
                  setNewColumnName("");
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={addCustomColumn} disabled={!newColumnName.trim()}>
              <Save className="h-4 w-4 mr-1" />
              Add
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setShowAddColumn(false);
                setNewColumnName("");
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {renderColumnHeader('name', columnNames.name, 'w-[200px]')}
              {renderColumnHeader('status', columnNames.status, 'w-[120px]')}
              {renderColumnHeader('estimated_hours', columnNames.estimated_hours, 'w-[100px]')}
              {renderColumnHeader('actual_hours', columnNames.actual_hours, 'w-[100px]')}
              {renderColumnHeader('estimated_cost', columnNames.estimated_cost, 'w-[120px]')}
              {renderColumnHeader('actual_cost', columnNames.actual_cost, 'w-[120px]')}
              {renderColumnHeader('assigned_user', columnNames.assigned_user, 'w-[150px]')}
              {customColumns.map(col => renderColumnHeader(col.id, col.name, 'w-[120px]'))}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const assignedUser = task.task_assignments?.[0]?.profiles;
              const totalHours = task.task_assignments?.reduce((sum, assignment) => sum + (assignment.hours_spent || 0), 0) || 0;
              const totalCost = task.task_assignments?.reduce((sum, assignment) => sum + (assignment.cost_incurred || 0), 0) || 0;
              
              return (
                <TableRow key={task.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Input
                      value={task.name}
                      onChange={(e) => handleUpdateTask(task.id, 'name', e.target.value)}
                      className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                      onBlur={() => setEditingTaskId(null)}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(value) => handleUpdateTask(task.id, 'status', value)}
                    >
                      <SelectTrigger className="border-0 bg-transparent h-auto p-0 focus:ring-0">
                        <SelectValue>
                          <Badge variant={getStatusColor(task.status)} className="text-xs">
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.5"
                      value={task.estimated_hours || ""}
                      onChange={(e) => handleUpdateTask(task.id, 'estimated_hours', e.target.value)}
                      className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 w-20"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{totalHours}h</span>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={task.estimated_cost || ""}
                      onChange={(e) => handleUpdateTask(task.id, 'estimated_cost', e.target.value)}
                      className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 w-24"
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">${totalCost}</span>
                  </TableCell>
                  <TableCell>
                    {assignedUser ? (
                      <span className="text-sm">
                        {assignedUser.first_name} {assignedUser.last_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  {customColumns.map(col => (
                    <TableCell key={col.id}>
                      <Input
                        value={(task as any)[col.id] || ""}
                        onChange={(e) => handleUpdateTask(task.id, col.id, e.target.value)}
                        className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 w-24"
                        placeholder={col.type === 'number' ? '0' : 'Enter value'}
                        type={col.type === 'number' ? 'number' : 'text'}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            
            {isAddingRow && (
              <TableRow className="bg-muted/20">
                <TableCell>
                  <Input
                    value={newRow.name}
                    onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                    placeholder="Enter task name"
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1"
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newRow.status}
                    onValueChange={(value) => setNewRow({ ...newRow, status: value })}
                  >
                    <SelectTrigger className="border-0 bg-transparent h-auto p-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.5"
                    value={newRow.estimated_hours}
                    onChange={(e) => setNewRow({ ...newRow, estimated_hours: e.target.value })}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1 w-20"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.5"
                    value={newRow.actual_hours}
                    onChange={(e) => setNewRow({ ...newRow, actual_hours: e.target.value })}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1 w-20"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={newRow.estimated_cost}
                    onChange={(e) => setNewRow({ ...newRow, estimated_cost: e.target.value })}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1 w-24"
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={newRow.actual_cost}
                    onChange={(e) => setNewRow({ ...newRow, actual_cost: e.target.value })}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1 w-24"
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={newRow.assigned_user}
                    onValueChange={(value) => setNewRow({ ...newRow, assigned_user: value })}
                  >
                    <SelectTrigger className="border-0 bg-transparent h-auto p-0">
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
                </TableCell>
                {customColumns.map(col => (
                  <TableCell key={col.id}>
                    <Input
                      value={newRow[col.id] || ""}
                      onChange={(e) => setNewRow({ ...newRow, [col.id]: e.target.value })}
                      className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1 w-24"
                      placeholder={col.type === 'number' ? '0' : 'Enter value'}
                      type={col.type === 'number' ? 'number' : 'text'}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCreateTask}
                      className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
                      disabled={!newRow.name.trim()}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingRow(false);
                        const resetRow: any = {
                          name: "",
                          status: "pending",
                          estimated_hours: "",
                          actual_hours: "",
                          estimated_cost: "",
                          actual_cost: "",
                          assigned_user: "",
                        };
                        customColumns.forEach(col => {
                          resetRow[col.id] = "";
                        });
                        setNewRow(resetRow);
                      }}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {tasks.length === 0 && !isAddingRow && (
              <TableRow>
                <TableCell colSpan={8 + customColumns.length} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <p className="mb-2">No tasks yet</p>
                    <Button variant="outline" onClick={() => setIsAddingRow(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Task
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};