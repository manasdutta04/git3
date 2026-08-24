#!/usr/bin/env node
import { config } from 'dotenv';
import open from 'open';
import { startStudio } from './server.js';

async function main() {
  config();

  const args = process.argv.slice(2);
  const command = args[0] || 'studio';

  if (command === 'studio') {
    const port = process.env.GIT3_STUDIO_PORT || '3847';
    await startStudio();
    await open(`http://localhost:${port}`);
  } else {
    console.log(`git3 — free MongoDB-like database on GitHub\n`);
    console.log(`Usage:\n  git3 studio   Open localhost Studio GUI\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
