import { useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

export function useExportCSV() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: async () => {
      // Fetch all data from Supabase
      const [vehiclesResult, driversResult, fuelRecordsResult] = await Promise.all([
        supabase.from('vehicles').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('fuel_records').select('*')
      ])

      if (vehiclesResult.error) throw new Error(`Failed to fetch vehicles: ${vehiclesResult.error.message}`)
      if (driversResult.error) throw new Error(`Failed to fetch drivers: ${driversResult.error.message}`)
      if (fuelRecordsResult.error) throw new Error(`Failed to fetch fuel records: ${fuelRecordsResult.error.message}`)

      const vehicles = vehiclesResult.data || []
      const drivers = driversResult.data || []
      const fuelRecords = fuelRecordsResult.data || []

      // Create CSV content
      let csvContent = ''

      // Vehicles CSV
      csvContent += 'VEHICLES\n'
      csvContent += 'id,name,license_plate,model,year,budget,driver_id,is_active,created_at,updated_at\n'
      vehicles.forEach(vehicle => {
        csvContent += `${vehicle.id},"${vehicle.name}","${vehicle.license_plate}","${vehicle.model}",${vehicle.year},${vehicle.budget},${vehicle.driver_id || ''},${vehicle.is_active},${vehicle.created_at},${vehicle.updated_at}\n`
      })

      csvContent += '\nDRIVERS\n'
      csvContent += 'id,name,license_number,phone,email,is_active,created_at,updated_at\n'
      drivers.forEach(driver => {
        csvContent += `${driver.id},"${driver.name}","${driver.license_number}","${driver.phone}","${driver.email}",${driver.is_active},${driver.created_at},${driver.updated_at}\n`
      })

      csvContent += '\nFUEL_RECORDS\n'
      csvContent += 'id,vehicle_id,session_date,fuel_amount,fuel_cost,current_mileage,station_name,notes,created_at,updated_at\n'
      fuelRecords.forEach(record => {
        csvContent += `${record.id},${record.vehicle_id},"${record.session_date}",${record.fuel_amount},${record.fuel_cost},${record.current_mileage},"${record.station_name || ''}","${record.notes || ''}",${record.created_at},${record.updated_at}\n`
      })

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fleet-data-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      return csvContent
    },
    onSuccess: () => {
      toast({
        title: "Export Complete",
        description: "Fleet data has been exported successfully from Supabase.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data from Supabase.",
        variant: "destructive",
      })
    },
  })
}
