import { Router } from 'express';
import { SupplierHotel } from '../types';

export const supplierBRouter = Router();

const flakyMap = new Map<string, number>();

supplierBRouter.get('/supplierB/hotels', (req, res) => {
  const city = req.query.city as string;
  const scenario = req.query._scenario as string;

  const data: SupplierHotel[] = [
    { hotelId: 'b-1', name: 'Ocean View Resort', price: 135 },
    { hotelId: 'b-2', name: 'Budget Stay Express', price: 88 },
    { hotelId: 'b-3', name: 'Lakeside Retreat', price: 175 },
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
