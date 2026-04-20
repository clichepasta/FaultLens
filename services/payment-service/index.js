const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const SERVICE_NAME = process.env.SERVICE_NAME || 'payment-service';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:29092'];

const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers: KAFKA_BROKERS
});

const producer = kafka.producer();

const levels = ['info', 'warn', 'error'];
const errorMessages = [
  'Payment declined',
  'Insufficient funds',
  'Gateway timeout',
  'Invalid credit card'
];

async function generateLog() {
  const level = levels[Math.floor(Math.random() * levels.length)];
  const isError = level === 'error';
  
  const log = {
    service: SERVICE_NAME,
    level: level,
    message: isError ? errorMessages[Math.floor(Math.random() * errorMessages.length)] : `${SERVICE_NAME} processed request successfully`,
    timestamp: new Date().toISOString(),
    userId: `user-${Math.floor(Math.random() * 1000)}`,
    requestId: uuidv4(),
  };

  if (isError) {
    log.stackTrace = `Error: ${log.message}\n    at /app/index.js:30:15\n    at async generateLog (/app/index.js:35:5)`;
  }

  try {
    await producer.send({
      topic: 'error-logs',
      messages: [
        { value: JSON.stringify(log) },
      ],
    });
    console.log(`[${SERVICE_NAME}] Sent log: ${log.level} - ${log.message}`);
  } catch (error) {
    console.error('Error sending log to Kafka', error);
  }
}

async function run() {
  await producer.connect();
  console.log(`[${SERVICE_NAME}] Connected to Kafka`);
  
  setInterval(generateLog, 3000 + Math.random() * 2000);
}

run().catch(console.error);
