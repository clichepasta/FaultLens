const express = require('express');
const { Client } = require('@elastic/elasticsearch');

const app = express();
const port = process.env.PORT || 3000;
const esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Full querying endpoints
app.get('/errors', async (req, res) => {
  const { service, level, userId, from, to } = req.query;

  const must = [];

  if (service) must.push({ term: { service } });
  if (level) must.push({ term: { level } });
  if (userId) must.push({ term: { userId } });
  
  if (from || to) {
    const range = { timestamp: {} };
    if (from) range.timestamp.gte = from;
    if (to) range.timestamp.lte = to;
    must.push({ range });
  }

  const query = must.length > 0 ? { bool: { must } } : { match_all: {} };

  try {
    const result = await esClient.search({
      index: 'error-logs-*',
      size: 100,
      sort: [{ timestamp: { order: 'desc' } }],
      query
    });

    const hits = result.hits.hits.map(hit => ({
      id: hit._id,
      ...hit._source
    }));

    res.json({
      total: typeof result.hits.total === 'object' ? result.hits.total.value : result.hits.total,
      data: hits
    });
  } catch (error) {
    if (error.meta && error.meta.statusCode === 404) {
       return res.json({ total: 0, data: [] });
    }
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Advanced Feature: Group similar errors using message hash / terms aggregation
app.get('/errors/grouped', async (req, res) => {
  try {
    const result = await esClient.search({
      index: 'error-logs-*',
      size: 0,
      aggs: {
        error_groups: {
          terms: { field: 'messageHash', size: 10 },
          aggs: {
             sample: { top_hits: { size: 1 } }
          }
        }
      }
    });

    const groups = result.aggregations.error_groups.buckets.map(b => ({
      messageHash: b.key,
      count: b.doc_count,
      sample: b.sample.hits.hits[0]._source
    }));

    res.json({ data: groups });
  } catch (error) {
    if (error.meta && error.meta.statusCode === 404) {
       return res.json({ data: [] });
    }
    console.error('Group search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Advanced Feature: Alerting logic (Threshold-based)
async function checkAlerts() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = await esClient.search({
      index: 'error-logs-*',
      size: 0,
      query: {
        bool: {
          must: [
            { term: { level: 'error' } },
            { range: { timestamp: { gte: fiveMinutesAgo } } }
          ]
        }
      }
    });

    const errorCount = typeof result.hits.total === 'object' ? result.hits.total.value : result.hits.total;
    const threshold = 10; // low threshold for local dev demo

    if (errorCount > threshold) {
      console.warn(`[ALERT] HIGH ERROR RATE DETECTED! ${errorCount} errors in the last 5 minutes.`);
    }
  } catch (err) {
    if (err.meta && err.meta.statusCode === 404) {
      // index not found yet, which is fine at startup
      return;
    }
    console.error('Alert check failed', err.message);
  }
}

setInterval(checkAlerts, 60000); // Check every minute

app.listen(port, () => {
  console.log(`Backend API listening on port ${port}`);
});
