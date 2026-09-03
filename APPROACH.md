# Approach & Design Document

## Overview

This project builds a **Hotel Rate Comparator** — a full-stack application where users search for hotels by city and dates, and the backend fetches rates from two competing suppliers in parallel, returning the cheapest option. The core orchestration layer is powered by **Temporal.io**, which provides durable workflow execution, automatic retries, timeout handling, and graceful cancellation out of the box.

## Why Temporal?

Hotel search involves calling external supplier APIs that are inherently unreliable — they can be slow, return errors, or drop connections. A naive approach using raw `Promise.all` in an Express handler would require hand-rolling retry logic, timeout management, dead-letter handling, and idempotency checks. Temporal abstracts all of that:

- **Automatic retries** with configurable backoff — if a supplier call fails, Temporal retries it transparently based on the retry policy (up to 3 attempts, 1s initial backoff, 2x coefficient).
- **Activity timeouts** — each supplier call has a `startToCloseTimeout` of 6 seconds. If a supplier takes too long, the activity is failed and either retried or treated as a failure.
- **Durable execution** — if the worker process crashes mid-workflow, Temporal replays the workflow from the last checkpoint when a new worker picks it up. No lost searches.
- **Cancellation support** — workflows can be cancelled programmatically via the Temporal client, and activities respect cancellation signals.

## Architecture

```
┌──────────────┐     POST /api/search-hotels     ┌──────────────────┐
│   React UI   │ ──────────────────────────────►  │   Express API    │
│  (port 3000) │  ◄─────────────────────────────  │   (port 3001)    │
└──────────────┘        JSON response             └────────┬─────────┘
                                                           │
                                                  workflow.execute()
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │  Temporal Server  │
                                                  │   (port 7233)    │
                                                  └────────┬─────────┘
                                                           │
                                                    task dispatch
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │  Temporal Worker  │
                                                  │                  │
                                                  │ ┌──────────────┐ │
                                                  │ │  Workflow:    │ │
                                                  │ │  searchHotels │ │
                                                  │ └──────┬───────┘ │
                                                  │        │         │
                                                  │  Promise.allSettled()
                                                  │   ┌────┴────┐    │
                                                  │   ▼         ▼    │
                                                  │ fetchA()  fetchB()│
                                                  │   │         │    │
                                                  └───┼─────────┼────┘
                                                      │         │
                                              HTTP GET │  HTTP GET│
                                                      ▼         ▼
                                              ┌──────────┐ ┌──────────┐
                                              │Supplier A│ │Supplier B│
                                              │  /hotels │ │  /hotels │
                                              └──────────┘ └──────────┘
```

### Flow

1. User fills in city, check-in, and check-out dates on the React frontend.
2. Frontend sends a `POST /api/search-hotels` request to the Express server.
3. Express creates a Temporal workflow execution with a unique ID.
4. The Temporal worker picks up the task and runs `searchHotelsWorkflow`.
5. The workflow fires `fetchSupplierA` and `fetchSupplierB` activities **in parallel** using `Promise.allSettled`.
6. Each activity makes an HTTP GET to the respective mock supplier endpoint.
7. The workflow collects results, tags each hotel with its supplier name, sorts by price, and returns the cheapest option.
8. If both suppliers fail, the workflow throws a non-retryable `ApplicationFailure`. If both return empty arrays, it throws "No hotels found".
9. Express receives the workflow result (or error) and responds to the frontend.

## Key Design Decisions

### 1. `Promise.allSettled` over `Promise.all`

Using `Promise.allSettled` ensures that if one supplier call fails, the other is not cancelled. This is critical — we want to return *any* available result rather than failing the entire search because one supplier is down.

### 2. Deterministic Tie-Breaking

When both suppliers return the same lowest price, Supplier A always wins. This is achieved naturally by placing Supplier A results first in the merged array — JavaScript's `Array.sort` is stable, so equal-priced items retain their original order.

### 3. Activity Retry Policy

```typescript
retry: {
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumAttempts: 3,
}
```

This means a failing supplier gets up to 3 chances (at 0s, 1s, 2s delays). This covers the "Supplier A fails 2x before success" scenario without any custom logic.

