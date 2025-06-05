// Utility functions that might be used across the application

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Calculate fuel efficiency (if we had distance data)
function calculateMPG(distance, fuelUsed) {
  return distance / fuelUsed;
}

// Export data to CSV
function exportToCSV(data, filename) {
  const csvContent = "data:text/csv;charset=utf-8," 
    + data.map(row => Object.values(row).join(',')).join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Debounce function for performance optimization
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}