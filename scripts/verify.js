require('dotenv').config();
const bcrypt = require('bcrypt');
const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/verify.js <password>');
  process.exit(1);
}

console.log('Hash from .env:', process.env.ADMIN_PASS_HASH);
console.log('Hash length:   ', (process.env.ADMIN_PASS_HASH || '').length);

bcrypt.compare(password, process.env.ADMIN_PASS_HASH || '')
  .then(ok => {
    console.log('Match:', ok);
    process.exit(ok ? 0 : 1);
  });