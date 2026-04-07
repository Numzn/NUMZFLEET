import { getLatestErbPrices } from '../adapters/erbAdapter.js';

export const getErbLatestPrices = async (req, res) => {
  try {
    const result = await getLatestErbPrices();
    return res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error('❌ ERB latest prices relay error:', error);
    return res.status(500).json({ error: 'Failed to fetch ERB latest prices' });
  }
};
