import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const MaintenanceBudget = sequelize.define('MaintenanceBudget', {
    companyId: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    monthlyBudget: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'ZMW',
    },
  }, {
    tableName: 'maintenance_budgets',
    timestamps: true,
    updatedAt: 'updatedAt',
    createdAt: false,
  });

  return MaintenanceBudget;
};
