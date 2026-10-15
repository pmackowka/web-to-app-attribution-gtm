/**
 * Pilnuje, żeby simulation/simulation.csv odpowiadał aktualnemu kodowi tagu.
 * Po zmianie tagu albo scenariuszy: `npm run simulate` i commit CSV.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildCsv, OUTPUT } = require('../simulation/simulate');

test('simulation.csv jest aktualny względem tagu i scenariuszy', () => {
  assert.equal(fs.readFileSync(OUTPUT, 'utf8'), buildCsv(), 'CSV nieaktualny — odpal `npm run simulate`');
});
