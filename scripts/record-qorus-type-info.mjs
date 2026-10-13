#!/usr/bin/env node
// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Records a Qorus server's answer to GET /system/qorus-type-info as __tests__/fixtures/qorusTypeInfo.json.
 *
 * The server's type catalogue (QorusDataTypeCatalogue::Info in the qorus repository) is the one source of each
 * type's names, descriptions and conversions. reqraft draws with its own copy (`defaultQorusTypes`,
 * src/helpers/qorusTypeCatalogue.ts) until the server answers; __tests__/qorusTypeCatalogue.test.ts fails when that
 * copy differs from the recorded answer.
 *
 * When the server's catalogue changes: record its answer, commit the JSON this writes, and change
 * `defaultQorusTypes` until the test passes. Give the answer as a file or on stdin:
 *
 *   qrest -j system/qorus-type-info | yarn -s record:type-info
 *   yarn record:type-info response.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
const from = source ?? 'stdin';

let types;
try {
  types = JSON.parse(readFileSync(source ?? 0, 'utf8'));
} catch (error) {
  console.error(`${from}: not a JSON answer (${error.message})`);
  console.error('usage: qrest -j system/qorus-type-info | yarn -s record:type-info');
  process.exit(2);
}

// the shape the server answers with: a list of types, each with these fields
const FIELDS = ['name', 'display_name', 'sentence_form', 'short_desc', 'desc', 'types_accepted', 'exact_match'];
const problems =
  !Array.isArray(types) ? ['the answer is not a list of types']
  : !types.length ? ['the answer lists no types']
  : types.flatMap((type, index) => {
      const missing = FIELDS.filter((field) => !(field in (type ?? {})));
      return missing.length ? [`type ${type?.name ?? index} has no ${missing.join(', ')}`] : [];
    });
if (problems.length) {
  console.error(`${from}: not a /system/qorus-type-info answer: ${problems.join('; ')}`);
  process.exit(1);
}

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../__tests__/fixtures/qorusTypeInfo.json');
writeFileSync(target, `${JSON.stringify(types, null, 2)}\n`);
console.log(`${types.length} types -> ${target}`);
