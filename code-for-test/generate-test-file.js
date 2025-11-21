const fs = require('fs');

console.log('Creating large test CSV file...');

const ws = fs.createWriteStream('large-test.csv');
ws.write('name,email,age,department\n');

for (let i = 0; i < 1000000; i++) {
  ws.write(`User${i},user${i}@company.com,${20 + (i % 50)},Dept${i % 10}\n`);
  
  // Log progress every 100k records
  if (i % 100000 === 0) {
    console.log(`Generated ${i} records...`);
  }
}

ws.end(() => {
  console.log('✓ Created large-test.csv with 1,000,000 records (~100MB)');
});