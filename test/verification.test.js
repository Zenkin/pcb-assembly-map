const test = require("node:test");
const assert = require("node:assert/strict");
const {unitsForRef, parseNumber, normalizeRecord, normalizeMap} = require("../js/verification.js");

test("accepts decimal comma and decimal point", () => {
  assert.deepEqual(parseNumber("98,5"), {empty:false, valid:true, value:98.5});
  assert.deepEqual(parseNumber("98.5"), {empty:false, valid:true, value:98.5});
  assert.deepEqual(parseNumber(""), {empty:true, valid:true, value:null});
});

test("rejects negative, incomplete, and non-numeric values", () => {
  assert.equal(parseNumber("-1").valid, false);
  assert.equal(parseNumber("1e3").valid, false);
  assert.equal(parseNumber("12 Ом").valid, false);
});

test("returns supported units from the reference prefix", () => {
  assert.deepEqual(unitsForRef("R15"), ["Ом", "кОм", "МОм"]);
  assert.deepEqual(unitsForRef("c4"), ["пФ", "нФ", "мкФ", "мФ"]);
  assert.deepEqual(unitsForRef("U1"), []);
});

test("normalizes persisted verification records defensively", () => {
  assert.deepEqual(
    normalizeRecord({checked:true, actualValue:"100", unit:"Ом", comment:"OK"}),
    {checked:true, actualValue:100, unit:"Ом", comment:"OK"}
  );
  assert.deepEqual(
    normalizeRecord({checked:"yes", actualValue:-1, unit:12, comment:null}),
    {checked:false, actualValue:null, unit:"", comment:""}
  );
});

test("treats missing version 3 verification data as an empty map", () => {
  assert.deepEqual(normalizeMap(undefined), {});
  assert.deepEqual(normalizeMap([]), {});
  assert.deepEqual(
    normalizeMap({"TOP:R1":{checked:true, actualValue:99.8, unit:"Ом", comment:""}}),
    {"TOP:R1":{checked:true, actualValue:99.8, unit:"Ом", comment:""}}
  );
});
