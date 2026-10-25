/// <reference types="vite/client" />

// `window.overlay` is typed by src/preload/index.d.ts, which tsconfig.web.json includes. (Not
// imported: a path import would resolve to preload/index.ts and pull Electron into the web build.)
