import { HotelResult } from '../types';
import './ResultsPanel.css';

interface ResultsPanelProps {
  result: HotelResult | null;
  error: string | null;
  loading: boolean;
}

export default function ResultsPanel({ result, error, loading }: ResultsPanelProps) {
  if (loading) {
    return (
      <div className="result-container loading">
        <div className="spinner"></div>
        <p>Searching across suppliers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="result-card error-card">
        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="result-card success-card">
        <span className="best-rate-label">Best rate found</span>
        <h2 className="hotel-name">{result.name}</h2>
        <div className="price-container">
          <span className="price">${result.price}</span>
          <span className="per-night">per night</span>
        </div>
        <span className="supplier-badge">via {result.supplier}</span>
      </div>
    );
  }

  return null;
}
