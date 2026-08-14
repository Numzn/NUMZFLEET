import { DataTypes } from 'sequelize';

/**
 * Phase 2D: Active-Context Switching
 * Persists which organization a Traccar user is currently operating in,
 * separate from their underlying identity (see tenantResolverService.js).
 * Row absence = default context (platform for super-admins, home company
 * otherwise). company_id === null = explicit platform context.
 */
export default (sequelize) => {
  const ActiveContext = sequelize.define(
    'ActiveContext',
    {
      traccarUserId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        field: 'traccar_user_id',
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'company_id',
        references: { model: 'companies', key: 'id' },
      },
    },
    {
      tableName: 'active_contexts',
      timestamps: true,
      createdAt: false,
      updatedAt: 'updated_at',
    },
  );

  return ActiveContext;
};
