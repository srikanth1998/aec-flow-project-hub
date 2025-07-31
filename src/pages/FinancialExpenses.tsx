import { useState, useEffect } from "react";
import { Plus, Search, Filter, Calendar, Receipt, Edit, Trash2 } from "lucide-react";
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
  type?: 'vendor' | 'project';
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Expense {
  id: string;
  date: string;
  vendor: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  taxDeductible: boolean;
  receipt?: string;
  projectId?: string;
  projectName?: string;
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
    taxDeductible: false,
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
          name: `${project.name} (${project.client_name})`,
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
      // For now, we'll just show empty array until we properly connect DB
      setExpenses([]);
    } catch (error) {
      console.error('Error fetching expenses:', error);
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
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({
          name: categoryName,
          organization_id: undefined // Will be set by RLS
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

    // Auto-select category if vendor has default category
    if (vendor.default_category_id) {
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

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = 
      expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.reference.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const taxDeductibleTotal = filteredExpenses
    .filter(expense => expense.taxDeductible)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const handleAddExpense = () => {
    if (!newExpense.vendor || !newExpense.description || !newExpense.amount) return;
    
    const expense: Expense = {
      id: Date.now().toString(),
      date: newExpense.date,
      vendor: newExpense.vendor,
      description: newExpense.description,
      category: newExpense.category,
      amount: parseFloat(newExpense.amount),
      paymentMethod: newExpense.paymentMethod,
      reference: newExpense.reference,
      taxDeductible: newExpense.taxDeductible,
    };

    setExpenses([expense, ...expenses]);
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
      taxDeductible: false,
    });
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
                      onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="vendor">Vendor/Payee</Label>
                  <Combobox
                    options={vendors.map(vendor => ({ 
                      value: vendor.id, 
                      label: vendor.type === 'project' ? `📁 ${vendor.name}` : vendor.name 
                    }))}
                    value={newExpense.vendorId}
                    onSelect={handleVendorSelect}
                    onCreateNew={handleVendorCreate}
                    placeholder="Select vendor or project..."
                    searchPlaceholder="Search vendors and projects..."
                    emptyText="No vendors or projects found."
                    createNewText="Create vendor"
                  />
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
                      options={categories.map(category => ({ value: category.id, label: category.name }))}
                      value={newExpense.categoryId}
                      onSelect={handleCategorySelect}
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

                <div>
                  <Label htmlFor="reference">Reference/Receipt #</Label>
                  <Input
                    id="reference"
                    placeholder="Receipt or reference number"
                    value={newExpense.reference}
                    onChange={(e) => setNewExpense({ ...newExpense, reference: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="taxDeductible"
                    checked={newExpense.taxDeductible}
                    onCheckedChange={(checked) => setNewExpense({ ...newExpense, taxDeductible: !!checked })}
                  />
                  <Label htmlFor="taxDeductible">Tax deductible expense</Label>
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
              <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
              <p className="text-xs text-muted-foreground">
                {filteredExpenses.length} transactions
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tax Deductible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(taxDeductibleTotal)}</div>
              <p className="text-xs text-muted-foreground">
                {filteredExpenses.filter(e => e.taxDeductible).length} eligible expenses
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
              <div className="text-2xl font-bold">{formatCurrency(totalExpenses * 0.3)}</div>
              <p className="text-xs text-muted-foreground">
                30% of total expenses
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search expenses by vendor, description, or reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
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
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {new Date(expense.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{expense.vendor}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>{expense.paymentMethod}</TableCell>
                      <TableCell>
                        {expense.projectName ? (
                          <Badge variant="outline" className="text-xs">
                            {expense.projectName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">General</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {expense.taxDeductible ? (
                          <Badge variant="default" className="bg-success text-success-foreground">
                            Deductible
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
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
                  ))}
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