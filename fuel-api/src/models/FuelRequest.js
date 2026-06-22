import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const FuelRequest = sequelize.define('FuelRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Traccar device ID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Traccar user ID (driver)'
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'company_id',
      references: { model: 'companies', key: 'id' },
    },
    currentFuelLevel: {
      type: DataTypes.DOUBLE,
      comment: 'Current fuel level percentage or liters'
    },
    requestedAmount: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      comment: 'Requested fuel amount in liters'
    },
    fuelUnit: {
      type: DataTypes.STRING(10),
      defaultValue: 'L',
      comment: 'Unit: L (liters) or gal (gallons)'
    },
    reason: {
      type: DataTypes.STRING,
      comment: 'Reason for fuel request'
    },
    urgency: {
      type: DataTypes.ENUM('normal', 'urgent', 'emergency'),
      defaultValue: 'normal',
      comment: 'Request urgency level'
    },
    latitude: {
      type: DataTypes.DOUBLE,
      comment: 'Request location latitude'
    },
    longitude: {
      type: DataTypes.DOUBLE,
      comment: 'Request location longitude'
    },
    address: {
      type: DataTypes.STRING(512),
      comment: 'Formatted address'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'fulfilled', 'cancelled'),
      defaultValue: 'pending',
      comment: 'Current request status'
    },
    requestTime: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When request was created'
    },
    reviewTime: {
      type: DataTypes.DATE,
      comment: 'When manager reviewed the request'
    },
    reviewerId: {
      type: DataTypes.INTEGER,
      comment: 'Traccar user ID of manager who reviewed'
    },
    fulfillmentTime: {
      type: DataTypes.DATE,
      comment: 'When request was fulfilled'
    },
    notes: {
      type: DataTypes.TEXT,
      comment: 'Manager notes or rejection reason'
    },
    estimatedCost: {
      type: DataTypes.DOUBLE,
      comment: 'Estimated cost in local currency'
    },
    approvedAmount: {
      type: DataTypes.DOUBLE,
      comment: 'Manager approved amount (can differ from requested)'
    },
    validationWarnings: {
      type: DataTypes.JSON,
      comment: 'Validation warnings and issues'
    },
    managerSuggestion: {
      type: DataTypes.DOUBLE,
      comment: 'System-calculated optimal amount'
    },
    overrideReason: {
      type: DataTypes.TEXT,
      comment: 'Reason for overriding validation warnings'
    },

    // ── Financial snapshot (locked at approval, never mutated afterwards) ──
    lockedPricePerUnit: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: 'Fuel unit price frozen at approval time (ZMW per litre)'
    },
    lockedCurrency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'ZMW',
      comment: 'ISO 4217 currency code for the locked price'
    },
    lockedFuelType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Fuel grade locked at approval (petrol / diesel / kerosene / jetA1)'
    },
    lockedApprovedCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: 'approvedAmount × lockedPricePerUnit — authoritative spend figure'
    },
    priceSourceAtApproval: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Origin of the locked price: erb-latest | manual | backfill'
    },
    priceAuditTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the price snapshot was captured'
    },

    // ── Reconciliation fields (set at fulfillment, never affect locked snapshot) ──
    actualFulfilledAmount: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: 'Actual litres dispensed (may differ from approvedAmount)'
    },
    actualFulfilledCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      comment: 'Actual cost: actualFulfilledAmount × lockedPricePerUnit'
    }
  }, {
    tableName: 'fuel_requests',
    timestamps: true,
    indexes: [
      { fields: ['deviceId'] },
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['requestTime'] }
    ]
  });

  return FuelRequest;
};





















