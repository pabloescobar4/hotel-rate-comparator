import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowFailedError, CancelledFailure } from '@temporalio/client';
import { searchHotelsWorkflow } from '../src/workflows';
import type * as activities from '../src/activities';
import type { HotelSearchParams, SupplierHotel } from '../src/types';

const testParams: HotelSearchParams = {
  city: 'Mumbai',
  checkIn: '2024-12-01',
  checkOut: '2024-12-05',
};

describe('searchHotelsWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  // Helper to run a test with given mock activities
  async function runWorkflowWithMocks(
    mockActivities: Record<string, (...args: any[]) => any>,
    workflowId?: string
  ) {
    const { client, nativeConnection } = testEnv;
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-hotel-search',
      workflowsPath: require.resolve('../src/workflows'),
      activities: mockActivities as any,
    });

    return worker.runUntil(async () => {
      return client.workflow.execute(searchHotelsWorkflow, {
        taskQueue: 'test-hotel-search',
        workflowId: workflowId || `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        args: [testParams],
      });
    });
  }

  it('returns Supplier A result when A is cheaper', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockResolvedValue([{ hotelId: 'a-1', name: 'Hotel Alpha', price: 80 }]),
      fetchSupplierB: jest.fn().mockResolvedValue([{ hotelId: 'b-1', name: 'Hotel Beta', price: 120 }]),
    };
    const result = await runWorkflowWithMocks(mockActivities);
    expect(result.supplier).toBe('Supplier A');
    expect(result.price).toBe(80);
  });

  it('returns Supplier B result when B is cheaper', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockResolvedValue([{ hotelId: 'a-1', name: 'Hotel Alpha', price: 150 }]),
      fetchSupplierB: jest.fn().mockResolvedValue([{ hotelId: 'b-1', name: 'Hotel Beta', price: 90 }]),
    };
    const result = await runWorkflowWithMocks(mockActivities);
    expect(result.supplier).toBe('Supplier B');
    expect(result.price).toBe(90);
  });

  it('picks Supplier A deterministically when both have same price', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockResolvedValue([{ hotelId: 'a-1', name: 'Hotel Alpha', price: 100 }]),
      fetchSupplierB: jest.fn().mockResolvedValue([{ hotelId: 'b-1', name: 'Hotel Beta', price: 100 }]),
    };
    const result = await runWorkflowWithMocks(mockActivities);
    expect(result.supplier).toBe('Supplier A');
    expect(result.price).toBe(100);
  });

  it('returns Supplier B result when Supplier A fails', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockRejectedValue(new Error('Connection refused')),
      fetchSupplierB: jest.fn().mockResolvedValue([{ hotelId: 'b-1', name: 'Hotel Beta', price: 100 }]),
    };
    const result = await runWorkflowWithMocks(mockActivities);
    expect(result.supplier).toBe('Supplier B');
    expect(result.price).toBe(100);
  });

  it('throws error when both suppliers fail', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockRejectedValue(new Error('Connection refused')),
      fetchSupplierB: jest.fn().mockRejectedValue(new Error('Timeout')),
    };
    await expect(runWorkflowWithMocks(mockActivities)).rejects.toThrow('Both suppliers failed');
  });

  it('uses available result when one returns empty', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockResolvedValue([]),
      fetchSupplierB: jest.fn().mockResolvedValue([{ hotelId: 'b-1', name: 'Hotel Beta', price: 100 }]),
    };
    const result = await runWorkflowWithMocks(mockActivities);
    expect(result.supplier).toBe('Supplier B');
    expect(result.price).toBe(100);
  });

  it('throws no hotels found when both return empty', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockResolvedValue([]),
      fetchSupplierB: jest.fn().mockResolvedValue([]),
    };
    await expect(runWorkflowWithMocks(mockActivities)).rejects.toThrow('No hotels found');
  });

  it('handles one slow supplier by proceeding with the other result', async () => {
    // Simulating activity timeout from Temporal's perspective
    const mockActivities = {
      fetchSupplierA: jest.fn().mockRejectedValue(new Error('Activity timed out')),
      fetchSupplierB: jest.fn().mockResolvedValue([{ hotelId: 'b-1', name: 'Hotel Beta', price: 100 }]),
    };
    const result = await runWorkflowWithMocks(mockActivities);
    expect(result.supplier).toBe('Supplier B');
    expect(result.price).toBe(100);
  });

  it('succeeds after Supplier A fails twice then succeeds (retry behavior)', async () => {
    let callCount = 0;
    const fetchSupplierA = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error('Temporary failure'));
      }
      return Promise.resolve([{ hotelId: 'a-1', name: 'Hotel Alpha', price: 85 }]);
    });
    
    const mockActivities = {
      fetchSupplierA,
      fetchSupplierB: jest.fn().mockResolvedValue([{ hotelId: 'b-1', name: 'Hotel Beta', price: 200 }]),
    };
    const result = await runWorkflowWithMocks(mockActivities);
    expect(result.supplier).toBe('Supplier A');
    expect(result.price).toBe(85);
  });

  it('workflow cancellation stops execution', async () => {
    const mockActivities = {
      fetchSupplierA: jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50000))),
      fetchSupplierB: jest.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50000))),
    };

    const workflowId = 'test-cancel-workflow';
    const { client, nativeConnection } = testEnv;
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-cancel-queue',
      workflowsPath: require.resolve('../src/workflows'),
      activities: mockActivities as any,
    });

    const runPromise = worker.runUntil(async () => {
      const handle = await client.workflow.start(searchHotelsWorkflow, {
        taskQueue: 'test-cancel-queue',
        workflowId,
        args: [testParams],
      });
      // Give it a tick to start then cancel
      await handle.cancel();
      return handle.result();
    });

    await expect(runPromise).rejects.toThrow(WorkflowFailedError);
  });
});
