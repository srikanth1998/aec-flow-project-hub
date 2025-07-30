import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Calendar, Upload } from "lucide-react";
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
}

export const ProjectExpenses = ({ organizationId, projectId }: ProjectExpensesProps) => {
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

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  if (loading) {
    return <div>Loading expenses...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Expenses</CardTitle>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Total: {formatCurrency(totalExpenses)}
            </span>
            <Button onClick={() => setShowAddRow(true)} disabled={showAddRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
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
                  {expense.receipt_url ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
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
  );
};