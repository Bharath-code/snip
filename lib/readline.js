/**
 * Native readline helper — one question at a time (replaces readline-sync).
 * Returns a Promise so callers use async/await.
 */
const readline = require('readline');

function question(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

module.exports = { question };
