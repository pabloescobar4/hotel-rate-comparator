import axios from 'axios';
import { SupplierHotel, HotelSearchParams } from './types';

const SUPPLIER_BASE = process.env.SUPPLIER_BASE_URL || 'http://localhost:3001';

export async function fetchSupplierA(params: HotelSearchParams): Promise<SupplierHotel[]> {
  try {
    const resp = await axios.get<SupplierHotel[]>(`${SUPPLIER_BASE}/supplierA/hotels`, {
      params: { city: params.city, checkIn: params.checkIn, checkOut: params.checkOut },
      timeout: 7000,
    });
    return resp.data;
  } catch (err: any) {
    console.error(`fetchSupplierA failed: ${err.message}`);
    throw err;
  }
}

export async function fetchSupplierB(params: HotelSearchParams): Promise<SupplierHotel[]> {
  try {
    const resp = await axios.get<SupplierHotel[]>(`${SUPPLIER_BASE}/supplierB/hotels`, {
      params: { city: params.city, checkIn: params.checkIn, checkOut: params.checkOut },
      timeout: 7000,
    });
    return resp.data;
  } catch (err: any) {
    console.error(`fetchSupplierB failed: ${err.message}`);
    throw err;
  }
}
