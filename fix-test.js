const fs = require('fs');
const testFile = 'apps/worker/src/__tests__/dedup.test.ts';
let content = fs.readFileSync(testFile, 'utf8');

// Add secretHash to the FakeFindingRow definition
content = content.replace(
  'redactedSnippet: string;',
  'redactedSnippet: string;\n  secretHash?: string;'
);

// Add secretHash storage in the create mock
content = content.replace(
  'redactedSnippet: data.redactedSnippet,',
  'redactedSnippet: data.redactedSnippet,\n          secretHash: data.secretHash,'
);

fs.writeFileSync(testFile, content);
console.log('Fixed test file');
