import { Router } from 'express';
import { SupplierHotel } from '../types';

export const supplierARouter = Router();

const flakyMap = new Map<string, number>();

supplierARouter.get('/supplierA/hotels', (req, res) => {
  const city = req.query.city as string;
  const scenario = req.query._scenario as string;

  const data: SupplierHotel[] = [
    { hotelId: 'a-1', name: 'Grand Plaza Hotel', price: 120 },
    { hotelId: 'a-2', name: 'Sunrise Inn', price: 95 },
    { hotelId: 'a-3', name: 'The Royal Stay', price: 210 },
  ];

  if (scenario === 'error') {
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  if (scenario === 'empty') {
    return res.json([]);
  }

  if (scenario === 'flaky') {
    const attempts = flakyMap.get(city) || 0;
    flakyMap.set(city, attempts + 1);
    if (attempts < 2) {
      return res.status(500).json({ error: 'Flaky error' });
    }
  }

  if (scenario === 'slow') {
    // delay for 6500ms before responding
    setTimeout(() => {
      res.json(data);
    }, 6500);
    return;
  }

  // default response with slight delay
  setTimeout(() => {
    res.json(data);
  }, 200 + Math.random() * 100);
});
