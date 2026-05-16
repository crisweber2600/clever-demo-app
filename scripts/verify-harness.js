const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireIncludes(relativePath, expected) {
  const content = read(relativePath);
  if (!content.includes(expected)) {
    throw new Error(`${relativePath} is missing expected anchor: ${expected}`);
  }
}

const packageJson = JSON.parse(read('package.json'));

if (!packageJson.scripts || !packageJson.scripts.test) {
  throw new Error('package.json must expose an npm test command for agents');
}

if (packageJson.scripts.test.includes('no test specified')) {
  throw new Error('npm test must not be the placeholder failing script');
}

requireIncludes('AGENTS.md', 'Golden Rules');
requireIncludes('AGENTS.md', 'npm test');
requireIncludes('README.md', 'CLEVER_CLIENT_ID');
requireIncludes('README.md', 'http://localhost:3000/auth/clever/callback');
requireIncludes('server.js', '/auth/clever/callback');
requireIncludes('server.js', '/dashboard');
requireIncludes('db.js', 'CREATE TABLE IF NOT EXISTS users');
requireIncludes('db.js', 'CREATE TABLE IF NOT EXISTS events');

console.log('Harness verification passed');