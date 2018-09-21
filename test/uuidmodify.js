const uuidModify = require('../util/uuidmodify');
let totalTests = 0;
let passedTests = 0;

const baseUuid = '49bc0f94-bde5-11e8-a355-529269fb1459';
const lexicalBaseUuid = '11e8-bde5-49bc0f94-a355-529269fb1459';
const uuidSortedList = [
	'49bc0f94-bde5-11e8-a355-529269fb1459',
	'a391ce14-bde5-11e8-a355-529269fb1459',
	'aa9c0580-bde5-11e8-a355-529269fb1459',
	'c6896c10-bde5-11e8-a355-529269fb1459',
	'7b0c42c0-bde6-11e8-a355-529269fb1459',
	'c01be7ee-bde6-11e8-a355-529269fb1459'
];
const ulidSortedList = [
	'11e8-bde5-49bc0f94-a355-529269fb1459',
	'11e8-bde5-a391ce14-a355-529269fb1459',
	'11e8-bde5-aa9c0580-a355-529269fb1459',
	'11e8-bde5-c6896c10-a355-529269fb1459',
	'11e8-bde6-7b0c42c0-a355-529269fb1459',
	'11e8-bde6-c01be7ee-a355-529269fb1459'
];

console.log('\nTesting `uuidmodify.js`\n');

totalTests++;
console.log(`Expected: ${lexicalBaseUuid}`);
console.log(`Got     : ${uuidModify.toLexical(baseUuid)}`);

if (lexicalBaseUuid === uuidModify.toLexical(baseUuid)) {
	passedTests++;
	console.log(`Regular -> Lexical: Success`);
} else
	console.log(`Regular -> Lexical: Fail`);

totalTests++;
console.log(`\nExpected: ${baseUuid}`);
console.log(`Got     : ${uuidModify.toRegular(lexicalBaseUuid)}`);

if (baseUuid === uuidModify.toRegular(lexicalBaseUuid)) {
	passedTests++;
	console.log(`Lexical -> Regular: Success`);
} else
	console.log(`Lexical -> Regular: Fail`);

totalTests++;
console.log(`\nExpected: ${baseUuid}`);
console.log(`Got     : ${uuidModify.toRegular(uuidModify.toLexical(baseUuid))}`);

if (baseUuid === uuidModify.toRegular(uuidModify.toLexical(baseUuid))) {
	passedTests++;
	console.log(`Regular -> Lexical -> Regular: Success`);
} else
	console.log(`Regular -> Lexical -> Regular: Fail`);

let ulidSortedListTest = [];
let sortedCorrectly = true;

for (let i = 0; i < uuidSortedList.length; i++)
	ulidSortedListTest[i] = uuidModify.toLexical(uuidSortedList[i]);

ulidSortedListTest.sort();

for (let i = 0; i < ulidSortedList.length; i++)
	if (ulidSortedList[i] !== ulidSortedListTest[i])
		sortedCorrectly = false;

totalTests++;
console.log(`\nExpected: `, '');
console.log(ulidSortedList);
console.log(`Got     : `, '');
console.log(ulidSortedListTest);
console.log(`Regular -> Lexical -> Sort: ${sortedCorrectly && passedTests++ ? 'Success' : 'Fail'}`);

console.log(`\nPassed ${passedTests} out of ${totalTests} tests\n`);