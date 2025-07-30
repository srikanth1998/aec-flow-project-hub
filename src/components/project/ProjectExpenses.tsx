import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Calendar, Upload, X, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string | null;
  receipt_url: string | null;
}

interface ProjectExpensesProps {
  organizationId: string;
  projectId: string;
  project: any;
}

export const ProjectExpenses = ({ organizationId, projectId, project }: ProjectExpensesProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [newExpense, setNewExpense] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    category: "",
    description: "",
    amount: "",
    payment_method: "",
  });
  const [showAddRow, setShowAddRow] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchExpenses();
  }, [projectId]);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("project_id", projectId)
        .eq("organization_id", organizationId)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({
        title: "Error",
        description: "Failed to fetch expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.category || !newExpense.description || !newExpense.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert([
          {
            project_id: projectId,
            organization_id: organizationId,
            expense_date: newExpense.expense_date,
            category: newExpense.category,
            description: newExpense.description,
            amount: parseFloat(newExpense.amount),
            payment_method: newExpense.payment_method || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setExpenses([data, ...expenses]);
      setNewExpense({
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        category: "",
        description: "",
        amount: "",
        payment_method: "",
      });
      setShowAddRow(false);

      toast({
        title: "Success",
        description: "Expense added successfully",
      });
    } catch (error) {
      console.error("Error adding expense:", error);
      toast({
        title: "Error",
        description: "Failed to add expense",
        variant: "destructive",
      });
    }
  };

  const handleUpdateExpense = async (expense: Expense) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          expense_date: expense.expense_date,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          payment_method: expense.payment_method,
        })
        .eq("id", expense.id);

      if (error) throw error;

      setExpenses(expenses.map(e => e.id === expense.id ? expense : e));
      setEditingExpense(null);

      toast({
        title: "Success",
        description: "Expense updated successfully",
      });
    } catch (error) {
      console.error("Error updating expense:", error);
      toast({
        title: "Error",
        description: "Failed to update expense",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);

      if (error) throw error;

      setExpenses(expenses.filter(e => e.id !== expenseId));

      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense",
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

  const handleFileUpload = async (file: File, expenseId: string) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Only PNG, JPG, and PDF files are allowed",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(expenseId);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${userData.user.id}/${expenseId}/receipt.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Update the expense with the receipt URL
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_url: publicUrl })
        .eq('id', expenseId);

      if (updateError) throw updateError;

      // Update local state
      setExpenses(expenses.map(e => 
        e.id === expenseId ? { ...e, receipt_url: publicUrl } : e
      ));

      toast({
        title: "Success",
        description: "Receipt uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload receipt",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveReceipt = async (expenseId: string, receiptUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = receiptUrl.split('/receipts/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        
        const { error: deleteError } = await supabase.storage
          .from('receipts')
          .remove([filePath]);

        if (deleteError) throw deleteError;
      }

      // Update the expense to remove receipt URL
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_url: null })
        .eq('id', expenseId);

      if (updateError) throw updateError;

      // Update local state
      setExpenses(expenses.map(e => 
        e.id === expenseId ? { ...e, receipt_url: null } : e
      ));

      toast({
        title: "Success",
        description: "Receipt removed successfully",
      });
    } catch (error) {
      console.error("Error removing receipt:", error);
      toast({
        title: "Error",
        description: "Failed to remove receipt",
        variant: "destructive",
      });
    }
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.split('.')[0] === 'receipt' ? 
      `receipt.${fileName.split('.')[1]}` : fileName;
  };

  const isImage = (url: string) => {
    return url.match(/\.(jpg|jpeg|png)$/i);
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalBudget = project?.estimated_budget || 0;
  const balance = totalBudget - totalExpenses;

  if (loading) {
    return <div>Loading expenses...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Balance</p>
              <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Expenses</CardTitle>
            <Button onClick={() => setShowAddRow(true)} disabled={showAddRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showAddRow && (
              <TableRow>
                <TableCell>
                  <Input
                    type="date"
                    value={newExpense.expense_date}
                    onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Category"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Description"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Payment Method"
                    value={newExpense.payment_method}
                    onChange={(e) => setNewExpense({ ...newExpense, payment_method: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" disabled>
                    <Upload className="h-4 w-4" />
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddExpense}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAddRow(false);
                        setNewExpense({
                          expense_date: format(new Date(), 'yyyy-MM-dd'),
                          category: "",
                          description: "",
                          amount: "",
                          payment_method: "",
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  {editingExpense?.id === expense.id ? (
                    <Input
                      type="date"
                      value={editingExpense.expense_date}
                      onChange={(e) => setEditingExpense({ ...editingExpense, expense_date: e.target.value })}
                    />
                  ) : (
                    format(new Date(expense.expense_date), 'MMM dd, yyyy')
                  )}
                </TableCell>
                <TableCell>
                  {editingExpense?.id === expense.id ? (
                    <Input
                      value={editingExpense.category}
                      onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                    />
                  ) : (
                    expense.category
                  )}
                </TableCell>
                <TableCell>
                  {editingExpense?.id === expense.id ? (
                    <Input
                      value={editingExpense.description}
                      onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                    />
                  ) : (
                    expense.description
                  )}
                </TableCell>
                <TableCell>
                  {editingExpense?.id === expense.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editingExpense.amount}
                      onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })}
                    />
                  ) : (
                    formatCurrency(expense.amount)
                  )}
                </TableCell>
                <TableCell>
                  {editingExpense?.id === expense.id ? (
                    <Input
                      value={editingExpense.payment_method || ""}
                      onChange={(e) => setEditingExpense({ ...editingExpense, payment_method: e.target.value })}
                    />
                  ) : (
                    expense.payment_method || "-"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {expense.receipt_url ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(expense.receipt_url!, '_blank')}
                          className="flex items-center gap-1"
                        >
                          {isImage(expense.receipt_url) ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span className="text-xs truncate max-w-16">
                            {getFileName(expense.receipt_url)}
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveReceipt(expense.id, expense.receipt_url!)}
                          className="p-1"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <input
                          type="file"
                          ref={(el) => fileInputRefs.current[expense.id] = el}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, expense.id);
                          }}
                          accept=".png,.jpg,.jpeg,.pdf"
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[expense.id]?.click()}
                          disabled={uploading === expense.id}
                          className="flex items-center gap-1"
                        >
                          <Upload className="h-3 w-3" />
                          {uploading === expense.id ? 'Uploading...' : 'Upload'}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {editingExpense?.id === expense.id ? (
                      <>
                        <Button size="sm" onClick={() => handleUpdateExpense(editingExpense)}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingExpense(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingExpense(expense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && !showAddRow && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No expenses recorded yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      </Card>
    </div>
  );
};