import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { getVehicleLabel } from '../vehicleRegistry/vehicleRegistryUtils.js';
import { formatLitres, formatZmw } from '../../operationSessions/utils/formatters.js';

const MARGIN = 40;
const PRIMARY_COLOR = [15, 76, 129];

function formatDate(t) {
  if (!t) return '—';
  try {
    return new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

function formatDateTime(t) {
  try {
    return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function addSectionTitle(doc, text, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(text, MARGIN, y);
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.line(MARGIN, y + 4, doc.internal.pageSize.getWidth() - MARGIN, y + 4);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  return y + 20;
}

function ensureSpace(doc, y, needed = 60) {
  if (y + needed > doc.internal.pageSize.getHeight() - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function buildExecutiveSummary({ fuel, fuelFindings }) {
  const confidence = fuel?.confidence != null ? Math.round(fuel.confidence) : null;
  const warnings = fuelFindings.filter((f) => f.severity === 'warning' || f.severity === 'error');

  const parts = [];
  if (confidence != null) {
    parts.push(`Fuel confidence score is ${confidence}%.`);
  } else {
    parts.push('Not enough fueling history yet to score confidence.');
  }
  if (warnings.length > 0) {
    parts.push(`${warnings.length} item${warnings.length === 1 ? '' : 's'} need${warnings.length === 1 ? 's' : ''} attention: ${warnings.map((w) => w.text).join('; ')}.`);
  } else {
    parts.push('No fuel anomalies detected.');
  }
  return parts.join(' ');
}

/**
 * Builds and downloads the Vehicle Fuel Report PDF. All figures are pulled
 * from data already computed server-side (fuel snapshot, intelligence
 * findings, trends KPIs, recent history) — this module only lays them out.
 */
export function exportVehicleFuelReportPdf({
  vehicle,
  fuel,
  intelligence,
  odometerKm,
  odometerConfidence,
  lastRefill,
  trends,
  history,
  generatedBy,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text('Vehicle Fuel Report', MARGIN, y);
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(getVehicleLabel(vehicle) || 'Vehicle', MARGIN, y);
  y += 30;

  // Vehicle Information
  y = addSectionTitle(doc, 'Vehicle Information', y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    body: [
      ['Vehicle', getVehicleLabel(vehicle) || '—'],
      ['Current odometer', odometerKm != null ? `${Number(odometerKm).toLocaleString()} km` : '—'],
      ['Odometer confidence', odometerConfidence ?? '—'],
    ],
  });
  y = doc.lastAutoTable.finalY + 20;

  // Executive Summary
  const fuelFindings = (intelligence?.findings || []).filter((f) => f.domain === 'fuel');
  y = ensureSpace(doc, y);
  y = addSectionTitle(doc, 'Executive Summary', y);
  const summaryLines = doc.splitTextToSize(buildExecutiveSummary({ fuel, fuelFindings }), pageWidth - MARGIN * 2);
  doc.text(summaryLines, MARGIN, y);
  y += summaryLines.length * 13 + 10;

  // Fuel Overview
  y = ensureSpace(doc, y);
  y = addSectionTitle(doc, 'Fuel Overview', y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    body: [
      ['Current fuel level', fuel?.levelPct != null ? `${Math.round(fuel.levelPct)}%` : 'Unavailable from telemetry'],
      ['Tank capacity', fuel?.capacityL != null ? `${fuel.capacityL} L` : '—'],
      ['Estimated range', fuel?.rangeKm != null ? `${fuel.rangeKm} km` : '—'],
      ['Consumption', fuel?.lPer100km != null ? `${fuel.lPer100km} L/100km` : '—'],
    ],
  });
  y = doc.lastAutoTable.finalY + 20;

  // Latest Fuel Session
  y = ensureSpace(doc, y);
  y = addSectionTitle(doc, 'Latest Fuel Session', y);
  if (lastRefill) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      body: [
        ['Date', formatDate(lastRefill.session?.sessionDate)],
        ['Litres added', formatLitres(lastRefill.refuel?.actualFuelLitres)],
        ['Odometer', lastRefill.refuel?.odometerKm != null ? `${Number(lastRefill.refuel.odometerKm).toLocaleString()} km` : '—'],
      ],
    });
    y = doc.lastAutoTable.finalY + 20;
  } else {
    doc.text('No fueling sessions recorded yet.', MARGIN, y);
    y += 20;
  }

  // Fuel Intelligence Summary
  y = ensureSpace(doc, y);
  y = addSectionTitle(doc, 'Fuel Intelligence Summary', y);
  const confidenceLine = fuel?.confidence != null
    ? `Confidence score: ${Math.round(fuel.confidence)}%`
    : 'Confidence score: not enough history yet';
  doc.text(confidenceLine, MARGIN, y);
  y += 16;
  if (fuelFindings.length === 0) {
    doc.text('No fuel anomalies detected.', MARGIN, y);
    y += 16;
  } else {
    for (const finding of fuelFindings) {
      y = ensureSpace(doc, y, 20);
      const lines = doc.splitTextToSize(`- ${finding.text}`, pageWidth - MARGIN * 2);
      doc.text(lines, MARGIN, y);
      y += lines.length * 13;
    }
  }
  y += 10;

  // Fuel Trends
  y = ensureSpace(doc, y);
  y = addSectionTitle(doc, 'Fuel Trends', y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    body: [
      ['Monthly fuel spend', trends?.monthlySpendZmw != null ? formatZmw(trends.monthlySpendZmw) : '—'],
      ['Average fuel economy', trends?.averageEconomyKmPerL != null ? `${trends.averageEconomyKmPerL.toFixed(1)} km/L` : '—'],
      ['Average litres per fill', trends?.averageLitresPerFill != null ? `${trends.averageLitresPerFill.toFixed(1)} L` : '—'],
      ['Cost per kilometre', trends?.costPerKmZmw != null ? `ZMW ${trends.costPerKmZmw.toFixed(2)}` : '—'],
      ['Average distance between refuels', trends?.averageDistanceBetweenRefuelsKm != null ? `${Number(trends.averageDistanceBetweenRefuelsKm).toLocaleString()} km` : '—'],
    ],
  });
  y = doc.lastAutoTable.finalY + 20;

  // Recent Fuel History
  y = ensureSpace(doc, y, 100);
  y = addSectionTitle(doc, 'Recent Fuel History', y);
  if (history && history.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Date', 'Litres', 'Odometer', 'Cost', 'Economy']],
      body: history.map((row) => [
        formatDate(row.date),
        formatLitres(row.litres),
        row.odometerKm != null ? `${Number(row.odometerKm).toLocaleString()} km` : '—',
        row.totalCost != null ? formatZmw(row.totalCost) : '—',
        row.economyKmPerL != null ? `${row.economyKmPerL.toFixed(1)} km/L` : '—',
      ]),
      headStyles: { fillColor: PRIMARY_COLOR },
      styles: { fontSize: 9, cellPadding: 4 },
    });
    y = doc.lastAutoTable.finalY + 20;
  } else {
    doc.text('No fueling sessions recorded yet.', MARGIN, y);
    y += 20;
  }

  // Recommendations
  const fuelRecommendations = (intelligence?.recommendations || []).filter((r) => r.domain === 'fuel');
  y = ensureSpace(doc, y);
  y = addSectionTitle(doc, 'Recommendations', y);
  if (fuelRecommendations.length === 0) {
    doc.text('No recommendations at this time.', MARGIN, y);
    y += 16;
  } else {
    for (const rec of fuelRecommendations) {
      y = ensureSpace(doc, y, 20);
      const lines = doc.splitTextToSize(`- ${rec.text}`, pageWidth - MARGIN * 2);
      doc.text(lines, MARGIN, y);
      y += lines.length * 13;
    }
  }

  // Report Metadata (footer on every page)
  const pageCount = doc.internal.getNumberOfPages();
  const generatedAt = formatDateTime(new Date());
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Generated by ${generatedBy || 'NUMZFLEET'} on ${generatedAt} · Page ${i} of ${pageCount}`,
      MARGIN,
      doc.internal.pageSize.getHeight() - 20,
    );
  }

  const safeName = (getVehicleLabel(vehicle) || 'vehicle').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`fuel-report-${safeName}.pdf`);
}
