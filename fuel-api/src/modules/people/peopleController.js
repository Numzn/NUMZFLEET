import * as svc from './peopleService.js';

export const listPeople = async (req, res) => {
  try {
    res.json(await svc.listCompanyPeople(req));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to load people' });
  }
};

export const getPerson = async (req, res) => {
  try {
    res.json(await svc.getCompanyPerson(req, req.params.traccarUserId));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to load person' });
  }
};

export const createPerson = async (req, res) => {
  try {
    res.status(201).json(await svc.createCompanyPerson(req));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to create person' });
  }
};

export const updatePerson = async (req, res) => {
  try {
    res.json(await svc.updateCompanyPerson(req, req.params.traccarUserId));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to update person' });
  }
};

export const deletePerson = async (req, res) => {
  try {
    res.json(await svc.deleteCompanyPerson(req, req.params.traccarUserId));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Failed to delete person' });
  }
};
