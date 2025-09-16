import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickerProps {
  fromDate: Date;
  toDate: Date;
  onDateChange: (from: Date, to: Date) => void;
  isLoading?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fromDate,
  toDate,
  onDateChange,
  isLoading = false
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempFromDate, setTempFromDate] = useState(fromDate);
  const [tempToDate, setTempToDate] = useState(toDate);

  // Sync temp dates when props change
  useEffect(() => {
    setTempFromDate(fromDate);
    setTempToDate(toDate);
  }, [fromDate, toDate]);

  const handleApply = () => {
    // Ensure from date is not after to date
    const fromDate = tempFromDate <= tempToDate ? tempFromDate : tempToDate;
    const toDate = tempFromDate <= tempToDate ? tempToDate : tempFromDate;
    
    onDateChange(fromDate, toDate);
    setShowDatePicker(false);
  };

  const handleQuickRange = (days: number) => {
    const to = new Date();
    to.setHours(23, 59, 59, 999); // End of today
    
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0); // Start of day
    
    onDateChange(from, to);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to convert date to local datetime-local format
  const toLocalDateTimeString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to parse datetime-local input
  const parseLocalDateTime = (value: string) => {
    const [datePart, timePart] = value.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium flex items-center">
        <Calendar className="w-3 h-3 mr-1" />
        Date Range
      </label>
      
      <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-7 justify-start text-left font-normal text-xs"
            disabled={isLoading}
          >
            <Clock className="w-3 h-3 mr-1" />
            {formatDate(fromDate)} - {formatDate(toDate)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Input
                type="datetime-local"
                value={toLocalDateTimeString(tempFromDate)}
                onChange={(e) => setTempFromDate(parseLocalDateTime(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Input
                type="datetime-local"
                value={toLocalDateTimeString(tempToDate)}
                onChange={(e) => setTempToDate(parseLocalDateTime(e.target.value))}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Ranges</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickRange(1)}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickRange(7)}
                >
                  7 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickRange(30)}
                >
                  30 days
                </Button>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={handleApply} className="flex-1">
                Apply
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDatePicker(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
