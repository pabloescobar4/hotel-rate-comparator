import axios from 'axios';
import { fetchSupplierA, fetchSupplierB } from '../src/activities';
import type { HotelSearchParams } from '../src/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Activities', () => {
  const params: HotelSearchParams = {
    city: 'Mumbai',
    checkIn: '2024-12-01',
    checkOut: '2024-12-05',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetchSupplierA calls the correct URL with params', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    await fetchSupplierA(params);
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3001/supplierA/hotels', {
      params: { city: params.city, checkIn: params.checkIn, checkOut: params.checkOut },
      timeout: 7000,
    });
  });

  it('fetchSupplierA returns hotel data from response', async () => {
    const mockData = [{ hotelId: 'a-1', name: 'Hotel Alpha', price: 100 }];
    mockedAxios.get.mockResolvedValue({ data: mockData });
    const result = await fetchSupplierA(params);
    expect(result).toEqual(mockData);
  });

  it('fetchSupplierA throws on network error', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network error'));
    await expect(fetchSupplierA(params)).rejects.toThrow('Network error');
  });

  it('fetchSupplierB calls the correct URL', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    await fetchSupplierB(params);
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3001/supplierB/hotels', {
      params: { city: params.city, checkIn: params.checkIn, checkOut: params.checkOut },
      timeout: 7000,
    });
  });

  it('fetchSupplierB returns hotel data', async () => {
    const mockData = [{ hotelId: 'b-1', name: 'Hotel Beta', price: 90 }];
    mockedAxios.get.mockResolvedValue({ data: mockData });
    const result = await fetchSupplierB(params);
    expect(result).toEqual(mockData);
  });
});
