import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface VendorCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onVendorCreated: (vendor: any) => void;
  onCategoryCreated: (category: Category) => void;
}

export function VendorCreateDialog({
  open,
  onOpenChange,
  categories,
  onVendorCreated,
  onCategoryCreated,
}: VendorCreateDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [vendorData, setVendorData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    categoryId: "",
  });

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
      onCategoryCreated(newCategory);
      
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

  const handleCategorySelect = (categoryId: string) => {
    setVendorData(prev => ({ ...prev, categoryId }));
  };

  const handleCategoryCreate = async (categoryName: string) => {
    const category = await createCategory(categoryName);
    if (category) {
      setVendorData(prev => ({ ...prev, categoryId: category.id }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vendorData.name.trim()) {
      toast({
        title: "Error",
        description: "Vendor name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!vendorData.categoryId) {
      toast({
        title: "Error",
        description: "Please select or create a category for this vendor.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: vendorData.name.trim(),
          email: vendorData.email.trim() || null,
          phone: vendorData.phone.trim() || null,
          address: vendorData.address.trim() || null,
          default_category_id: vendorData.categoryId,
          organization_id: undefined // Will be set by RLS
        })
        .select()
        .single();

      if (error) throw error;

      onVendorCreated(data);
      
      toast({
        title: "Vendor Created",
        description: `${vendorData.name} has been added to your vendors.`,
      });

      // Reset form and close dialog
      setVendorData({
        name: "",
        email: "",
        phone: "",
        address: "",
        categoryId: "",
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast({
        title: "Error",
        description: "Failed to create vendor. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Vendor</DialogTitle>
          <DialogDescription>
            Add a new vendor/payee to your system. Category assignment is mandatory.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="vendor-name">Vendor Name *</Label>
            <Input
              id="vendor-name"
              value={vendorData.name}
              onChange={(e) => setVendorData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter vendor name"
              required
            />
          </div>

          <div>
            <Label htmlFor="vendor-category">Category *</Label>
            <Combobox
              options={categories.map(category => ({ value: category.id, label: category.name }))}
              value={vendorData.categoryId}
              onSelect={handleCategorySelect}
              onCreateNew={handleCategoryCreate}
              placeholder="Select or create category..."
              searchPlaceholder="Search categories..."
              emptyText="No categories found."
              createNewText="Create category"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Once assigned, this category cannot be changed
            </p>
          </div>

          <div>
            <Label htmlFor="vendor-email">Email</Label>
            <Input
              id="vendor-email"
              type="email"
              value={vendorData.email}
              onChange={(e) => setVendorData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="vendor@example.com"
            />
          </div>

          <div>
            <Label htmlFor="vendor-phone">Phone</Label>
            <Input
              id="vendor-phone"
              value={vendorData.phone}
              onChange={(e) => setVendorData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <Label htmlFor="vendor-address">Address</Label>
            <Textarea
              id="vendor-address"
              value={vendorData.address}
              onChange={(e) => setVendorData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Vendor address"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Creating..." : "Create Vendor"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}