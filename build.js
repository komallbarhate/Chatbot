const fs = require('fs');
const key = process.env.GEMINI_API_KEY || '';
const content = `const GEMINI_API_KEYS = ["${key}"]; const GEMINI_API_KEY = GEMINI_API_KEYS[0];`;
fs.writeFileSync('config.js', content);
console.log('config.js generated successfully.');
