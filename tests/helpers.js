const fs = require('fs/promises');
const path = require('path');

const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

async function setupTestData({ projects = [], messages = [] } = {}) {
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'projects.json'),
    JSON.stringify(projects, null, 2)
  );
  await fs.writeFile(
    path.join(TEST_DATA_DIR, 'messages.json'),
    JSON.stringify(messages, null, 2)
  );
}

async function readTestData(file) {
  const raw = await fs.readFile(path.join(TEST_DATA_DIR, file), 'utf8');
  return JSON.parse(raw);
}

module.exports = { setupTestData, readTestData, TEST_DATA_DIR };