
const request = require('supertest');
const bcrypt = require('bcrypt');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = path.join(__dirname, '..', 'test-data');
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS_HASH = bcrypt.hashSync('testpass', 4);
process.env.SESSION_SECRET = 'test-secret';

const app = require('../server');
const { setupTestData } = require('./helpers');

beforeAll(async () => {
  await setupTestData();
});

describe('Auth', () => {
  it('rejects unauthenticated /api/me', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects wrong username', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'someone', password: 'testpass' });
    expect(res.status).toBe(401);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/login').send({});
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials and returns /api/me', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/login')
      .send({ username: 'admin', password: 'testpass' });
    expect(login.status).toBe(200);

    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.loggedIn).toBe(true);
  });

  it('logs out and loses access', async () => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ username: 'admin', password: 'testpass' });
    const out = await agent.post('/api/logout');
    expect(out.status).toBe(200);

    const me = await agent.get('/api/me');
    expect(me.status).toBe(401);
  });
});