'use strict';

/**
 * checkObjectStructure.js  (CLI entry point)
 *
 * Reads an ioBroker object-dump JSON file, passes its parsed content to the
 * checker in lib/objectStructure.js, and prints the returned result in a
 * human-readable format.
 *
 * Usage:
 *   node scripts/checkObjectStructure.js <file.json> [--adapter <name>]
 *
 *   --adapter <name>   Expected adapter name (used for contextual checks).
 *                      When omitted the script tries to derive it from the
 *                      filename, which must match <adapter>.<instance>.json.
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const minimist = require('minimist');

const { checkObjectStructure } = require('../lib/objectStructure');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = minimist(process.argv.slice(2), {
    string:  ['adapter'],
    boolean: [],
    alias:   {},
});

const filePath = args._[0];

if (!filePath) {
    console.error('Usage: node scripts/checkObjectStructure.js <file.json> [--adapter <name>]');
    process.exitCode = 1;
    process.exit();
}

const absolutePath = path.resolve(process.cwd(), filePath);

// ---------------------------------------------------------------------------
// Derive adapter name: explicit flag beats filename heuristic
// ---------------------------------------------------------------------------

let adapterName = args.adapter || null;

if (!adapterName) {
    const baseName = path.basename(absolutePath);
    const match    = baseName.match(/^(?<adapter>[a-zA-Z0-9_-]+)\.\d+\.json$/);
    if (match) {
        adapterName = match.groups.adapter;
    }
}

// ---------------------------------------------------------------------------
// Read and parse the file
// ---------------------------------------------------------------------------

let objects;

try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    objects   = JSON.parse(raw);
} catch (err) {
    console.error(`ERROR [E0001]: Could not read / parse file: ${err.message}`);
    process.exitCode = 1;
    process.exit();
}

// ---------------------------------------------------------------------------
// Run the checker
// ---------------------------------------------------------------------------

const result = checkObjectStructure(objects, adapterName);

// ---------------------------------------------------------------------------
// Format and print the result
// ---------------------------------------------------------------------------

const SEPARATOR = '─'.repeat(72);

console.log(SEPARATOR);
console.log(`File    : ${absolutePath}`);
console.log(`Adapter : ${result.adapter || '<not set>'}`);
console.log(`Objects : ${result.objectCount}`);
console.log(SEPARATOR);

if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log('No issues found.');
} else {
    if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        for (const { code, message } of result.errors) {
            console.log(`  [${code}] ${message}`);
        }
    }

    if (result.warnings.length > 0) {
        console.log(`\nWarnings (${result.warnings.length}):`);
        for (const { code, message } of result.warnings) {
            console.log(`  [${code}] ${message}`);
        }
    }
}

console.log(`\n${SEPARATOR}`);
console.log(`Summary: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
console.log(SEPARATOR);

process.exitCode = result.errors.length > 0 ? 1 : 0;
