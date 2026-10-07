const bcrypt = require('bcrypt');
const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js <your_password>');
  process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
  console.log('\nAdd this line to your .env file:\n');
  console.log(`ADMIN_PASS_HASH=${hash}\n`);
});