### 4. Timeout Strategy

- `startToCloseTimeout: 6s` — a single activity attempt must complete within 6 seconds, otherwise it's killed. This handles the "slow supplier" scenario.
- `scheduleToCloseTimeout: 10s` — total time for all retries combined. Prevents indefinite retry loops.

### 5. Separation of Server and Worker

The Express server and the Temporal worker are separate processes. This is intentional:
- The server handles HTTP requests and starts workflows.
- The worker executes workflow and activity code.
- They can be scaled independently — you can run multiple workers to handle more concurrent searches without touching the API server.

### 6. Mock Supplier Scenarios

Suppliers support a `_scenario` query parameter to simulate different real-world failure modes:
- `normal` (default) — 200ms delay, returns hotel data
- `slow` — 6.5s delay, triggers timeout
- `error` — HTTP 500
- `empty` — returns `[]`
- `flaky` — fails first 2 calls, succeeds on 3rd (tracked per city in memory)

This makes it easy to test and demonstrate each scenario without modifying code.

### 7. Frontend Simplicity

The React frontend is intentionally minimal — a single page with a form and a results panel. It uses native `fetch` (no axios) and basic CSS (no frameworks). The goal is clarity, not UI complexity. Vite proxies `/api` requests to the backend during development so there are no CORS issues.

## Error Handling Strategy

| Scenario | How It's Handled |
|---|---|
| One supplier fails | `Promise.allSettled` catches the rejection, other result is used |
| Both suppliers fail | Workflow throws `ApplicationFailure.nonRetryable('Both suppliers failed')` |
| One returns empty | Empty array is valid — other supplier's results are used |
| Both return empty | Workflow throws `ApplicationFailure.nonRetryable('No hotels found')` |
| Supplier is slow (>6s) | Activity times out, Temporal retries. After 3 fails, treated as failure |
| Supplier is flaky | Temporal's retry policy handles it — fail, wait 1s, retry, wait 2s, retry |
| Workflow cancelled | Temporal propagates cancellation to running activities |
| Worker crashes | Temporal replays workflow on another worker from last checkpoint |
| Express server error | Returns `{ success: false, error: "..." }` — frontend shows error card |

## Test Strategy

### Unit Tests (Jest)
- **Activity tests** — mock `axios` to verify correct URL construction, parameter passing, and error propagation.
- **Supplier tests** — use `supertest` against the Express app to validate each mock scenario returns the expected status code and data shape.

### Workflow Tests (Temporal TestWorkflowEnvironment)
- Uses Temporal's `TestWorkflowEnvironment.createTimeSkipping()` which spins up a local test server.
- Mock activities are injected via `jest.fn()` to control supplier behavior per test.
- Covers all 10 scenarios from the requirements:
  - A cheaper, B cheaper, same price, A fails, both fail, one empty, both empty, slow supplier, retry behavior, cancellation.

### End-to-End Verification
- Manual verification with the full stack running (Temporal server + backend + worker + frontend).
- Confirmed via API calls that the workflow correctly returns the cheapest hotel across suppliers.

## Tech Stack Summary

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite 4 | Fast dev server, type safety, minimal setup |
| Backend API | Express.js + TypeScript | Lightweight, widely understood, easy to test |
| Orchestration | Temporal.io TypeScript SDK | Durable workflows, retries, timeouts, cancellation |
| Mock Suppliers | Express Routers | Co-located with the backend for simplicity |
| Testing | Jest + Temporal TestWorkflowEnvironment + Supertest | Full coverage from unit to workflow level |
| Infrastructure | Docker Compose (optional) | One-command Temporal server setup |

## Assumptions & Limitations

- Suppliers are mocked in-process — in production, they'd be separate services or third-party APIs.
- No database — search results are not persisted. Each search is a fresh workflow execution.
- No authentication or rate limiting on the API.
- Frontend does not expose a "cancel search" button — cancellation is tested at the Temporal SDK level in the test suite.
- The Temporal server must be running for the backend to function and for workflow tests to execute.
- The project was developed and tested on Node.js 16 (with engine compatibility warnings). Node.js 18+ is recommended for full compatibility.
