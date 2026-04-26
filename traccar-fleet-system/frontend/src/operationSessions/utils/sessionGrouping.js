import { calculateSessionTotals } from './sessionCalculations';

export const getSessionDateKey = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const groupRecordsBySessionDate = (fuelRecords = []) => {
  const groups = {};

  fuelRecords.forEach((record) => {
    const key = getSessionDateKey(record.sessionDate);
    if (!key) {
      return;
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
  });

  return groups;
};

export const getSortedSessionDates = (recordsByDate = {}) => Object.keys(recordsByDate)
  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

export const summarizeSessions = (fuelRecords = [], vehiclesById = {}) => {
  const grouped = groupRecordsBySessionDate(fuelRecords);
  const dates = getSortedSessionDates(grouped);

  return dates.map((date) => {
    const sessionRecords = grouped[date] || [];
    const totals = calculateSessionTotals(sessionRecords, vehiclesById);

    return {
      date,
      sessionId: date,
      recordCount: sessionRecords.length,
      ...totals,
    };
  });
};
