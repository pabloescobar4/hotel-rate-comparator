import { useState, FormEvent } from 'react';
import { HotelSearchParams } from '../types';
import './SearchForm.css';

interface SearchFormProps {
  onSearch: (params: HotelSearchParams) => void;
  loading: boolean;
}

export default function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Simple validation before sending the request
    if (new Date(checkOut) <= new Date(checkIn)) {
      alert('Check-out date must be after check-in date');
      return;
    }
    
    onSearch({ city, checkIn, checkOut });
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="field-group">
        <label htmlFor="city">City</label>
        <input 
          id="city" 
          type="text" 
          required 
          value={city} 
          onChange={e => setCity(e.target.value)} 
          placeholder="e.g. New York" 
        />
      </div>
      
      <div className="date-fields">
        <div className="field-group">
          <label htmlFor="checkIn">Check-in</label>
          <input 
            id="checkIn" 
            type="date" 
            required 
            value={checkIn} 
            onChange={e => setCheckIn(e.target.value)} 
          />
        </div>
        
        <div className="field-group">
          <label htmlFor="checkOut">Check-out</label>
          <input 
            id="checkOut" 
            type="date" 
            required 
            value={checkOut} 
            onChange={e => setCheckOut(e.target.value)} 
          />
        </div>
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Searching...' : 'Search Hotels'}
      </button>
    </form>
  );
}
