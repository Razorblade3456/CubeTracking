# Cube Smash

Cube Smash is a React + Vite habit tracker / to-do list app with a game-inspired enemy cube board.

## Features

- Top game board with one enemy cube per habit/to-do item
- Cube state updates when item is completed/undone, with a play-button smash animation
- Add, edit, delete, complete, and undo actions
- localStorage persistence with model:
  - `{ id, text, createdAt, completed, completedAt }`
- Toast/snackbar feedback for user actions
- Responsive two-section layout (board + modern list card)

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal (usually `http://localhost:5173`).


## Troubleshooting

If `npm run dev` fails with `Cannot find module ... node_modules/vite/bin/vite.js` (or prints a generic `vite [options]` help screen), install dependencies first with `npm install` from the project root.

If you previously installed with production-only flags, reinstall with dev dependencies:

```bash
npm install --include=dev
```
