const fs = require('fs');

console.log('Creating messy test CSV file with various issues...');

const ws = fs.createWriteStream('messy-test.csv');

// Valid header
ws.write('name,email,age,department\n');

// Mix of good and bad data
const testCases = [
  // Good records
  'John Doe,john@company.com,30,Engineering\n',
  'Jane Smith,jane@company.com,25,Sales\n',
  
  // Missing fields
  'Bob Wilson,bob@company.com\n',  // Missing age and department
  'Alice,alice@company.com,28\n',  // Missing department
  
  // Invalid email
  'Charlie Brown,charlie-no-at-sign,35,Marketing\n',
  'David Lee,david@,28,Engineering\n',
  'Eve Wilson,@company.com,29,Sales\n',
  
  // Invalid age
  'Frank Miller,frank@company.com,twenty-five,HR\n',
  'Grace Lee,grace@company.com,-5,IT\n',
  'Henry Wang,henry@company.com,999,Sales\n',
  
  // Empty/whitespace lines
  '\n',
  '   \n',
  
  // Extra commas
  'Ivy Chen,ivy@company.com,32,Marketing,Extra,Field,Here\n',
  
  // Missing required fields
  ',missing-name@company.com,30,Engineering\n',
  'Jack Stone,,35,Sales\n',  // Missing email
  
  // Special characters
  'K\'evin O\'Brien,kevin@company.com,28,Engineering\n',
  'Laura "The Boss" Smith,laura@company.com,45,Management\n',
  
  // Quoted fields (CSV standard)
  '"Martinez, Carlos",carlos@company.com,33,Finance\n',
  
  // More good records
  'Nancy Davis,nancy@company.com,31,Engineering\n',
  'Oscar Chen,oscar@company.com,27,Product\n',
  
  // Tabs instead of commas (wrong delimiter)
  'Paul\tWilson\tpaul@company.com\t29\tEngineering\n',
  
  // Line with only commas
  ',,,\n',
  
  // Unicode characters
  'Sofía García,sofia@company.com,26,Design\n',
  '张伟,zhangwei@company.com,30,Engineering\n',
  
  // More good records for bulk
  'Rachel Green,rachel@company.com,29,Sales\n',
  'Steven Park,steven@company.com,34,Engineering\n',
];

testCases.forEach(line => ws.write(line));

// Add some bulk good data
for (let i = 0; i < 100; i++) {
  ws.write(`User${i},user${i}@company.com,${20 + (i % 50)},Dept${i % 5}\n`);
}

ws.end(() => {
  console.log('✓ Created messy-test.csv with various data quality issues');
  console.log('  - Good records: ~105');
  console.log('  - Bad records: ~15-20');
  console.log('  - Various issues: missing fields, invalid emails, bad ages, etc.');
});