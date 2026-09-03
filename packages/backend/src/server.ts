import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { supplierARouter, supplierBRouter } from './suppliers';
import { getTemporalClient } from './client';
import { searchHotelsWorkflow } from './workflows';

export const app = express();

app.use(cors());
app.use(express.json());

app.use(supplierARouter);
app.use(supplierBRouter);

app.post('/api/search-hotels', async (req, res) => {
  try {
    const { city, checkIn, checkOut } = req.body;
    if (!city || !checkIn || !checkOut) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const client = await getTemporalClient();
    const result = await client.workflow.execute(searchHotelsWorkflow, {
      taskQueue: 'hotel-search',
      workflowId: `search-${nanoid()}`,
      args: [{ city, checkIn, checkOut }]
    });

    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message || 'Workflow execution failed' });
  }
});

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}
