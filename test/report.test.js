const test = require("node:test");
const assert = require("node:assert/strict");
const {
  COLUMNS,
  buildRows,
  componentType,
  tableData,
  toCsv,
  toXlsxBuffer
} = require("../js/report.js");

function sampleProject() {
  return {
    name:"Тестовая плата",
    components:[
      {ref:"R1", side:"TOP", value:"100 Ом ±5 %"},
      {ref:"C1", side:"BOTTOM", value:"0,1 мкФ"},
      {ref:"U1", side:"TOP", value:"STM32"},
      {ref:"R2", side:"TOP", value:"не указан"}
    ],
    verificationMap:{
      "TOP:R1":{checked:true, actualValue:106, unit:"Ом", comment:"Проверить пайку"},
      "BOTTOM:C1":{checked:true, actualValue:100, unit:"нФ", comment:""},
      "TOP:R2":{checked:false, actualValue:9.8, unit:"кОм", referenceValue:10, referenceUnit:"кОм", comment:"Маркировка"}
    }
  };
}

test("builds all eleven report fields for every project component", () => {
  const rows = buildRows(sampleProject());
  assert.equal(COLUMNS.length, 11);
  assert.equal(rows.length, 4);
  assert.deepEqual(Object.keys(rows[0]), COLUMNS.map(column => column.key));
  assert.equal(rows[0].reference, "R1");
  assert.equal(rows[0].componentType, "Резистор");
  assert.equal(rows[0].verificationStatus, "Проверен");
  assert.equal(rows[0].controlResult, "Вне допуска");
  assert.equal(rows[0].absoluteDeviation, "+6 Ом");
  assert.equal(rows[0].percentDeviation, "+6 %");
  assert.equal(rows[0].allowedRange, "95 Ом — 105 Ом");
  assert.equal(rows[0].comment, "Проверить пайку");
});

test("converts units and keeps components without verification data", () => {
  const rows = buildRows(sampleProject());
  assert.equal(rows[1].actualNominal, "100 нФ");
  assert.equal(rows[1].absoluteDeviation, "0 нФ");
  assert.equal(rows[1].controlResult, "Без допуска");
  assert.equal(rows[2].verificationStatus, "Не проверен");
  assert.equal(rows[2].controlResult, "Нет измерения");
});

test("uses a manual reference when the BOM nominal is not recognized", () => {
  const row = buildRows(sampleProject())[3];
  assert.equal(row.bomNominal, "10 кОм");
  assert.equal(row.actualNominal, "9,8 кОм");
  assert.equal(row.percentDeviation, "-2 %");
  assert.equal(row.controlResult, "Без допуска");
});

test("recognizes common component designators", () => {
  assert.equal(componentType("LED12"), "Светодиод");
  assert.equal(componentType("U3"), "Микросхема");
  assert.equal(componentType("J1"), "Разъём");
  assert.equal(componentType("ZZ1"), "Компонент");
});

test("creates UTF-8 CSV with unambiguous headers and escaped text", () => {
  const rows = buildRows(sampleProject());
  const csv = toCsv(rows);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /^﻿"Позиционное обозначение";"Тип компонента"/);
  assert.match(csv, /"Проверить пайку"/);
  assert.equal(csv.split("\r\n").length, rows.length + 1);
  assert.deepEqual(tableData(rows)[0], COLUMNS.map(column => column.label));
});

test("creates an XLSX ZIP package with worksheet data and filters", () => {
  const buffer = toXlsxBuffer(buildRows(sampleProject()), {
    projectName:"Тестовая плата",
    generatedAt:new Date("2026-07-25T12:00:00.000Z")
  });
  assert.equal(buffer.readUInt32LE(0), 0x04034B50);
  assert.match(buffer.toString("utf8"), /xl\/worksheets\/sheet1\.xml/);
  assert.match(buffer.toString("utf8"), /autoFilter ref="A1:K5"/);
  assert.match(buffer.toString("utf8"), /Проверить пайку/);
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054B50);
});
