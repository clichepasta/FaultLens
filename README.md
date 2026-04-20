# Real-Time Error Monitoring System

This project is a distributed real-time error logging and monitoring system built using:
- **Backend**: Node.js (Express)
- **Messaging Pipeline**: Apache Kafka
- **Log Processing Pipeline**: Logstash
- **Search & Storage DB**: Elasticsearch (No Security / Local)
- **Visualization Dashboard**: Kibana
- **Log Generators**: Microservices (auth, payment, order)

## Architecture Overview

1. **Microservices (Producers)** generate structured JSON logs (info, warn, error) using `kafkajs` and publish them immediately to the `error-logs` Kafka topic.
2. **Kafka** buffers these high-throughput messages safely.
3. **Logstash (Consumer & Processor)** reads from Kafka, adds `env=production` fields, computes an exact hash for true 'error' levels (grouping), and sends the processed structured document to **Elasticsearch**.
4. **Elasticsearch** indexes data daily (`error-logs-YYYY.MM.DD`).
5. **Backend API** (Node.js) exposes endpoints querying Elasticsearch directly. It also monitors for error spikes > threshold.
6. **Kibana** offers UI searching and dashboarding.

## Prerequisites

- Docker and Docker Compose installed

## Setup & Running

1. **Start the Stack**
Run the entire infrastructure and applications in detached mode:
```bash
docker-compose up --build -d
```
*Note: The first launch might take some time as it pulls images and waits securely for dependencies (like kafka-init-topics waiting for Kafka readiness).*

2. **Verify Containers**
```bash
docker ps
```
You should see: Elasticsearch, Zookeeper, Kafka, Logstash, Kibana, Backend-API, and the three log generators (auth-service, payment-service, order-service) properly running.

## Using the API

The Backend API is exposed at **`http://localhost:3000`**.

### Endpoints

- **GET All Logs**
  ```http
  GET /errors
  ```
- **Filter API examples**
  ```http
  GET /errors?service=payment-service
  GET /errors?level=error
  GET /errors?userId=user-123
  GET /errors?from=2023-01-01T00:00:00Z&to=2024-01-01T00:00:00Z
  ```
- **[Advanced] Grouped Errors**
  Count occurrences and group similar errors implicitly hashed by Logstash:
  ```http
  GET /errors/grouped
  ```

## Kibana Dashboards

Kibana UI is mapped to **`http://localhost:5601`**.

1. Navigate to Kibana.
2. Go to **Stack Management > Data Views (Index Patterns)**.
3. Create a data view named `error-logs-*` matching the timestamp field `@timestamp` or `timestamp`.
4. Go to **Discover** tab to see your logs filtering through in real time.
5. Go to **Dashboards** and create metrics like:
   - Error count over time (Vertical Bar Chart)
   - Top services with errors (Donut Chart)

## Stopping

To tear down all resources and remove volumes:
```bash
docker-compose down -v
```
