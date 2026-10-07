
const request = require('supertest');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = path.join(__dirname, '..', 'test-data');
process.env.SESSION_SECRET = 'test-secret';

const app = require('../server');
const { setupTestData, readTestData } = require('./helpers');

beforeEach(async () => {
  await setupTestData();
});

describe('Contact', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/contact').send({});
    expect(res.status).toBe(400);
  });

  it('rejects short message', async () => {
    const res = await request(app).post('/api/contact').send({
      name: 'A',
      email: 'a@b.com',
      message: 'short'
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/contact').send({
      name: 'A',
      email: 'not-an-email',
      message: 'this is a long enough message'
    });
    expect(res.status).toBe(400);
  });

  it('accepts valid submission and stores it', async () => {
    const res = await request(app).post('/api/contact').send({
      name: 'Jane',
      email: 'jane@example.com',
      message: 'Hello, this is a legitimate message.'
    });
    expect(res.status).toBe(201);

    const messages = await readTestData('messages.json');
    expect(messages).toHaveLength(1);
    expect(messages[0].name).toBe('Jane');
    expect(messages[0].read).toBe(false);
  });
});