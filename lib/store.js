const fs = require('fs/promises');
const path = require('path');

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '..', 'data');
}

async function readJSON(file) {
  const filePath = path.join(getDataDir(), file);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeJSON(file, data) {
  const filePath = path.join(getDataDir(), file);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

module.exports = { readJSON, writeJSON };