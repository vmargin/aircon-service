#!/usr/bin/env node
/**
 * Generate a secure JWT secret for production use
 */

const crypto = require('crypto');

function generateJWTSecret() {
  return crypto.randomBytes(32).toString('hex');
}

console.log('Generate JWT Secret:');
console.log('=====================');
console.log();
console.log(`Your JWT Secret: ${generateJWTSecret()}`);
console.log();
console.log('Copy this secret and set it as an environment variable in production:');
console.log('JWT_SECRET="your-generated-secret-here"');
console.log();
console.log('⚠️  IMPORTANT: Do NOT commit real secrets to your repository!');
console.log('Use environment variables in production.');
console.log();
console.log('For development, you can use the .env.example as a template.');