import { config } from 'dotenv';
import open from 'open';
import { startStudio } from './server.js';

async function main() {
  config();

  const args = process.argv.slice(2).filter((a) => a !== '--');
  const command = args[0] || 'studio';

  if (command === 'studio' || command === 'help' || command === '--help' || command === '-h') {
    if (command === 'help' || command === '--help' || command === '-h') {
      console.log(`git3 — free MongoDB-like database on GitHub

Usage:
  git3 studio    Open the localhost GUI (connect with your GitHub token there)

Keys are set in the browser, not the terminal.
`);
      return;
    }

    const port = process.env.GIT3_STUDIO_PORT || '3847';
    await startStudio();
    await open(`http://localhost:${port}`);
    return;
  }

  console.log(`Unknown command "${command}".

Usage:
  git3 studio    Open the localhost GUI
`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
