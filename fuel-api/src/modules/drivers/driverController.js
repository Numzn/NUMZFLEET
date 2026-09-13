import * as service from './driverService.js';

export async function listDrivers(req, res) {
  try {
    res.json(await service.listCompanyDrivers(req));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to list drivers' });
  }
}

export async function getDriver(req, res) {
  try {
    res.json(await service.getCompanyDriver(req, req.params.driverId));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to load driver' });
  }
}

export async function getDriverVehicles(req, res) {
  try {
    res.json(await service.listCompanyDriverVehicles(req, req.params.driverId));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to load assigned vehicles' });
  }
}

export async function createDriver(req, res) {
  try {
    res.status(201).json(await service.createCompanyDriver(req));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to create driver' });
  }
}

export async function updateDriver(req, res) {
  try {
    res.json(await service.updateCompanyDriver(req, req.params.driverId));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update driver' });
  }
}

export async function deleteDriver(req, res) {
  try {
    await service.deleteCompanyDriver(req, req.params.driverId);
    res.status(204).end();
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to delete driver' });
  }
}
