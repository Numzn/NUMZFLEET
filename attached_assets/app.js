// Main application
document.addEventListener('DOMContentLoaded', function() {
  // Initialize date with today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('session-date').value = today;

  // Initialize vehicles array
  let vehicles = [
    { id: 1, name: 'Mark X', budget: 1850, actual: 0, attendant: '', pump: '' },
    { id: 2, name: 'Toyota Vitz', budget: 1200, actual: 0, attendant: '', pump: '' },
    { id: 3, name: 'Honda Fit', budget: 1800, actual: 0, attendant: '', pump: '' }
  ];

  // DOM elements
  const tableBody = document.getElementById('vehicle-table');
  const saveBtn = document.getElementById('save-session');
  const newVehicleBtn = document.getElementById('new-vehicle');
  const modal = document.getElementById('vehicle-modal');
  const closeBtn = document.querySelector('.close');
  const vehicleForm = document.getElementById('vehicle-form');
  const excessAllocation = document.getElementById('excess-allocation');

  // Chart initialization
  const ctx = document.getElementById('fuelChart').getContext('2d');
  let fuelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Budgeted',
          backgroundColor: '#007bff',
          data: []
        },
        {
          label: 'Actual',
          backgroundColor: '#28a745',
          data: []
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Amount (K)'
          }
        }
      }
    }
  });

  // Render the vehicle table (initial render)
  function renderTable() {
    tableBody.innerHTML = '';
    
    vehicles.forEach(vehicle => {
      const diff = (vehicle.actual || 0) - vehicle.budget;
      const diffClass = diff >= 0 ? 'positive' : 'negative';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${vehicle.name}</td>
        <td>${vehicle.budget.toLocaleString()}</td>
        <td><input type="number" id="actual-${vehicle.id}" value="${vehicle.actual || ''}" 
             min="0" step="0.01"></td>
        <td><input type="text" id="attendant-${vehicle.id}" value="${vehicle.attendant}"></td>
        <td><input type="text" id="pump-${vehicle.id}" value="${vehicle.pump}"></td>
        <td class="${diffClass}" id="diff-${vehicle.id}">${diff.toLocaleString()}</td>
        <td>
          <button class="action-btn delete" onclick="deleteVehicle(${vehicle.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(row);

      // Add event listeners
      document.getElementById(`actual-${vehicle.id}`).addEventListener('input', (e) => {
        updateVehicle(vehicle.id, 'actual', e.target.value, true);
      });
      document.getElementById(`attendant-${vehicle.id}`).addEventListener('input', debounce((e) => {
        updateVehicle(vehicle.id, 'attendant', e.target.value);
      }, 300));
      document.getElementById(`pump-${vehicle.id}`).addEventListener('input', debounce((e) => {
        updateVehicle(vehicle.id, 'pump', e.target.value);
      }, 300));
    });

    updateTotals();
  }

  // Update vehicle data (optimized version)
  window.updateVehicle = function(id, field, value, isActual = false) {
    const vehicle = vehicles.find(v => v.id === id);
    if (vehicle) {
      // Store current focus and cursor position
      const activeElement = document.activeElement;
      const cursorPosition = activeElement.selectionStart;

      if (field === 'actual') {
        vehicle[field] = parseFloat(value) || 0;
      } else {
        vehicle[field] = value;
      }

      if (isActual) {
        // Only update the difference cell for this row
        const diff = (vehicle.actual || 0) - vehicle.budget;
        const diffClass = diff >= 0 ? 'positive' : 'negative';
        const diffCell = document.getElementById(`diff-${id}`);
        diffCell.textContent = diff.toLocaleString();
        diffCell.className = diffClass;
        
        // Update totals without full re-render
        updateTotals();
      }

      // Restore focus and cursor position if needed
      if (activeElement && document.contains(activeElement)) {
        activeElement.focus();
        if (cursorPosition !== null) {
          activeElement.setSelectionRange(cursorPosition, cursorPosition);
        }
      }
    }
  };

  // Update totals without full re-render
  function updateTotals() {
    const totalBudget = vehicles.reduce((sum, v) => sum + v.budget, 0);
    const totalActual = vehicles.reduce((sum, v) => sum + (v.actual || 0), 0);
    const totalDiff = totalActual - totalBudget;
    const diffClass = totalDiff >= 0 ? 'positive' : 'negative';

    document.getElementById('total-budget').textContent = totalBudget.toLocaleString();
    document.getElementById('total-actual').textContent = totalActual.toLocaleString();
    document.getElementById('total-diff').textContent = totalDiff.toLocaleString();
    document.getElementById('total-diff').className = diffClass;

    // Update chart
    updateChartData();
  }

  // Update chart data
  function updateChartData() {
    const chartLabels = [];
    const budgetData = [];
    const actualData = [];

    vehicles.forEach(vehicle => {
      chartLabels.push(vehicle.name);
      budgetData.push(vehicle.budget);
      actualData.push(vehicle.actual || 0);
    });

    fuelChart.data.labels = chartLabels;
    fuelChart.data.datasets[0].data = budgetData;
    fuelChart.data.datasets[1].data = actualData;
    fuelChart.update();
  }

  // Delete vehicle
  window.deleteVehicle = function(id) {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      vehicles = vehicles.filter(v => v.id !== id);
      renderTable();
    }
  };

  // Add new vehicle
  vehicleForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('vehicle-name').value;
    const budget = parseFloat(document.getElementById('vehicle-budget').value);

    if (name && !isNaN(budget)) {
      const newId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1;
      vehicles.push({
        id: newId,
        name,
        budget,
        actual: 0,
        attendant: '',
        pump: ''
      });
      renderTable();
      modal.style.display = 'none';
      vehicleForm.reset();
    }
  });

  // Save session
  saveBtn.addEventListener('click', function() {
    const sessionData = {
      date: document.getElementById('session-date').value,
      vehicles: vehicles,
      excessAllocation: excessAllocation.value,
      totals: {
        budget: vehicles.reduce((sum, v) => sum + v.budget, 0),
        actual: vehicles.reduce((sum, v) => sum + (v.actual || 0), 0)
      }
    };

    console.log('Session data:', sessionData);
    alert('Session data saved (check console for details)');
    localStorage.setItem('fuelSession_' + new Date().toISOString(), JSON.stringify(sessionData));
  });

  // Modal controls
  newVehicleBtn.addEventListener('click', function() {
    modal.style.display = 'block';
  });

  closeBtn.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Initial render
  renderTable();
});