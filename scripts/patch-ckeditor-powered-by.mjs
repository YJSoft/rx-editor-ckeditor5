// Remove the CKEditor 5 "Powered by" badge before Vite bundles the editor.
// @license GPL-2.0-or-later

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const projectPackagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const ckeditorPackagePath = fileURLToPath(new URL('../node_modules/ckeditor5/package.json', import.meta.url));
const uiSourcePath = fileURLToPath(new URL('../node_modules/@ckeditor/ckeditor5-ui/dist/index.js', import.meta.url));
const stylesheetPath = fileURLToPath(new URL('../node_modules/ckeditor5/dist/ckeditor5.css', import.meta.url));

const projectPackage = JSON.parse(await readFile(projectPackagePath, 'utf8'));
const ckeditorPackage = JSON.parse(await readFile(ckeditorPackagePath, 'utf8'));
const expectedVersion = projectPackage.dependencies?.ckeditor5;

if (!expectedVersion || ckeditorPackage.version !== expectedVersion) {
    throw new Error(
        'CKEditor version mismatch: package.json requires ' + (expectedVersion || '(missing)') +
        ', but node_modules contains ' + (ckeditorPackage.version || '(unknown)') + '. Run npm ci first.',
    );
}

function replaceOnce(source, original, replacement, filename) {
    const occurrences = source.split(original).length - 1;

    if (occurrences === 1) return source.replace(original, replacement);
    if (occurrences === 0 && source.includes(replacement)) return source;

    throw new Error(
        occurrences === 0
            ? 'Could not find the expected CKEditor Powered by code in ' + filename + '. ' +
                'The dependency layout may have changed; update the build patch.'
            : 'Found the expected CKEditor Powered by code ' + occurrences + ' times in ' + filename +
                '; refusing an ambiguous patch.',
    );
}

async function patchUiSource() {
    const propertyMarker = '\t// Rhymix build patch: Powered by badge property removed.';
    const initializationMarker = '\t\t// Rhymix build patch: Powered by badge initialization removed.';
    const destructionMarker = '\t\t// Rhymix build patch: no Powered by badge to destroy.';
    let source = await readFile(uiSourcePath, 'utf8');

    source = replaceOnce(
        source,
        '\t/**\n\t* A helper that enables the "powered by" feature in the editor and renders a link to the project\'s webpage.\n\t*' +
            '/\n\tpoweredBy;',
        propertyMarker,
        uiSourcePath,
    );
    source = replaceOnce(
        source,
        '\t\tthis.poweredBy = new PoweredBy(editor);',
        initializationMarker,
        uiSourcePath,
    );
    source = replaceOnce(
        source,
        '\t\tthis.poweredBy.destroy();',
        destructionMarker,
        uiSourcePath,
    );

    await writeFile(uiSourcePath, source);
}

async function patchStylesheet() {
    const marker = '/' + '* Rhymix build patch: CKEditor Powered by styles removed. *' + '/';
    let stylesheet = await readFile(stylesheetPath, 'utf8');

    if (stylesheet.includes(marker)) return;

    const start = stylesheet.indexOf(':root {\n  --ck-powered-by-font-size:');
    const end = stylesheet.indexOf(':root {\n  --ck-evaluation-badge-font-size:', start);

    if (start === -1 || end === -1 || end <= start) {
        throw new Error(
            'Could not find the expected CKEditor Powered by styles in ' + stylesheetPath + '. ' +
            'The dependency layout may have changed; update the build patch.',
        );
    }

    stylesheet = stylesheet.slice(0, start) + marker + '\n\n' + stylesheet.slice(end);
    await writeFile(stylesheetPath, stylesheet);
}

await Promise.all([patchUiSource(), patchStylesheet()]);
console.log(
    'Patched CKEditor ' + ckeditorPackage.version + ' Powered by badge sources under ' + projectRoot + 'node_modules.',
);
