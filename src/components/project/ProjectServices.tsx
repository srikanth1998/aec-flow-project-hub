import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  unit: string;
  payment_status: string;
  project_id: string;
}

interface ProjectServicesProps {
  organizationId: string;
  projectId: string;
}

export const ProjectServices = ({ organizationId, projectId }: ProjectServicesProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [invoiceFormData, setInvoiceFormData] = useState({
    invoice_number: "",
    due_date: "",
    notes: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unit_price: "",
    unit: "hour",
    payment_status: "unpaid"
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, [organizationId, projectId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("project_id", projectId)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to fetch services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.unit_price) {
      toast({
        title: "Error",
        description: "Name and unit price are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const serviceData = {
        name: formData.name,
        description: formData.description || null,
        unit_price: parseFloat(formData.unit_price),
        unit: formData.unit,
        payment_status: formData.payment_status,
        organization_id: organizationId,
        project_id: projectId,
      };

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingService.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Service updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("services")
          .insert(serviceData);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Service created successfully",
        });
      }

      setDialogOpen(false);
      setEditingService(null);
      setFormData({ name: "", description: "", unit_price: "", unit: "hour", payment_status: "unpaid" });
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      unit_price: service.unit_price.toString(),
      unit: service.unit,
      payment_status: service.payment_status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingService(null);
    setFormData({ name: "", description: "", unit_price: "", unit: "hour", payment_status: "unpaid" });
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${timestamp}`;
  };

  const handleGenerateInvoice = () => {
    setSelectedServices([]);
    setInvoiceFormData({
      invoice_number: generateInvoiceNumber(),
      due_date: "",
      notes: "",
    });
    setInvoiceDialogOpen(true);
  };

  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices(prev => [...prev, serviceId]);
    } else {
      setSelectedServices(prev => prev.filter(id => id !== serviceId));
    }
  };

  const handleCreateInvoice = async () => {
    if (selectedServices.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one service",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calculate total amount
      const selectedServiceItems = services.filter(service => selectedServices.includes(service.id));
      const totalAmount = selectedServiceItems.reduce((sum, service) => sum + service.unit_price, 0);

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          project_id: projectId,
          organization_id: organizationId,
          invoice_number: invoiceFormData.invoice_number,
          total_amount: totalAmount,
          paid_amount: 0,
          balance_due: totalAmount,
          status: "draft",
          issue_date: new Date().toISOString().split('T')[0],
          due_date: invoiceFormData.due_date || null,
          notes: invoiceFormData.notes || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const invoiceItems = selectedServiceItems.map(service => ({
        invoice_id: invoiceData.id,
        service_id: service.id,
        description: service.name,
        quantity: 1,
        unit_price: service.unit_price,
        total_price: service.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      setInvoiceDialogOpen(false);
      setSelectedServices([]);
      setInvoiceFormData({
        invoice_number: "",
        due_date: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading services...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Services Offered</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerateInvoice}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Invoice
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Edit Service" : "Add New Service"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Service Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Design Consultation"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Service description..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unit_price">Unit Price ($)</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hour">Hour</SelectItem>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="fixed">Fixed Price</SelectItem>
                        <SelectItem value="sqft">Per Sq Ft</SelectItem>
                        <SelectItem value="item">Per Item</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="payment_status">Payment Status</Label>
                  <Select
                    value={formData.payment_status}
                    onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="to_be_paid">To Be Paid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                 </div>
                 <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingService ? "Update" : "Create"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Services</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No services created yet. Add your first service to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {service.description || "-"}
                    </TableCell>
                    <TableCell>${service.unit_price.toFixed(2)}</TableCell>
                    <TableCell>{service.unit}</TableCell>
                    <TableCell>
                      <Select
                        value={service.payment_status}
                        onValueChange={async (value) => {
                          try {
                            const { error } = await supabase
                              .from("services")
                              .update({ payment_status: value })
                              .eq("id", service.id);
                            
                            if (error) throw error;
                            fetchServices();
                            toast({
                              title: "Success",
                              description: "Payment status updated",
                            });
                          } catch (error) {
                            console.error("Error updating payment status:", error);
                            toast({
                              title: "Error",
                              description: "Failed to update payment status",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="to_be_paid">To Be Paid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(service)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(service.id)}
                        >
                          <Trash2 className="h-3 w-3" />
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

      {/* Generate Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={invoiceFormData.invoice_number}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_number: e.target.value })}
                  placeholder="INV-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={invoiceFormData.due_date}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, due_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={invoiceFormData.notes}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
            
            <div>
              <Label>Select Services</Label>
              <div className="mt-2 max-h-60 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Payment Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={(checked) => 
                              handleServiceSelection(service.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell>${service.unit_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            service.payment_status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : service.payment_status === 'to_be_paid'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {service.payment_status === 'paid' ? 'Paid' :
                             service.payment_status === 'to_be_paid' ? 'To Be Paid' : 'Unpaid'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedServices.length} service(s) selected
              </div>
              <div className="text-lg font-semibold">
                Total: ${services
                  .filter(service => selectedServices.includes(service.id))
                  .reduce((sum, service) => sum + service.unit_price, 0)
                  .toFixed(2)}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateInvoice} className="flex-1">
                Create Invoice
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setInvoiceDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};