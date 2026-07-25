const test = require("node:test");
const assert = require("node:assert/strict");
const bom = require("../js/bom.js");

test("parses grouped CSV references, ranges and optional tolerance", () => {
  const result = bom.parseBom("\uFEFFОбозначение;Номинал;Допуск %\nR1 R2;100 Ом;5\nC1-C3;0,1 мкФ;\n");
  assert.deepEqual(result.entries.map(item => item.ref), ["R1", "R2", "C1", "C2", "C3"]);
  assert.equal(result.entries[0].tolerance, 5);
  assert.equal(result.entries[2].tolerance, null);
});

test("parses quoted comma-delimited BOM cells", () => {
  const result = bom.parseBom("Designators,Value,Tolerance\n\"R1,R2\",\"100 Ohm\",5\n");
  assert.deepEqual(result.entries.map(item => item.ref), ["R1", "R2"]);
  assert.equal(result.entries[1].value, "100 Ohm");
});

test("rejects duplicate references as update conflicts", () => {
  const parsed = bom.parseBom("Ref;Value\nR1;100 Ом\nR1;120 Ом\n");
  const plan = bom.planUpdate([{ref:"R1", side:"TOP", value:"100 Ом"}], parsed.entries, {});
  assert.equal(plan.conflicts[0].kind, "duplicate");
});

test("preserves verification for equivalent nominal and resets changed nominal", () => {
  const components = [
    {ref:"R1", side:"TOP", value:"0,1 кОм", type:"Резистор"},
    {ref:"C1", side:"TOP", value:"100 нФ", type:"Конденсатор"}
  ];
  const records = {
    "TOP:R1":{checked:true, comment:"ok"},
    "TOP:C1":{checked:true, comment:"old"}
  };
  const plan = bom.planUpdate(components, [
    {ref:"R1", value:"100 Ом", type:"Резистор", tolerance:5, side:"TOP"},
    {ref:"C1", value:"220 нФ", type:"Конденсатор", tolerance:null, side:"TOP"}
  ], records);
  assert.equal(plan.nextVerificationMap["TOP:R1"].checked, true);
  assert.equal(plan.nextVerificationMap["TOP:C1"], undefined);
  assert.deepEqual(plan.resetRefs, ["C1"]);
});

test("updates an embedded tolerance without resetting verification", () => {
  const records = {"TOP:R1":{checked:true, comment:"keep"}};
  const plan = bom.planUpdate(
    [{ref:"R1", side:"TOP", value:"100 Ом ±5 %", type:"Резистор"}],
    [{ref:"R1", value:"100 Ом ±10 %", type:"Резистор", tolerance:null, side:"TOP"}],
    records
  );
  assert.equal(plan.changed, true);
  assert.equal(plan.changes[0].kind, "tolerance");
  assert.deepEqual(plan.nextVerificationMap, records);
});

test("marks removed and simultaneous type/value changes as conflicts", () => {
  const plan = bom.planUpdate([
    {ref:"R1", side:"TOP", value:"100 Ом", type:"Резистор"},
    {ref:"C1", side:"TOP", value:"100 нФ", type:"Конденсатор"}
  ], [
    {ref:"R1", value:"STM32", type:"Микросхема", tolerance:null, side:"TOP"}
  ], {});
  assert.deepEqual(plan.conflicts.map(item => item.kind).sort(), ["removed", "type_and_value"]);
});

test("adds new BOM components as unplaced", () => {
  const plan = bom.planUpdate([], [{ref:"R1", value:"100 Ом", type:"Резистор", tolerance:5, side:"BOTTOM"}], {});
  assert.equal(plan.nextComponents[0].unplaced, true);
  assert.equal(plan.nextComponents[0].side, "BOTTOM");
});

test("keeps only ten newest backups", () => {
  let backups = [];
  for (let index = 0; index < 11; index += 1) {
    backups = bom.createBackup(backups, {["TOP:R1"]:{checked:Boolean(index % 2)}}, `copy ${index}`, new Date(index * 1000)).backups;
  }
  assert.equal(backups.length, 10);
  assert.equal(backups[0].reason, "copy 10");
  assert.equal(backups.at(-1).reason, "copy 1");
});

test("restores selected references without touching the rest", () => {
  const current = {
    "TOP:R1":{checked:false, comment:"new"},
    "TOP:R2":{checked:true, comment:"keep"}
  };
  const saved = {
    "TOP:R1":{checked:true, comment:"old"},
    "TOP:R2":{checked:false, comment:"backup"}
  };
  const restored = bom.restoreBackup(current, saved, ["R1"]);
  assert.deepEqual(restored["TOP:R1"], saved["TOP:R1"]);
  assert.deepEqual(restored["TOP:R2"], current["TOP:R2"]);
  assert.equal(bom.compareBackup(current, saved, ["R1"]).length, 1);
});
