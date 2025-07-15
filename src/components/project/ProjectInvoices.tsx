import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Printer, DollarSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  unit_price: number;
  unit: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
}

interface InvoiceItem {
  id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ProjectInvoicesProps {
  projectId: string;
  organizationId: string;
}

interface Project {
  id: string;
  name: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  project_address: string | null;
}

interface Organization {
  id: string;
  name: string;
}

export const ProjectInvoices = ({ projectId, organizationId }: ProjectInvoicesProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [formData, setFormData] = useState({
    invoice_number: "",
    due_date: "",
    notes: "",
  });
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
    fetchServices();
    fetchProject();
    fetchOrganization();
  }, [projectId, organizationId]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, client_name, client_email, client_phone, project_address")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  };

  const fetchOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .single();

      if (error) throw error;
      setOrganization(data);
    } catch (error) {
      console.error("Error fetching organization:", error);
    }
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${timestamp}`;
  };

  const handleCreateInvoice = async () => {
    if (services.length === 0) {
      toast({
        title: "No Services",
        description: "Please add services first before creating an invoice",
        variant: "destructive",
      });
      return;
    }

    const invoiceNumber = generateInvoiceNumber();
    setFormData({
      invoice_number: invoiceNumber,
      due_date: "",
      notes: "",
    });
    setInvoiceItems([]);
    setEditingInvoice(null);
    setDialogOpen(true);
  };

  const addInvoiceItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      {
        id: `temp-${Date.now()}`,
        service_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      },
    ]);
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const updatedItems = [...invoiceItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === "service_id" && value) {
      const service = services.find((s) => s.id === value);
      if (service) {
        updatedItems[index].description = service.name;
        updatedItems[index].unit_price = service.unit_price;
        updatedItems[index].total_price = 
          updatedItems[index].quantity * service.unit_price;
      }
    }

    if (field === "quantity" || field === "unit_price") {
      updatedItems[index].total_price =
        updatedItems[index].quantity * updatedItems[index].unit_price;
    }

    setInvoiceItems(updatedItems);
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const calculateTotalAmount = () => {
    return invoiceItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invoiceItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the invoice",
        variant: "destructive",
      });
      return;
    }

    try {
      const totalAmount = calculateTotalAmount();
      
      const invoiceData = {
        project_id: projectId,
        organization_id: organizationId,
        invoice_number: formData.invoice_number,
        total_amount: totalAmount,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice items
      const itemsData = invoiceItems.map((item) => ({
        invoice_id: invoice.id,
        service_id: item.service_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsData);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      setDialogOpen(false);
      setFormData({ invoice_number: "", due_date: "", notes: "" });
      setInvoiceItems([]);
      fetchInvoices();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoice || !paymentData.amount) {
      toast({
        title: "Error",
        description: "Please enter a payment amount",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("payments")
        .insert({
          invoice_id: selectedInvoice.id,
          amount: parseFloat(paymentData.amount),
          payment_method: paymentData.payment_method,
          notes: paymentData.notes || null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });

      setPaymentDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentData({ amount: "", payment_method: "cash", notes: "" });
      fetchInvoices();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        title: "Error",
        description: "Failed to record payment",
        variant: "destructive",
      });
    }
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice ${invoice.invoice_number}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 40px; 
                line-height: 1.4;
                color: #333;
              }
              .invoice-header { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 40px; 
                border-bottom: 2px solid #007bff;
                padding-bottom: 20px;
              }
              .company-info h1 { 
                color: #007bff; 
                margin: 0; 
                font-size: 32px;
              }
              .invoice-title { 
                text-align: right; 
                font-size: 24px; 
                color: #666;
              }
              .billing-info { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 40px; 
              }
              .bill-to, .bill-from { 
                flex: 1; 
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                margin: 0 10px;
              }
              .bill-to h3, .bill-from h3 { 
                margin: 0 0 15px 0; 
                color: #007bff; 
                border-bottom: 1px solid #dee2e6;
                padding-bottom: 8px;
              }
              .invoice-details { 
                margin-bottom: 40px; 
                padding: 20px;
                background: #fff;
                border: 1px solid #dee2e6;
                border-radius: 8px;
              }
              .invoice-details table { 
                width: 100%; 
                border-collapse: collapse; 
              }
              .invoice-details th, .invoice-details td { 
                padding: 12px; 
                border-bottom: 1px solid #dee2e6; 
                text-align: left;
              }
              .invoice-details th { 
                background: #f8f9fa; 
                font-weight: bold;
                color: #495057;
              }
              .payment-summary { 
                text-align: right; 
                margin-top: 30px; 
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
              }
              .payment-summary table { 
                margin-left: auto; 
                min-width: 300px;
              }
              .payment-summary tr.total { 
                border-top: 2px solid #007bff; 
                font-weight: bold; 
                font-size: 18px;
                color: #007bff;
              }
              .notes { 
                margin-top: 30px; 
                padding: 20px;
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
              }
              .payment-status {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                text-transform: uppercase;
                font-size: 12px;
              }
              .status-paid { background: #d4edda; color: #155724; }
              .status-pending { background: #fff3cd; color: #856404; }
              .status-overdue { background: #f8d7da; color: #721c24; }
            </style>
          </head>
          <body>
            <div class="invoice-header">
              <div class="company-info">
                <h1>${organization?.name || 'Your Company'}</h1>
                <p>Professional Services</p>
              </div>
              <div class="invoice-title">
                <h2>INVOICE</h2>
                <p><strong>${invoice.invoice_number}</strong></p>
                <div class="payment-status status-${invoice.balance_due > 0 ? 'pending' : 'paid'}">
                  ${invoice.balance_due > 0 ? 'Payment Due' : 'Paid in Full'}
                </div>
              </div>
            </div>
            
            <div class="billing-info">
              <div class="bill-from">
                <h3>Bill From:</h3>
                <p><strong>${organization?.name || 'Your Company'}</strong></p>
                <p>Your Address<br>City, State ZIP<br>Phone: (555) 123-4567<br>Email: info@company.com</p>
              </div>
              <div class="bill-to">
                <h3>Bill To:</h3>
                <p><strong>${project?.client_name || 'Client Name'}</strong></p>
                <p>${project?.project_address || 'Client Address'}</p>
                ${project?.client_email ? `<p>Email: ${project.client_email}</p>` : ''}
                ${project?.client_phone ? `<p>Phone: ${project.client_phone}</p>` : ''}
                <p><strong>Project:</strong> ${project?.name || 'Project Name'}</p>
              </div>
            </div>
            
            <div class="invoice-details">
              <table>
                <tr>
                  <th><strong>Invoice Date:</strong></th>
                  <td>${new Date(invoice.issue_date).toLocaleDateString()}</td>
                  <th><strong>Due Date:</strong></th>
                  <td>${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon Receipt'}</td>
                </tr>
              </table>
            </div>
            
            <div class="payment-summary">
              <table>
                <tr>
                  <td><strong>Total Amount:</strong></td>
                  <td>$${invoice.total_amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td><strong>Amount Paid:</strong></td>
                  <td>$${invoice.paid_amount.toFixed(2)}</td>
                </tr>
                <tr class="total">
                  <td><strong>Balance Due:</strong></td>
                  <td><strong>$${invoice.balance_due.toFixed(2)}</strong></td>
                </tr>
              </table>
            </div>
            
            ${invoice.notes ? `
              <div class="notes">
                <h4>Additional Notes:</h4>
                <p>${invoice.notes}</p>
              </div>
            ` : ''}
            
            <div style="margin-top: 50px; text-align: center; color: #666; font-size: 12px;">
              <p>Thank you for your business!</p>
              <p>Payment Terms: Net 30 Days | Late fees may apply after due date</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };
    
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || statusColors.draft}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return <div className="p-6">Loading invoices...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Project Invoices</h2>
        <Button onClick={handleCreateInvoice}>
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices created yet. Create your first invoice to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                    <TableCell>${invoice.total_amount.toFixed(2)}</TableCell>
                    <TableCell>${invoice.paid_amount.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">
                      ${invoice.balance_due.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePrintInvoice(invoice)}
                          title="Print Invoice"
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setPaymentDialogOpen(true);
                          }}
                          title="Record Payment"
                          disabled={invoice.balance_due <= 0}
                        >
                          <DollarSign className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitInvoice} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <Label>Invoice Items</Label>
                <Button type="button" onClick={addInvoiceItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
              
              {invoiceItems.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 mb-4 p-4 border rounded">
                  <div className="col-span-3">
                    <Label>Service</Label>
                    <Select
                      value={item.service_id || ""}
                      onValueChange={(value) => updateInvoiceItem(index, "service_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} (${service.unit_price}/{service.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label>Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateInvoiceItem(index, "description", e.target.value)}
                      placeholder="Service description"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateInvoiceItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateInvoiceItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>Total</Label>
                    <div className="text-sm font-medium pt-2">
                      ${item.total_price.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1 flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInvoiceItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-between items-center">
              <div className="text-xl font-bold">
                Total: ${calculateTotalAmount().toFixed(2)}
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create Invoice</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Invoice: {selectedInvoice.invoice_number}<br />
                Balance Due: ${selectedInvoice.balance_due.toFixed(2)}
              </div>
              
              <div>
                <Label htmlFor="payment_amount">Payment Amount ($)</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  placeholder="0.00"
                  max={selectedInvoice.balance_due}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select
                  value={paymentData.payment_method}
                  onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="payment_notes">Notes</Label>
                <Textarea
                  id="payment_notes"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Payment notes..."
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">Record Payment</Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setPaymentDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};