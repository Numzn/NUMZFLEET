import { useMemo, useState, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFuelRecords } from "@/hooks/use-fuel-records"
import { useVehicles } from "@/hooks/use-vehicles"
import { DateTime } from "luxon"
import { Paperclip } from "lucide-react"

export function FuelRecordSummaryTable() {
  const { data: fuelRecords = [] } = useFuelRecords();
  const { data: vehicles = [] } = useVehicles();
  const [openSession, setOpenSession] = useState<string | null>(null);
  // Receipt state: allow multiple receipts per session
  const [sessionReceipts, setSessionReceipts] = useState<Record<string, File[]>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Group records by sessionDate (YYYY-MM-DD)
  const recordsByDate = useMemo(() => {
    const groups: Record<string, typeof fuelRecords> = {};
    for (const record of fuelRecords) {
      const dateKey = DateTime.fromISO(record.sessionDate).toFormat('yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(record);
    }
    return groups;
  }, [fuelRecords]);

  const sessionDates = Object.keys(recordsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const handleReceiptUpload = (date: string, files: FileList | null) => {
    if (!files) return;
    setSessionReceipts(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), ...Array.from(files)]
    }));
  };

  const handleRemoveReceipt = (date: string, idx: number) => {
    setSessionReceipts(prev => {
      const updated = [...(prev[date] || [])];
      updated.splice(idx, 1);
      return { ...prev, [date]: updated };
    });
  };

  return (
    <div className="relative">
      {sessionDates.map(date => {
        const sessionRecords = recordsByDate[date];
        const totalSpent = sessionRecords.reduce(
          (sum, record) => sum + (typeof record.fuelCost === "number" ? record.fuelCost : 0),
          0
        );
        const totalBudget = sessionRecords.reduce((sum, record) => {
          const vehicle = vehicles.find(v => v.id === record.vehicleId);
          return sum + (vehicle?.budget ?? 0);
        }, 0);
        const leftOver = totalBudget - totalSpent;
        const receipts = sessionReceipts[date] || [];
        return (
          <div key={date} className="mb-4 rounded-md border overflow-x-auto bg-white dark:bg-black/30">
            <div
              className="px-4 py-2 font-bold text-lg flex items-center justify-between cursor-pointer select-none hover:bg-muted"
              onClick={() => setOpenSession(openSession === date ? null : date)}
              aria-expanded={openSession === date}
              tabIndex={0}
              role="button"
            >
              <span className="flex items-center gap-2">
                Session: {DateTime.fromISO(date).toFormat('dd LLL yyyy')}
                <span className="ml-4 text-base font-normal text-muted-foreground">
                  | Total Spent: <span className="font-semibold text-primary">{new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', minimumFractionDigits: 2 }).format(totalSpent)}</span>
                  {' '}• Budget Remaining: <span className={
                    leftOver < 0
                      ? "text-red-600 font-semibold"
                      : leftOver > 0
                      ? "text-green-600 font-semibold"
                      : "text-yellow-600 font-semibold"
                  }>
                    {new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', minimumFractionDigits: 2 }).format(leftOver)}
                    {leftOver < 0
                      ? " (Over)"
                      : leftOver > 0
                      ? " (Budget Remaining)"
                      : " (On Budget)"}
                  </span>
                </span>
              </span>
              {/* Receipt clip icon and thumbnails */}
              <span className="ml-4 flex items-center gap-1">
                <label className="cursor-pointer flex items-center gap-1" title="Attach receipts">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500 hover:text-primary">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12.75l7.5-7.5m0 0v3.75m0-3.75h-3.75" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={e => handleReceiptUpload(date, e.target.files)}
                    tabIndex={-1}
                  />
                </label>
                {receipts.length > 0 && (
                  <div className="flex gap-1 ml-2">
                    {receipts.map((file, idx) => (
                      <span key={idx} className="relative group">
                        {file.type.startsWith('image') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Receipt ${idx + 1}`}
                            className="w-7 h-7 object-cover rounded border border-gray-300 shadow-sm cursor-pointer hover:ring-2 hover:ring-primary"
                            title={file.name}
                            onClick={e => {
                              e.stopPropagation();
                              window.open(URL.createObjectURL(file), '_blank');
                            }}
                          />
                        ) : file.type === 'application/pdf' ? (
                          <span
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 border border-gray-300 rounded cursor-pointer hover:ring-2 hover:ring-primary text-xs font-semibold text-gray-700"
                            title={file.name}
                            onClick={e => {
                              e.stopPropagation();
                              window.open(URL.createObjectURL(file), '_blank');
                            }}
                          >
                            Rcpt
                          </span>
                        ) : (
                          <span
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 border border-gray-300 rounded cursor-pointer hover:ring-2 hover:ring-primary"
                            title={file.name}
                            onClick={e => {
                              e.stopPropagation();
                              window.open(URL.createObjectURL(file), '_blank');
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </span>
                        )}
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 bg-white rounded-full border border-gray-300 p-0.5 text-xs text-gray-500 hover:text-red-600 shadow group-hover:visible invisible"
                          title="Remove receipt"
                          onClick={e => {
                            e.stopPropagation();
                            handleRemoveReceipt(date, idx);
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </span>
            </div>
            {openSession === date && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Fuel Type</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Actual Amount (ZMW)</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Attendant</TableHead>
                    <TableHead>Pump #</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsByDate[date].map((record) => {
                    const vehicle = vehicles.find(v => v.id === record.vehicleId);
                    if (!vehicle) return null;
                    const budget = vehicle.budget ?? 0;
                    const amount = typeof record.fuelCost === "number" ? record.fuelCost : 0;
                    const variance = budget - amount;
                    const fuelType = vehicle.fuelType || "N/A";
                    const rowColor =
                      fuelType.toLowerCase() === "diesel"
                        ? "bg-purple-50 dark:bg-purple-900/10"
                        : fuelType.toLowerCase() === "petrol"
                        ? "bg-green-50 dark:bg-green-900/10"
                        : "";
                    return (
                      <TableRow key={record.id} className={rowColor}>
                        <TableCell className="font-medium">{vehicle.name}</TableCell>
                        <TableCell>{fuelType}</TableCell>
                        <TableCell className="text-right">
                          {budget
                            ? new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', minimumFractionDigits: 2 }).format(budget)
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          {amount
                            ? new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', minimumFractionDigits: 2 }).format(amount)
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          {typeof variance === "number"
                            ? new Intl.NumberFormat('en-ZM', { style: 'currency', currency: 'ZMW', minimumFractionDigits: 2 }).format(variance)
                            : "N/A"}{" "}
                          <span
                            className={
                              variance < 0
                                ? "text-red-600"
                                : variance > 0
                                ? "text-green-600"
                                : "text-yellow-600"
                            }
                          >
                            {variance < 0
                              ? "(Over)"
                              : variance > 0
                              ? "(Under)"
                              : "(On Budget)"}
                          </span>
                        </TableCell>
                        <TableCell>{record.attendant || "N/A"}</TableCell>
                        <TableCell>{record.pumpNumber || "N/A"}</TableCell>
                        <TableCell>
                          {DateTime.fromISO(record.sessionDate).toFormat('dd LLL yyyy')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Custom hook to get last session summary for dashboard cards
export function useLastSessionSummary(fuelRecords: any[], vehicles: any[]) {
  const recordsByDate = useMemo(() => {
    const groups: Record<string, typeof fuelRecords> = {};
    for (const record of fuelRecords) {
      const dateKey = DateTime.fromISO(record.sessionDate).toFormat('yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(record);
    }
    return groups;
  }, [fuelRecords]);

  const sessionDates = Object.keys(recordsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const lastSessionDate = sessionDates[0];
  const lastSessionRecords = lastSessionDate ? recordsByDate[lastSessionDate] : [];

  const totalBudget = lastSessionRecords.reduce((sum, record) => {
    const vehicle = vehicles.find(v => v.id === record.vehicleId);
    return sum + (vehicle?.budget ?? 0);
  }, 0);
  const totalSpent = lastSessionRecords.reduce(
    (sum, record) => sum + (typeof record.fuelCost === "number" ? record.fuelCost : 0),
    0
  );
  const totalDifference = totalBudget - totalSpent;
  const activeVehicles = Array.from(new Set(lastSessionRecords.map(r => r.vehicleId))).length;

  return {
    lastSessionDate,
    totalBudget,
    totalSpent,
    totalDifference,
    activeVehicles,
    isEmpty: !lastSessionDate
  };
}
