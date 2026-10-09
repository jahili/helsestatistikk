import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCurlCommand } from './curl.mjs';

test('generateCurlCommand bygger POST-kall med JSON-body', () => {
    const cmd = generateCurlCommand({ response: { format: 'csv2' } }, 'https://x/api/open/v1', 'daar', '643');
    assert.ok(cmd.startsWith("curl -X POST 'https://x/api/open/v1/daar/Table/643/data' \\n"));
    assert.ok(cmd.includes("-H 'Content-Type: application/json'"));
    assert.ok(cmd.includes('"format": "csv2"'));
});

test('generateCurlCommand escaper enkeltfnutter', () => {
    const cmd = generateCurlCommand({ a: "it's" }, 'u', 's', 't');
    assert.ok(cmd.includes("it'\''s"));
});

test('generateCurlCommand uten spørring gir tom streng', () => {
    assert.equal(generateCurlCommand(null, 'u', 's', 't'), '');
});

test('generateCurlCommand escaper også URL-en', () => {
    const cmd = generateCurlCommand({}, 'u', "x'; rm -rf ~; '", 't');
    assert.ok(cmd.startsWith("curl -X POST 'u/x'\''; rm -rf ~; '\''/Table/t/data'"));
});
