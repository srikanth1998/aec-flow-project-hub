import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Filter, Calendar, Receipt, Edit, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { VendorCreateDialog } from "@/components/VendorCreateDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Vendor {
  id: string;
  name: string;
  default_category_id?: string;
  client_name?: string;
  type?: 'vendor' | 'project';
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Expense {
  id: string;
  expense_date: string;
  vendor?: string;
  description: string;
  category: string;
  amount: number;
  payment_method?: string;
  receipt_url?: string;
  project_id: string;
  project_name?: string;
  organization_id: string;
  tax_amount?: number;
  tax_rate?: number;
  manual_tax_override?: boolean;
}

const paymentMethods = [
  "Cash",
  "Credit Card", 
  "Debit Card",
  "Check",
  "Bank Transfer",
  "PayPal",
];

export default function FinancialExpenses() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    vendor: "",
    vendorId: "",
    description: "",
    category: "",
    categoryId: "",
    amount: "",
    paymentMethod: "",
    reference: "",
    projectId: "",
    taxRate: "",
    taxAmount: "",
    manualTaxOverride: false,
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchVendors();
    fetchCategories();
    fetchExpenses();
  }, []);

  const fetchVendors = async () => {
    try {
      // Fetch regular vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .order('name');
      
      if (vendorsError) throw vendorsError;

      // Fetch projects to include as vendors
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, client_name')
        .order('name');
      
      if (projectsError) throw projectsError;

      // Combine vendors and projects
      const allVendors: Vendor[] = [
        ...(vendorsData || []).map(vendor => ({ ...vendor, type: 'vendor' as const })),
        ...(projectsData || []).map(project => ({
          id: project.id,
          name: project.name,
          client_name: project.client_name,
          type: 'project' as const
        }))
      ];

      setVendors(allVendors);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      
      // Fetch expenses with project names
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          projects!inner(name)
        `)
        .order('expense_date', { ascending: false });
      
      if (expensesError) throw expensesError;

      // Transform data to match our interface
      const transformedExpenses: Expense[] = (expensesData || []).map(expense => ({
        id: expense.id,
        expense_date: expense.expense_date,
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        payment_method: expense.payment_method,
        receipt_url: expense.receipt_url,
        project_id: expense.project_id,
        project_name: expense.projects?.name,
        organization_id: expense.organization_id,
        tax_amount: expense.tax_amount || 0,
        tax_rate: expense.tax_rate || 0,
        manual_tax_override: expense.manual_tax_override || false,
      }));

      setExpenses(transformedExpenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: "Error",
        description: "Failed to fetch expenses. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createVendor = async (vendorName: string, categoryId?: string) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: vendorName,
          default_category_id: categoryId || null,
          organization_id: undefined // Will be set by RLS
        })
        .select()
        .single();

      if (error) throw error;

      const newVendor = data;
      setVendors(prev => [...prev, newVendor]);
      
      toast({
        title: "Vendor Created",
        description: `${vendorName} has been added to your vendors.`,
      });

      return newVendor;
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast({
        title: "Error",
        description: "Failed to create vendor. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const createCategory = async (categoryName: string) => {
    try {
      // Get the user's organization ID first
      const { data: orgData, error: orgError } = await supabase.rpc('get_user_organization_id');
      if (orgError) throw orgError;

      const { data, error } = await supabase
        .from('expense_categories')
        .insert({
          name: categoryName,
          organization_id: orgData
        })
        .select()
        .single();

      if (error) throw error;

      const newCategory = data;
      setCategories(prev => [...prev, newCategory]);
      
      toast({
        title: "Category Created",
        description: `${categoryName} has been added to your categories.`,
      });

      return newCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "Error",
        description: "Failed to create category. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleVendorSelect = async (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return;

    setNewExpense(prev => ({
      ...prev,
      vendorId: vendor.id,
      vendor: vendor.name,
    }));

    // Auto-select category based on vendor type or default category
    if (vendor.type === 'project') {
      // For projects, automatically set category to "Projects"
      let projectsCategory = categories.find(c => c.name === 'Projects');
      if (!projectsCategory) {
        // Create "Projects" category if it doesn't exist
        projectsCategory = await createCategory('Projects');
      }
      if (projectsCategory) {
        setNewExpense(prev => ({
          ...prev,
          categoryId: projectsCategory.id,
          category: projectsCategory.name,
        }));
      }
    } else if (vendor.default_category_id) {
      // For regular vendors, use their default category
      const category = categories.find(c => c.id === vendor.default_category_id);
      if (category) {
        setNewExpense(prev => ({
          ...prev,
          categoryId: category.id,
          category: category.name,
        }));
      }
    }
  };

  const handleVendorCreate = () => {
    setIsVendorDialogOpen(true);
  };

  const handleCategorySelect = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    setNewExpense(prev => ({
      ...prev,
      categoryId: category.id,
      category: category.name,
    }));
  };

  const handleCategoryCreate = async (categoryName: string) => {
    const category = await createCategory(categoryName);
    if (category) {
      setNewExpense(prev => ({
        ...prev,
        categoryId: category.id,
        category: category.name,
      }));
    }
  };

  // Helper function to get date range filter
  const getDateRangeFilter = (range: string) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
      case "today":
        return { start: startOfToday, end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) };
      case "this_week":
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: startOfWeek, end: endOfWeek };
      case "this_month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      case "this_year":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
        return { start: startOfYear, end: endOfYear };
      default:
        return null;
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch = 
        expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (expense.project_name && expense.project_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;
      const matchesProject = selectedProject === "all" || expense.project_id === selectedProject;
      
      // Date range filter
      let matchesDate = true;
      if (selectedDateRange !== "all") {
        const dateRange = getDateRangeFilter(selectedDateRange);
        if (dateRange) {
          const expenseDate = new Date(expense.expense_date);
          matchesDate = expenseDate >= dateRange.start && expenseDate < dateRange.end;
        }
      }
      
      return matchesSearch && matchesCategory && matchesProject && matchesDate;
    });
  }, [expenses, searchTerm, selectedCategory, selectedProject, selectedDateRange]);

  // Calculate dynamic summary metrics
  const summaryMetrics = useMemo(() => {
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalTaxAmount = filteredExpenses.reduce((sum, expense) => sum + (expense.tax_amount || 0), 0);
    
    // This month's expenses
    const thisMonthRange = getDateRangeFilter("this_month");
    const thisMonthExpenses = expenses.filter(expense => {
      if (!thisMonthRange) return false;
      const expenseDate = new Date(expense.expense_date);
      return expenseDate >= thisMonthRange.start && expenseDate < thisMonthRange.end;
    });
    const thisMonthTotal = thisMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    return {
      totalExpenses,
      totalTaxAmount,
      thisMonthTotal,
      expenseCount: filteredExpenses.length,
      thisMonthCount: thisMonthExpenses.length,
    };
  }, [filteredExpenses, expenses]);

  // Auto-calculate tax based on category rules
  const calculateTax = (amount: number, categoryName: string) => {
    const defaultTaxRates: { [key: string]: number } = {
      'Office Supplies': 0.08,
      'Travel': 0.05,
      'Meals': 0.10,
      'Equipment': 0.08,
      'Software': 0.00,
      'Professional Services': 0.00,
      'Projects': 0.08,
    };
    
    const taxRate = defaultTaxRates[categoryName] || 0.08; // Default 8% tax
    return {
      taxRate,
      taxAmount: amount * taxRate
    };
  };

  // Handle amount or category change to auto-calculate tax
  const handleAmountOrCategoryChange = (field: string, value: string) => {
    setNewExpense(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate tax if not manually overridden
      if (!updated.manualTaxOverride && updated.amount && updated.category) {
        const amount = parseFloat(updated.amount);
        if (!isNaN(amount)) {
          const { taxRate, taxAmount } = calculateTax(amount, updated.category);
          updated.taxRate = (taxRate * 100).toString(); // Convert to percentage
          updated.taxAmount = taxAmount.toFixed(2);
        }
      }
      
      return updated;
    });
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount || !newExpense.projectId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const amount = parseFloat(newExpense.amount);
      const taxRate = newExpense.taxRate ? parseFloat(newExpense.taxRate) / 100 : 0;
      const taxAmount = newExpense.taxAmount ? parseFloat(newExpense.taxAmount) : 0;

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          project_id: newExpense.projectId,
          expense_date: newExpense.date,
          description: newExpense.description,
          category: newExpense.category,
          amount: amount,
          payment_method: newExpense.paymentMethod || null,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          manual_tax_override: newExpense.manualTaxOverride,
          organization_id: undefined // Will be set by RLS
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Expense added successfully.",
      });

      // Refresh expenses
      await fetchExpenses();
      
      setIsAddDialogOpen(false);
      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        vendor: "",
        vendorId: "",
        description: "",
        category: "",
        categoryId: "",
        amount: "",
        paymentMethod: "",
        reference: "",
        projectId: "",
        taxRate: "",
        taxAmount: "",
        manualTaxOverride: false,
      });
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        title: "Error",
        description: "Failed to add expense. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Financial Expenses</h1>
            <p className="text-muted-foreground">
              Track and manage all your business expenses
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>
                  Record a new business expense for tracking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newExpense.amount}
                      onChange={(e) => handleAmountOrCategoryChange('amount', e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="project">Project *</Label>
                  <Select value={newExpense.projectId} onValueChange={(value) => setNewExpense({ ...newExpense, projectId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.filter(v => v.type === 'project').map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} ({project.client_name || 'No client'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What was this expense for?"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Combobox
                      options={categories.map(category => ({ value: category.name, label: category.name }))}
                      value={newExpense.category}
                      onSelect={(value) => handleAmountOrCategoryChange('category', value)}
                      onCreateNew={handleCategoryCreate}
                      placeholder="Select category..."
                      searchPlaceholder="Search categories..."
                      emptyText="No categories found."
                      createNewText="Create category"
                    />
                  </div>
                  <div>
                    <Label htmlFor="payment">Payment Method</Label>
                    <Select value={newExpense.paymentMethod} onValueChange={(value) => setNewExpense({ ...newExpense, paymentMethod: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tax Calculation Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <Label className="text-sm font-medium">Tax Calculation</Label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taxRate">Tax Rate (%)</Label>
                      <Input
                        id="taxRate"
                        type="number"
                        step="0.01"
                        placeholder="8.00"
                        value={newExpense.taxRate}
                        onChange={(e) => {
                          const taxRate = parseFloat(e.target.value) || 0;
                          const amount = parseFloat(newExpense.amount) || 0;
                          setNewExpense(prev => ({
                            ...prev,
                            taxRate: e.target.value,
                            taxAmount: (amount * taxRate / 100).toFixed(2),
                            manualTaxOverride: true
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxAmount">Tax Amount</Label>
                      <Input
                        id="taxAmount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newExpense.taxAmount}
                        onChange={(e) => setNewExpense(prev => ({
                          ...prev,
                          taxAmount: e.target.value,
                          manualTaxOverride: true
                        }))}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="manualTaxOverride"
                      checked={newExpense.manualTaxOverride}
                      onCheckedChange={(checked) => setNewExpense(prev => ({
                        ...prev,
                        manualTaxOverride: !!checked
                      }))}
                    />
                    <Label htmlFor="manualTaxOverride" className="text-sm">
                      Manual tax override (disable auto-calculation)
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddExpense} className="flex-1">
                    Add Expense
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summaryMetrics.totalExpenses)}</div>
              <p className="text-xs text-muted-foreground">
                {summaryMetrics.expenseCount} transactions
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tax Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{formatCurrency(summaryMetrics.totalTaxAmount)}</div>
              <p className="text-xs text-muted-foreground">
                Tax on current expenses
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summaryMetrics.thisMonthTotal)}</div>
              <p className="text-xs text-muted-foreground">
                {summaryMetrics.thisMonthCount} transactions this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search expenses by description, category, or project..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {vendors.filter(v => v.type === 'project').map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading expenses...
                      </TableCell>
                    </TableRow>
                  ) : filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No expenses found. Add your first expense to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">
                          {new Date(expense.expense_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-sm">Project Expense</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell>
                          {expense.payment_method || <span className="text-muted-foreground text-sm">-</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {expense.project_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {expense.tax_amount && expense.tax_amount > 0 ? (
                            <div className="flex flex-col">
                              <span className="font-medium">{formatCurrency(expense.tax_amount)}</span>
                              <span className="text-xs text-muted-foreground">
                                {(expense.tax_rate! * 100).toFixed(1)}%
                                {expense.manual_tax_override && " (manual)"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No tax</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Creation Dialog */}
      <VendorCreateDialog
        open={isVendorDialogOpen}
        onOpenChange={setIsVendorDialogOpen}
        categories={categories}
        onVendorCreated={(vendor) => {
          setVendors(prev => [...prev, vendor]);
          setNewExpense(prev => ({
            ...prev,
            vendorId: vendor.id,
            vendor: vendor.name,
            categoryId: vendor.default_category_id || "",
            category: categories.find(c => c.id === vendor.default_category_id)?.name || "",
          }));
        }}
        onCategoryCreated={(category) => {
          setCategories(prev => [...prev, category]);
        }}
      />
    </div>
  );
}