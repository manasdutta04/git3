# Contributing to git3

Thanks for helping make git3 better!

## Development setup

```bash
pnpm install
pnpm build
```

## Project structure

- `packages/core` — `git3` npm library
- `packages/studio` — `git3-studio` CLI + localhost GUI

## Run Studio locally

```bash
pnpm studio
```

If `.env` is missing, the GUI Connect screen asks for your GitHub token.

## Conventions

- TypeScript strict mode
- Named exports (no default exports except CLI entry)
- All errors extend `Git3Error`
- Forward slashes for repo paths
- Conventional commits

## Pull requests

1. Fork and create a feature branch
2. Keep changes focused
3. Update README if API changes
4. Open a PR with a clear description

## License

By contributing, you agree your contributions are licensed under the MIT License.
