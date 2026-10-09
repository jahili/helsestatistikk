import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCurlCommand } from './curl.mjs';

const BS = '\\'; // én bakstrek, for lesbare forventninger

test('generateCurlCommand bygger POST-kall med JSON-body over flere linjer', () => {
    const cmd = generateCurlCommand({ response: { format: 'csv2' } }, 'https://x/api/open/v1', 'daar', '643');
    assert.equal(cmd,
        "curl -X POST 'https://x/api/open/v1/daar/Table/643/data' " + BS + '\n' +
        "  -H 'Content-Type: application/json' " + BS + '\n' +
        "  -d '{\n  \"response\": {\n    \"format\": \"csv2\"\n  }\n}'"
    );
});

test('generateCurlCommand escaper enkeltfnutter i body', () => {
    const cmd = generateCurlCommand({ a: "it's" }, 'u', 's', 't');
    assert.ok(cmd.includes('"it' + "'" + BS + "''" + 's"'));
});

test('generateCurlCommand escaper enkeltfnutter i URL-en', () => {
    const cmd = generateCurlCommand({}, 'u', "x'y", 't');
    assert.ok(cmd.startsWith("curl -X POST 'u/x'" + BS + "''y/Table/t/data' "));
});

test('generateCurlCommand uten spørring gir tom streng', () => {
    assert.equal(generateCurlCommand(null, 'u', 's', 't'), '');
});
