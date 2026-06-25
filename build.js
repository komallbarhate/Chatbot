const fs = require('fs');

const key1 = process.env.GEMINI_API_KEY_1 || '';
const key2 = process.env.GEMINI_API_KEY_2 || '';
const key3 = process.env.GEMINI_API_KEY_3 || '';

const keys = [key1, key2, key3].filter(k => k.length > 0);

if (keys.length === 0) {
  console.error('ERROR: No Gemini API keys found in environment variables!');
  process.exit(1);
}

const keysJson = JSON.stringify(keys);
const content = `const GEMINI_API_KEYS = ${keysJson}; const GEMINI_API_KEY = GEMINI_API_KEYS[0];`;
fs.writeFileSync('config.js', content);
console.log(`config.js generated with ${keys.length} API key(s).`);
