import { DataTypes } from 'sequelize';

/** Join row: one Smart Invoice attachment covering one fueled vehicle (refuel row). */
export default (sequelize) => {
  const OperationSessionInvoiceRefuel = sequelize.define('OperationSessionInvoiceRefuel', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'operation_session_invoices', key: 'id' },
    },
    refuelId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'operation_session_refuels', key: 'id' },
    },
  }, {
    tableName: 'operation_session_invoice_refuels',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['invoiceId', 'refuelId'] },
      { fields: ['refuelId'] },
    ],
  });

  return OperationSessionInvoiceRefuel;
};
