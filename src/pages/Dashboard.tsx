import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MetricCard } from "@/components/ui/metric-card";
import { ActionCard } from "@/components/ui/action-card";
import { ProgressCard } from "@/components/ui/progress-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { 
  LogOut, 
  Plus, 
  Users, 
  FolderOpen, 
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  CheckSquare,
  AlertTriangle,
  BarChart3
} from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Signed out successfully!",
      });
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground animate-pulse">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  AEC Project Manager
                </h1>
                <p className="text-sm text-muted-foreground">Professional project management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium">Welcome back!</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">Dashboard Overview</h2>
              <p className="text-muted-foreground">
                Monitor your projects, track progress, and manage your team effectively
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status="progress">All Systems Operational</StatusBadge>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ActionCard
              title="New Project"
              description="Create a new project and assign team members with defined phases and timelines"
              icon={<FolderOpen className="h-6 w-6" />}
              badge="Start Here"
              badgeVariant="secondary"
              onClick={() => navigate("/projects/new")}
            />
            <ActionCard
              title="View Projects"
              description="Browse and manage existing projects, track progress, and update milestones"
              icon={<BarChart3 className="h-6 w-6" />}
              onClick={() => navigate("/projects")}
            />
            <ActionCard
              title="Team Management"
              description="Manage team members, assign roles, and track resource allocation across projects"
              icon={<Users className="h-6 w-6" />}
              onClick={() => navigate("/projects")}
            />
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Key Performance Indicators
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Active Projects"
              value="0"
              description="Projects currently in progress"
              icon={<FolderOpen className="h-5 w-5" />}
              onClick={() => navigate("/projects")}
            />
            <MetricCard
              title="Team Members"
              value="1"
              description="Active team members"
              icon={<Users className="h-5 w-5" />}
              trend={{ value: 0, label: "from last month", isPositive: true }}
              onClick={() => navigate("/projects")}
            />
            <MetricCard
              title="Tasks Due This Week"
              value="0"
              description="Upcoming deadlines"
              icon={<Calendar className="h-5 w-5" />}
              onClick={() => navigate("/tasks")}
            />
            <MetricCard
              title="Budget Utilization"
              value="0%"
              description="Average across active projects"
              icon={<DollarSign className="h-5 w-5" />}
              onClick={() => navigate("/reports")}
            />
          </div>
        </div>

        {/* Progress Tracking */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Project Progress
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProgressCard
              title="Overall Completion"
              progress={0}
              description="Across all active projects"
              color="primary"
              size="lg"
            />
            <ProgressCard
              title="Budget Spent"
              progress={0}
              target={100}
              unit="%"
              description="Of allocated budget"
              color="warning"
            />
            <ProgressCard
              title="Team Utilization"
              progress={0}
              target={100}
              unit="%"
              description="Average team capacity"
              color="secondary"
            />
          </div>
        </div>

        {/* Recent Activity & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          {/* Recent Activity */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Activity
            </h3>
            <div className="bg-card rounded-xl p-6 border-0 shadow-soft">
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Activity will appear here as you work on projects</p>
              </div>
            </div>
          </div>

          {/* Alerts & Notifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Alerts & Notifications
            </h3>
            <div className="bg-card rounded-xl p-6 border-0 shadow-soft">
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No active alerts</p>
                <p className="text-xs mt-1">Important notifications will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;