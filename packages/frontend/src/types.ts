export interface HotelSearchParams {
  city: string;
  checkIn: string;
  checkOut: string;
}

export interface HotelResult {
  hotelId: string;
  name: string;
  price: number;
  supplier: string;
}

export interface SearchResponse {
  success: boolean;
  result?: HotelResult;
  error?: string;
}
