# Hotel Rate Comparator

A full-stack application that searches multiple mock hotel suppliers in parallel to find the best available rate for a given destination and dates. It uses Temporal for orchestrating resilient and reliable workflows.

## Architecture
- **Frontend**: A web app for users to input search parameters and view results.
- **Backend API**: An Express application serving endpoints and mock supplier APIs.
- **Temporal Workflow**: Manages the business logic for fetching rates. The frontend sends a request to the Express API, which kicks off a Temporal workflow. The workflow calls activities in parallel for `fetchSupplierA` and `fetchSupplierB`, returning the best rate.
- **Tech Stack**: TypeScript, Node.js, Express, React (assumed), Temporalio.

## Prerequisites
- Node.js 18+
- Temporal CLI or Docker
- npm

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Temporal Server
Option A (Temporal CLI - recommended for dev):
```bash
temporal server start-dev
```
Option B (Docker):
```bash
docker-compose up -d
```

### 3. Start the Backend
```bash
npm run dev:backend
```
This starts the Express server on port 3001 with mock supplier endpoints.

### 4. Start the Temporal Worker
In a separate terminal:
```bash
npm run dev:worker
```

### 5. Start the Frontend
In another terminal:
```bash
npm run dev:frontend
```
Opens at http://localhost:3000

## Running Tests
```bash
npm test
```
Tests use Temporal's TestWorkflowEnvironment with time-skipping to quickly validate timeouts and async behavior.

## Test Coverage

| Scenario | Expected Outcome |
|---|---|
| Supplier A cheaper | Returns A's result |
| Supplier B cheaper | Returns B's result |
| Same rate from both | Picks Supplier A (deterministic) |
| Supplier A fails, B works | Returns B's result |
| Both fail | Returns error |
| One returns empty | Uses available result |
| Both return empty | Returns 'No hotels found' |
| Slow supplier (>5s) | Proceeds with faster result |
| Supplier retries (fail then succeed) | Succeeds within retry policy |
| Workflow cancellation | Stops gracefully |

## Project Structure
```
tripare/
├── packages/
│   ├── backend/
│   │   ├── __tests__/     # Jest test files
│   │   ├── src/
│   │   │   ├── activities.ts # Temporal activities (API calls)
│   │   │   ├── server.ts     # Express server & API routes
│   │   │   ├── types.ts      # TypeScript definitions
│   │   │   ├── workflows.ts  # Temporal workflow definitions
│   │   │   └── suppliers/    # Mock supplier Express routers
│   ├── frontend/             # Frontend application source
├── README.md                 # Project documentation
└── package.json              # Monorepo configuration
```

## Mock Supplier Scenarios
The backend simulates supplier unreliability and varying results via a `_scenario` query parameter on the mock endpoints (`/supplierA/hotels` and `/supplierB/hotels`). 

Available scenarios:
- **(default)**: Returns a mocked list of hotels after a ~200ms delay.
- **`empty`**: Returns an empty array (no hotels available).
- **`error`**: Returns an HTTP 500 status code to simulate server outages.
- **`slow`**: Responds after ~6.5 seconds, triggering the activity timeout.
- **`flaky`**: Fails with 500 on the first 2 calls, succeeds on the 3rd (tracked per city).

## Known Limitations
- Suppliers are mocked, not real APIs.
- No database persistence — results are in-memory.
- No authentication.
- Frontend does not support cancellation UI (workflow cancellation is tested at the SDK level).
- Temporal server must be running locally for tests to execute.
