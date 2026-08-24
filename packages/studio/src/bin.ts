import { config } from 'dotenv';
import open from 'open';
import { Git3 } from '@git3db/db';
import { startStudio } from './server.js';

async function main() {
  config();

  const args = process.argv.slice(2).filter((a) => a !== '--');
  const command = args[0] || 'studio';

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`git3 — free MongoDB-like database on GitHub

Usage:
  git3 studio    Open the localhost GUI (connect with your GitHub token there)
  git3 serve     API only for local HTML apps (port 3850)

Keys stay on this machine. Never put GIT3_TOKEN in browser JavaScript.
`);
    return;
  }

  if (command === 'serve') {
    if (!Git3.isConfigured()) {
      console.error('Not connected. Run `npx git3 studio` first and paste your token there.');
      process.exit(1);
    }
    const port = Number(process.env.GIT3_SERVE_PORT || 3850);
    await startStudio({ port, serveUi: false, cors: true });
    return;
  }

  if (command === 'studio') {
    const port = Number(process.env.GIT3_STUDIO_PORT || 3847);
    await startStudio({ port, serveUi: true, cors: false });
    await open(`http://localhost:${port}`);
    return;
  }

  console.log(`Unknown command "${command}".

Usage:
  git3 studio    Open the localhost GUI
  git3 serve     API only for local HTML apps
`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
