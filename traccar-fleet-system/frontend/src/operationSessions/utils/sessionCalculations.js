const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildVehicleBudgetIndex = (vehicles = []) => {
  const index = {};
  vehicles.forEach((vehicle) => {
    if (vehicle?.id != null) {
      index[vehicle.id] = toNumber(vehicle.budget);
    }
  });
  return index;
};

export const calculateSessionTotals = (sessionRecords = [], vehiclesById = {}) => {
  const totalSpent = sessionRecords.reduce((sum, record) => sum + toNumber(record.fuelCost), 0);
  const totalFuelAmount = sessionRecords.reduce((sum, record) => sum + toNumber(record.fuelAmount), 0);
  const totalBudget = sessionRecords.reduce((sum, record) => {
    const budget = vehiclesById[record.vehicleId] ?? 0;
    return sum + toNumber(budget);
  }, 0);

  return {
    totalBudget,
    totalSpent,
    totalFuelAmount,
    totalDifference: totalBudget - totalSpent,
    activeVehicles: new Set(sessionRecords.map((record) => record.vehicleId)).size,
  };
};

const calculateVehicleEfficiencyFromMileage = (records = []) => {
  if (records.length < 2) {
    return null;
  }

  const sorted = [...records].sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));
  let totalDistance = 0;
  let totalFuel = 0;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const distance = toNumber(current.currentMileage) - toNumber(previous.currentMileage);
    const fuel = toNumber(current.fuelAmount);

    if (distance > 0 && fuel > 0) {
      totalDistance += distance;
      totalFuel += fuel;
    }
  }

  if (totalDistance <= 0 || totalFuel <= 0) {
    return null;
  }

  return (totalFuel / totalDistance) * 100;
};

export const calculateFleetEfficiency = (fuelRecords = []) => {
  if (!Array.isArray(fuelRecords) || fuelRecords.length === 0) {
    return { efficiency: null, type: null };
  }

  const recordsByVehicle = {};
  fuelRecords.forEach((record) => {
    if (!recordsByVehicle[record.vehicleId]) {
      recordsByVehicle[record.vehicleId] = [];
    }
    recordsByVehicle[record.vehicleId].push(record);
  });

  const efficiencies = Object.values(recordsByVehicle)
    .map((records) => calculateVehicleEfficiencyFromMileage(records))
    .filter((value) => value != null && Number.isFinite(value));

  if (efficiencies.length === 0) {
    return { efficiency: null, type: null };
  }

  const average = efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length;
  return { efficiency: average, type: 'L/100km' };
};

export const calculateMonthlySpend = (fuelRecords = []) => {
  const monthlySpend = {};

  fuelRecords.forEach((record) => {
    const date = new Date(record.sessionDate);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlySpend[monthKey] = (monthlySpend[monthKey] || 0) + toNumber(record.fuelCost);
  });

  return Object.entries(monthlySpend)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([month, totalSpend]) => ({ month, totalSpend }));
};
