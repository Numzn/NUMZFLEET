import { getFuelSummaryReport } from '../services/reportsService.js';

export const getFuelSummary = async (req, res) => {
  try {
    const result = await getFuelSummaryReport({
      query: req.query,
      user: req.user,
    });

    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error('❌ Fuel summary report error:', error);
    return res.status(500).json({ error: 'Failed to generate fuel summary report' });
  }
};
