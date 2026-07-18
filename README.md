# rx-editor-ckeditor5

## Build

Install the locked dependencies and build the editor with:

    npm ci
    npm run build

The npm `prebuild` lifecycle runs `scripts/patch-ckeditor-powered-by.mjs` before Vite. The patch removes the
CKEditor 5 Powered by badge initialization and its bundled styles. It is idempotent and fails with an explicit
error when the installed CKEditor version or source layout does not match the project dependency.
