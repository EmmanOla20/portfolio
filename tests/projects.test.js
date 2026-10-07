
const request = require('supertest');
const bcrypt = require('bcrypt');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = path.join(__dirname, '..', 'test-data');
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASS_HASH = bcrypt.hashSync('testpass', 4);
process.env.SESSION_SECRET = 'test-secret';

const app = require('../server');
const { setupTestData, readTestData } = require('./helpers');

async function loggedInAgent() {
  const agent = request.agent(app);
  await agent.post('/api/login').send({ username: 'admin', password: 'testpass' });
  return agent;
}

beforeEach(async () => {
  await setupTestData({
    projects: [
      { id: 'p1', title: 'Existing', description: 'old', url: 'https://x', tags: ['a'] }
    ]
  });
});

describe('Projects', () => {
  it('GET /api/projects is public', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /api/projects rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ title: 'X', description: 'Y', url: 'https://z' });
    expect(res.status).toBe(401);
  });

  it('POST /api/projects rejects invalid body', async () => {
    const agent = await loggedInAgent();
    const res = await agent.post('/api/projects').send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('POST /api/projects creates when authenticated', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .post('/api/projects')
      .send({ title: 'New', description: 'desc', url: 'https://new', tags: ['t'] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();

    const file = await readTestData('projects.json');
    expect(file).toHaveLength(2);
  });

  it('PUT /api/projects/:id updates', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .put('/api/projects/p1')
      .send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.description).toBe('old');
  });

  it('DELETE /api/projects/:id removes', async () => {
    const agent = await loggedInAgent();
    const res = await agent.delete('/api/projects/p1');
    expect(res.status).toBe(200);

    const file = await readTestData('projects.json');
    expect(file).toHaveLength(0);
  });

  it('DELETE returns 404 for missing id', async () => {
    const agent = await loggedInAgent();
    const res = await agent.delete('/api/projects/nope');
    expect(res.status).toBe(404);
  });
});