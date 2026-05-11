/// <reference types="vite/client" />

// Fontsource packages ship WOFF2 + CSS assets with no TS declarations (by design).
// Declaring the module here satisfies TS strict side-effect import checking.
declare module '@fontsource-variable/inter' {}
