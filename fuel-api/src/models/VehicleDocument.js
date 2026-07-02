import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VehicleDocument = sequelize.define(
    'VehicleDocument',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id',
      },
      fleetVehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'fleet_vehicle_id',
        references: { model: 'vehicles', key: 'id' },
      },
      title: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'other',
      },
      fileId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'file_id',
      },
      uploadedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'uploaded_by',
      },
      ocrStatus: {
        type: DataTypes.STRING(16),
        allowNull: true,
        field: 'ocr_status',
      },
      ocrRawText: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'ocr_raw_text',
      },
      ocrFacts: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'ocr_facts',
      },
      ocrProcessedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ocr_processed_at',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      tableName: 'vehicle_documents',
      timestamps: true,
      updatedAt: false,
      indexes: [{ fields: ['company_id', 'fleet_vehicle_id'] }],
    },
  );

  return VehicleDocument;
};
