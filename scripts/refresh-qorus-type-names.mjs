#!/usr/bin/env node
// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Refreshes reqraft's copy of the names the Qorus server gives its data types - each type's display name (a label)
 * and its sentence form (its name inside a sentence): __tests__/fixtures/qorusTypeCatalogueNames.json.
 *
 * The server's type catalogue (QorusDataTypeCatalogue::Info in the qorus repository, served at
 * /system/qorus-type-info) is the one source of a type's display name and sentence form. reqraft draws with its own copy of the list
 * (`defaultQorusTypes`, src/hooks/useQorusTypes.ts) until the server's arrives, and words its condition and type
 * messages from it; __tests__/qorusTypeNames.test.ts fails when that copy says another name than the server.
 *
 * When the server's catalogue changes: run this against the qorus checkout's catalogue, commit the JSON it writes,
 * and change `defaultQorusTypes` until the test passes.
 *
 *   yarn refresh:type-names ~/src/Qorus/git/qorus/Classes/QorusDataTypeCatalogue.qc
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error('usage: yarn refresh:type-names <path to Classes/QorusDataTypeCatalogue.qc>');
  process.exit(2);
}

const text = readFileSync(source, 'utf8');
// the catalogue itself: `const Info = ( ... );`, each entry a hash that opens with its name and display name
const start = text.indexOf('const Info = (');
const end = start < 0 ? -1 : text.indexOf('\n        );', start);
if (start < 0 || end < 0) {
  console.error(`${source}: no "const Info = (...)" catalogue in it`);
  process.exit(1);
}

// each type's name, its display name (a label) and its sentence form (its name inside a sentence)
const names = {};
for (const [, name, displayName, sentenceForm] of text
  .slice(start, end)
  .matchAll(
    /"name":\s*"([^"]+)",\s*\n\s*"display_name":\s*"([^"]+)",\s*\n\s*"sentence_form":\s*"([^"]+)"/g
  )) {
  names[name] = { display_name: displayName, sentence_form: sentenceForm };
}
if (!Object.keys(names).length) {
  console.error(`${source}: no type names found in the catalogue`);
  process.exit(1);
}

const target = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../__tests__/fixtures/qorusTypeCatalogueNames.json'
);
writeFileSync(target, `${JSON.stringify(names, null, 2)}\n`);
console.log(`${Object.keys(names).length} type names -> ${target}`);
