import request from 'supertest';
import { app } from '../src/server';

describe('Supplier Endpoints', () => {
  it('GET /supplierA/hotels returns hotel list', async () => {
    const res = await request(app).get('/supplierA/hotels?city=Mumbai');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('hotelId');
      expect(res.body[0]).toHaveProperty('price');
    }
  });

  it('GET /supplierA/hotels?_scenario=empty returns empty array', async () => {
    const res = await request(app).get('/supplierA/hotels?city=Mumbai&_scenario=empty');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /supplierA/hotels?_scenario=error returns 500', async () => {
    const res = await request(app).get('/supplierA/hotels?city=Mumbai&_scenario=error');
    expect(res.status).toBe(500);
  });

  it('GET /supplierB/hotels returns hotel list', async () => {
    const res = await request(app).get('/supplierB/hotels?city=Mumbai');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('hotelId');
      expect(res.body[0]).toHaveProperty('price');
    }
  });

  it('GET /supplierB/hotels?_scenario=empty returns empty array', async () => {
    const res = await request(app).get('/supplierB/hotels?city=Mumbai&_scenario=empty');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /supplierB/hotels?_scenario=error returns 500', async () => {
    const res = await request(app).get('/supplierB/hotels?city=Mumbai&_scenario=error');
    expect(res.status).toBe(500);
  });
});
