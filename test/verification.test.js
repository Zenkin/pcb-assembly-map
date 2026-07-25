const test = require("node:test");
const assert = require("node:assert/strict");
const {
  unitsForRef,
  parseNumber,
  parseTolerance,
  parseNominal,
  calculateControl,
  formatBaseValue,
  normalizeRecord,
  normalizeMap
} = require("../js/verification.js");

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
    normalizeRecord({checked:true, actualValue:"100", unit:"Ом", comment:"OK", referenceValue:"0.1", referenceUnit:"кОм"}),
    {checked:true, actualValue:100, unit:"Ом", comment:"OK", referenceValue:0.1, referenceUnit:"кОм"}
  );
  assert.deepEqual(
    normalizeRecord({checked:"yes", actualValue:-1, unit:12, comment:null}),
    {checked:false, actualValue:null, unit:"", comment:"", referenceValue:null, referenceUnit:""}
  );
});

test("treats missing version 3 verification data as an empty map", () => {
  assert.deepEqual(normalizeMap(undefined), {});
  assert.deepEqual(normalizeMap([]), {});
  assert.deepEqual(
    normalizeMap({"TOP:R1":{checked:true, actualValue:99.8, unit:"Ом", comment:""}}),
    {"TOP:R1":{checked:true, actualValue:99.8, unit:"Ом", comment:"", referenceValue:null, referenceUnit:""}}
  );
});

test("parses resistor and capacitor values into base units", () => {
  assert.deepEqual(parseNominal("0,1 кОм ±5 %", "R1"), {valid:true, value:0.1, unit:"кОм", baseValue:100});
  assert.deepEqual(parseNominal("100 нФ", "C4"), {valid:true, value:100, unit:"нФ", baseValue:100000});
  assert.deepEqual(parseNominal("0.1 uF", "C5"), {valid:true, value:0.1, unit:"мкФ", baseValue:100000});
  assert.equal(parseNominal("STM32", "U1").valid, false);
  assert.equal(parseNominal("неизвестно", "R2").valid, false);
});

test("parses symmetric percentage tolerance", () => {
  assert.equal(parseTolerance("100 Ом ±5 %"), 5);
  assert.equal(parseTolerance("100 нФ +/- 10%"), 10);
  assert.equal(parseTolerance("5%", true), 5);
  assert.equal(parseTolerance("5%"), null);
});

test("normalizes units before comparing values", () => {
  const resistor = calculateControl({
    actualValue:100,
    actualUnit:"Ом",
    referenceValue:0.1,
    referenceUnit:"кОм",
    tolerancePercent:null
  });
  assert.equal(resistor.status, "no_tolerance");
  assert.equal(resistor.deltaBase, 0);

  const capacitor = calculateControl({
    actualValue:100,
    actualUnit:"нФ",
    referenceValue:0.1,
    referenceUnit:"мкФ",
    tolerancePercent:null
  });
  assert.equal(capacitor.deltaBase, 0);
});

test("treats tolerance boundaries as inclusive", () => {
  const common = {actualUnit:"Ом", referenceValue:100, referenceUnit:"Ом", tolerancePercent:5};
  assert.equal(calculateControl({...common, actualValue:95}).status, "in_tolerance");
  assert.equal(calculateControl({...common, actualValue:105}).status, "in_tolerance");
  assert.equal(calculateControl({...common, actualValue:106}).status, "out_of_tolerance");
});

test("handles missing measurement, missing reference, and zero reference", () => {
  assert.equal(calculateControl({
    actualValue:null, actualUnit:"Ом", referenceValue:100, referenceUnit:"Ом", tolerancePercent:5
  }).status, "no_measurement");
  assert.equal(calculateControl({
    actualValue:100, actualUnit:"Ом", referenceValue:null, referenceUnit:"", tolerancePercent:5
  }).status, "not_comparable");
  assert.equal(calculateControl({
    actualValue:0, actualUnit:"Ом", referenceValue:0, referenceUnit:"Ом", tolerancePercent:5
  }).status, "not_comparable");
});

test("formats base values in a convenient unit", () => {
  assert.equal(formatBaseValue(100000, "C1"), "100 нФ");
  assert.equal(formatBaseValue(100, "R1", "Ом"), "100 Ом");
});
