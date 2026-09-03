import { proxyActivities, ApplicationFailure, log } from '@temporalio/workflow';
import type * as activities from './activities';
import type { HotelSearchParams, HotelResult, SupplierHotel } from './types';

const { fetchSupplierA, fetchSupplierB } = proxyActivities<typeof activities>({
  startToCloseTimeout: '6s',
  scheduleToCloseTimeout: '10s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function searchHotelsWorkflow(params: HotelSearchParams): Promise<HotelResult> {
  log.info('Starting hotel search', { city: params.city });

  // fire both supplier calls in parallel
  const [resultA, resultB] = await Promise.allSettled([
    fetchSupplierA(params),
    fetchSupplierB(params),
  ]);

  const hotelsA: SupplierHotel[] = resultA.status === 'fulfilled' ? resultA.value : [];
  const hotelsB: SupplierHotel[] = resultB.status === 'fulfilled' ? resultB.value : [];

  const bothFailed = resultA.status === 'rejected' && resultB.status === 'rejected';
  if (bothFailed) {
    throw ApplicationFailure.nonRetryable(
      'Both suppliers failed to respond',
      'SUPPLIERS_UNAVAILABLE'
    );
  }

  // tag each hotel with its supplier
  const allHotels: HotelResult[] = [
    ...hotelsA.map(h => ({ ...h, supplier: 'Supplier A' })),
    ...hotelsB.map(h => ({ ...h, supplier: 'Supplier B' })),
  ];

  if (allHotels.length === 0) {
    throw ApplicationFailure.nonRetryable('No hotels found', 'NO_RESULTS');
  }

  // pick the cheapest; ties go to Supplier A (which appears first)
  allHotels.sort((a, b) => a.price - b.price);

  log.info('Best rate found', { hotel: allHotels[0].name, price: allHotels[0].price });
  return allHotels[0];
}
