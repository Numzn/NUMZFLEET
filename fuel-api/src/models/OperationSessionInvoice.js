import { DataTypes } from 'sequelize';

export const INVOICE_RECONCILIATION_STATUSES = ['pending', 'matched', 'variance'];

export default (sequelize) => {
  const OperationSessionInvoice = sequelize.define('OperationSessionInvoice', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    operationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'company_id',
      references: { model: 'companies', key: 'id' },
    },
    invoiceNumber: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    dieselLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    petrolLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    totalLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    totalCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    reconciliationStatus: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'pending',
    },
    varianceLitres: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    varianceCost: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    enteredBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    attachmentUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'operation_session_invoices',
    timestamps: true,
    indexes: [
      { fields: ['operationId'] },
    ],
  });

  return OperationSessionInvoice;
};
