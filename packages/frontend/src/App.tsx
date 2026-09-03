import { useState } from 'react';
import SearchForm from './components/SearchForm';
import ResultsPanel from './components/ResultsPanel';
import { HotelSearchParams, HotelResult, SearchResponse } from './types';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HotelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (params: HotelSearchParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/search-hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      const data: SearchResponse = await response.json();
      
      if (data.success && data.result) {
        setResult(data.result);
      } else {
        setError(data.error || 'Failed to find hotels');
      }
    } catch (err) {
      // In a real app we'd want to log this properly
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Hotel Rate Comparator</h1>
        <p className="subtitle">Find the best deal across suppliers</p>
      </header>
      
      <main>
        <SearchForm onSearch={handleSearch} loading={loading} />
        <ResultsPanel result={result} error={error} loading={loading} />
      </main>
    </div>
  );
}

export default App;
