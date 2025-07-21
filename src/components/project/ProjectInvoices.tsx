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
  payment_status?: string;
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
  payment_status?: string;
  payment_date?: string | null;
  amount_paid?: number;
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
      // First get all services for the organization
      const { data: allServices, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (servicesError) throw servicesError;

      // Then get services that are already invoiced for this project
      const { data: invoicedServices, error: invoicedError } = await supabase
        .from("invoice_items")
        .select(`
          service_id,
          invoices!inner(project_id)
        `)
        .eq("invoices.project_id", projectId)
        .not("service_id", "is", null);

      if (invoicedError) throw invoicedError;

      // Get list of service IDs that are already invoiced
      const invoicedServiceIds = new Set(
        invoicedServices?.map(item => item.service_id) || []
      );

      // Filter out already invoiced services
      const availableServices = allServices?.filter(
        service => !invoicedServiceIds.has(service.id)
      ) || [];

      setServices(availableServices);
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

  const loadAllServicesIntoInvoice = async () => {
    try {
      // Get all services for the organization
      const { data: allServices, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");

      if (servicesError) throw servicesError;

      // Get all invoices for this project
      const { data: projectInvoices, error: invoicesError } = await supabase
        .from("invoices")
        .select(`
          id,
          invoice_items (
            service_id,
            total_price
          )
        `)
        .eq("project_id", projectId);

      if (invoicesError) throw invoicesError;

      // Get all payments for this project
      const { data: allPayments, error: paymentsError } = await supabase
        .from("payments")
        .select(`
          amount,
          payment_date,
          invoice_id
        `);

      if (paymentsError) throw paymentsError;

      // Create maps for service billing and payments
      const servicePayments = new Map();
      
      // Calculate payments per service
      projectInvoices?.forEach(invoice => {
        const invoicePayments = allPayments?.filter(p => p.invoice_id === invoice.id) || [];
        const totalInvoicePayments = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
        
        invoice.invoice_items?.forEach(item => {
          if (item.service_id) {
            if (!servicePayments.has(item.service_id)) {
              servicePayments.set(item.service_id, { totalPaid: 0, lastPaymentDate: null });
            }
            
            // Distribute payment proportionally if there are multiple items
            const itemShare = item.total_price / (invoice.invoice_items?.reduce((sum, i) => sum + i.total_price, 0) || 1);
            const itemPayment = totalInvoicePayments * itemShare;
            
            const current = servicePayments.get(item.service_id);
            current.totalPaid += itemPayment;
            
            // Get the latest payment date for this invoice
            const latestPayment = invoicePayments.sort((a, b) => 
              new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
            )[0];
            
            if (latestPayment && (!current.lastPaymentDate || 
                new Date(latestPayment.payment_date) > new Date(current.lastPaymentDate))) {
              current.lastPaymentDate = latestPayment.payment_date;
            }
          }
        });
      });

      // Create invoice items for all services with payment status
      const serviceItems = allServices?.map((service) => {
        const paymentInfo = servicePayments.get(service.id) || { totalPaid: 0, lastPaymentDate: null };
        const isPaid = paymentInfo.totalPaid >= service.unit_price;

        return {
          id: `temp-${service.id}`,
          service_id: service.id,
          description: service.name,
          quantity: 1,
          unit_price: service.unit_price,
          total_price: service.unit_price,
          payment_status: isPaid ? 'paid' : 'unpaid',
          payment_date: paymentInfo.lastPaymentDate,
          amount_paid: paymentInfo.totalPaid
        };
      }) || [];

      setInvoiceItems(serviceItems);
    } catch (error) {
      console.error("Error loading services:", error);
    }
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
    
    // Load all services into invoice by default
    loadAllServicesIntoInvoice();
    
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
      
      if (editingInvoice) {
        // Update existing invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            invoice_number: formData.invoice_number,
            total_amount: totalAmount,
            due_date: formData.due_date || null,
            notes: formData.notes || null,
          })
          .eq("id", editingInvoice.id);

        if (invoiceError) throw invoiceError;

        // Delete existing invoice items
        const { error: deleteError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", editingInvoice.id);

        if (deleteError) throw deleteError;

        // Insert updated invoice items
        const itemsData = invoiceItems.map((item) => ({
          invoice_id: editingInvoice.id,
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
          description: "Invoice updated successfully",
        });
      } else {
        // Create new invoice
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
      }

      setDialogOpen(false);
      setFormData({ invoice_number: "", due_date: "", notes: "" });
      setInvoiceItems([]);
      setEditingInvoice(null);
      fetchInvoices();
      fetchServices(); // Refresh services to update availability
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: `Failed to ${editingInvoice ? 'update' : 'create'} invoice`,
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

  const handleEditInvoice = async (invoice: Invoice) => {
    try {
      // Fetch existing invoice items
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      // Set up form data for editing
      setFormData({
        invoice_number: invoice.invoice_number,
        due_date: invoice.due_date || "",
        notes: invoice.notes || "",
      });

      // Set up invoice items
      setInvoiceItems(items || []);
      setEditingInvoice(invoice);
      setDialogOpen(true);
    } catch (error) {
      console.error("Error loading invoice for editing:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice for editing",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      return;
    }

    try {
      // First delete invoice items
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      // Then delete the invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      fetchInvoices();
      fetchServices(); // Refresh services to make them available again
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    // Get all services for this organization
    const { data: allServices, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      return;
    }

    // Get all invoices for this project to calculate payment status
    const { data: projectInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_items (
          service_id,
          total_price
        )
      `)
      .eq('project_id', projectId);

    if (invoicesError) {
      console.error('Error fetching project invoices:', invoicesError);
      return;
    }

    // Get all payments for this project
    const { data: allPayments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        amount,
        payment_date,
        invoice_id
      `);

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      return;
    }

    // Calculate payment status for each service
    const servicePayments = new Map();
    
    projectInvoices?.forEach(inv => {
      const invoicePayments = allPayments?.filter(p => p.invoice_id === inv.id) || [];
      const totalInvoicePayments = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
      
      inv.invoice_items?.forEach(item => {
        if (item.service_id) {
          if (!servicePayments.has(item.service_id)) {
            servicePayments.set(item.service_id, { totalPaid: 0, lastPaymentDate: null });
          }
          
          const itemShare = item.total_price / (inv.invoice_items?.reduce((sum, i) => sum + i.total_price, 0) || 1);
          const itemPayment = totalInvoicePayments * itemShare;
          
          const current = servicePayments.get(item.service_id);
          current.totalPaid += itemPayment;
          
          const latestPayment = invoicePayments.sort((a, b) => 
            new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
          )[0];
          
          if (latestPayment && (!current.lastPaymentDate || 
              new Date(latestPayment.payment_date) > new Date(current.lastPaymentDate))) {
            current.lastPaymentDate = latestPayment.payment_date;
          }
        }
      });
    });

    // Categorize services
    const paidServices = [];
    const currentService = [];
    const futureServices = [];
    let totalProjectCost = 0;
    let totalPaid = 0;

    allServices?.forEach(service => {
      const paymentInfo = servicePayments.get(service.id) || { totalPaid: 0, lastPaymentDate: null };
      const isPaid = paymentInfo.totalPaid >= service.unit_price;
      totalProjectCost += service.unit_price;
      totalPaid += paymentInfo.totalPaid;

      if (isPaid) {
        paidServices.push({
          ...service,
          paymentDate: paymentInfo.lastPaymentDate,
          amountPaid: paymentInfo.totalPaid
        });
      } else if (paymentInfo.totalPaid > 0) {
        currentService.push({
          ...service,
          amountPaid: paymentInfo.totalPaid,
          balanceDue: service.unit_price - paymentInfo.totalPaid
        });
      } else {
        futureServices.push(service);
      }
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 40px;
              line-height: 1.6;
              color: #333;
              background: white;
            }
            
            .invoice-container {
              max-width: 700px;
              margin: 0 auto;
            }
            
            .header {
              text-align: center;
              margin-bottom: 40px;
            }
            
            .company-name {
              font-size: 18px;
              font-weight: bold;
              color: #333;
              margin-bottom: 5px;
              text-transform: uppercase;
              letter-spacing: 3px;
            }
            
            .company-info {
              font-size: 11px;
              color: #333;
              line-height: 1.3;
            }
            
            .service-header {
              font-size: 14px;
              font-weight: bold;
              margin: 30px 0 15px 0;
              display: flex;
              justify-content: space-between;
              border-bottom: 1px solid #333;
              padding-bottom: 5px;
            }
            
            .service-line {
              font-size: 12px;
              margin: 8px 0;
              padding-left: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .paid-item {
              color: #28a745;
            }
            
            .current-item {
              color: #dc3545;
              font-weight: bold;
            }
            
            .future-item {
              color: #6c757d;
            }
            
            .balance-line {
              font-size: 12px;
              font-weight: bold;
              margin: 15px 0;
              display: flex;
              justify-content: space-between;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            
            .due-line {
              font-size: 12px;
              margin: 8px 0;
              padding-left: 40px;
              display: flex;
              justify-content: space-between;
              text-decoration: underline;
            }
            
            .balance-section {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #333;
            }
            
            .balance-due {
              text-align: right;
              font-size: 12px;
            }
            
            .balance-amount {
              color: #dc3545;
              font-weight: bold;
              text-decoration: underline;
            }
            
            .footer {
              margin-top: 50px;
              font-size: 12px;
              line-height: 1.4;
            }
            
            .signature {
              margin-top: 20px;
              color: #007bff;
              text-decoration: underline;
            }
            
            @media print {
              body { 
                margin: 0; 
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="company-name">SQUARE CENTER, ARCHITECTURE DESIGN STUDIO</div>
              <div class="company-info">
                85 Lawrence Ave, West Orange NJ 07052<br>
                Office 973 685 5454 Cell 973.495.2452
              </div>
            </div>
            
            <div class="date">
              ${new Date(invoice.issue_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            
            <div class="client-info">
              ${project?.client_name || 'Client Name'}<br>
              ${project?.client_email ? `<a href="mailto:${project.client_email}" style="color: #007bff; text-decoration: underline;">${project.client_email}</a><br>` : ''}
              ${project?.client_phone || ''}
            </div>
            
            <div class="subject">
              <strong>RE:</strong> ${project?.name || 'Architectural Services'}: ${project?.project_address || 'interior remodel, living/dining room, kitchen and mud/laundry room'}
            </div>
            
            <div class="project-address">
              ${project?.project_address || 'Project Address'}<br>
              Block 600 Lot 13
            </div>
            
            <div class="intro-text">
              The following outlines the cost and expense associated with Architectural services:
            </div>
            
            <div class="service-header">
              <span>Architectural</span>
              <span>$${totalProjectCost.toFixed(2)}</span>
            </div>
            
            ${paidServices.map(service => `
              <div class="service-line paid-item">
                <span>Initial Retainer:</span>
                <span>Pd- ${service.paymentDate ? new Date(service.paymentDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : ''} &lt;$${service.unit_price.toFixed(2)}&gt;</span>
              </div>
            `).join('')}
            
            ${currentService.map(service => `
              <div class="service-line current-item">
                <span>${service.name}</span>
                <span>$${service.balanceDue.toFixed(2)}</span>
              </div>
              <div class="due-line">
                <span>Due upon receipt – ${service.name} Fee</span>
                <span>___     $${service.balanceDue.toFixed(2)}</span>
              </div>
            `).join('')}
            
            <div class="balance-line">
              <span>Balance to Finish:</span>
              <span>$${(totalProjectCost - totalPaid - currentService.reduce((sum, s) => sum + s.balanceDue, 0)).toFixed(2)}</span>
            </div>
            
            ${futureServices.map(service => `
              <div class="service-line future-item">
                <span>${service.name}</span>
                <span>$${service.unit_price.toFixed(2)}</span>
              </div>
            `).join('')}
            
            <div class="footer">
              <p>Thank you, It's been my pleasure working with you.</p>
              <p>Respectfully yours,</p>
              <br>
              <p><strong>William Gentile, Architect,</strong><br>
              <a href="mailto:william.squarecenter@gmail.com" class="signature">william.squarecenter@gmail.com</a></p>
            </div>
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
                          onClick={() => handleEditInvoice(invoice)}
                          title="Edit Invoice"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
            <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
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
                <Button type="submit">{editingInvoice ? "Update Invoice" : "Create Invoice"}</Button>
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