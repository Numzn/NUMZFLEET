import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { insertDriverSchema } from "@shared/schema"
import type { InsertDriver } from "@shared/schema"
import { useCreateDriver } from "@/hooks/use-drivers"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

interface AddDriverModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddDriverModal({ open, onOpenChange }: AddDriverModalProps) {
  const createDriverMutation = useCreateDriver()

  const form = useForm<InsertDriver>({
    resolver: zodResolver(insertDriverSchema),
    defaultValues: {
      name: "",
      licenseNumber: "",
      phoneNumber: "",
      email: "",
      isActive: true,
    },
  })

  const onSubmit = async (data: InsertDriver) => {
    try {
      await createDriverMutation.mutateAsync(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the mutation
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Driver</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="licenseNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., DL123456" 
                      value={field.value || ""} 
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., +1-555-0123" 
                      value={field.value || ""} 
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="e.g., john@company.com" 
                      value={field.value || ""} 
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={createDriverMutation.isPending}
              >
                {createDriverMutation.isPending ? "Adding..." : "Add Driver"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}