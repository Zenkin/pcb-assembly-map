(function initReport(root, factory) {
  const verification = typeof module === "object" && module.exports
    ? require("./verification.js")
    : root?.SolderMapVerification;
  const api = factory(verification);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReportApi(verification) {
  if (!verification) throw new Error("SolderMapVerification is required.");

  const COLUMNS = Object.freeze([
    Object.freeze({key:"reference", label:"Позиционное обозначение", width:22}),
    Object.freeze({key:"componentType", label:"Тип компонента", width:20}),
    Object.freeze({key:"bomNominal", label:"Номинал BOM", width:20}),
    Object.freeze({key:"tolerance", label:"Допуск", width:14}),
    Object.freeze({key:"actualNominal", label:"Фактический номинал", width:22}),
    Object.freeze({key:"absoluteDeviation", label:"Абсолютное отклонение", width:24}),
    Object.freeze({key:"percentDeviation", label:"Процентное отклонение", width:24}),
    Object.freeze({key:"allowedRange", label:"Допустимый диапазон", width:28}),
    Object.freeze({key:"verificationStatus", label:"Статус проверки", width:20}),
    Object.freeze({key:"controlResult", label:"Результат контроля", width:24}),
    Object.freeze({key:"comment", label:"Комментарий", width:42})
  ]);

  const STATUS_LABELS = Object.freeze({
    no_measurement:"Нет измерения",
    not_comparable:"Сравнение невозможно",
    no_tolerance:"Без допуска",
    in_tolerance:"В допуске",
    out_of_tolerance:"Вне допуска"
  });

  const COMPONENT_TYPES = Object.freeze({
    R:"Резистор",
    C:"Конденсатор",
    L:"Катушка индуктивности",
    D:"Диод",
    Q:"Транзистор",
    U:"Микросхема",
    IC:"Микросхема",
    J:"Разъём",
    P:"Разъём",
    X:"Разъём",
    K:"Реле",
    F:"Предохранитель",
    T:"Трансформатор",
    Y:"Кварцевый резонатор",
    SW:"Переключатель",
    LED:"Светодиод",
    TP:"Контрольная точка"
  });

  function componentKey(component) {
    return `${component?.side || ""}:${component?.ref || ""}`;
  }

  function componentType(ref) {
    const prefix = String(ref || "").trim().toUpperCase().match(/^[A-ZА-Я]+/u)?.[0] || "";
    return COMPONENT_TYPES[prefix] || COMPONENT_TYPES[prefix.charAt(0)] || "Компонент";
  }

  function toleranceFor(component) {
    const explicit = verification.parseTolerance(component?.tolerance, true);
    return explicit ?? verification.parseTolerance(component?.value);
  }

  function referenceFor(component, record) {
    const parsed = verification.parseNominal(component?.value, component?.ref);
    if (parsed.valid) return {...parsed, source:"bom", label:String(component?.value || "").trim()};

    const manual = verification.parseNominal(
      `${record.referenceValue ?? ""} ${record.referenceUnit || ""}`,
      component?.ref
    );
    if (manual.valid) {
      return {
        ...manual,
        source:"manual",
        label:`${verification.formatNumber(record.referenceValue)} ${record.referenceUnit}`.trim()
      };
    }
    return {valid:false, value:null, unit:"", baseValue:null, source:"missing", label:""};
  }

  function signedBaseValue(value, ref, preferredUnit) {
    if (!Number.isFinite(value)) return "";
    const sign = value > 0 ? "+" : "";
    return `${sign}${verification.formatBaseValue(value, ref, preferredUnit)}`;
  }

  function signedPercent(value) {
    if (!Number.isFinite(value)) return "";
    const sign = value > 0 ? "+" : "";
    return `${sign}${verification.formatNumber(value)} %`;
  }

  function buildRow(component, verificationMap) {
    const record = verification.normalizeRecord(verificationMap?.[componentKey(component)]);
    const reference = referenceFor(component, record);
    const tolerance = toleranceFor(component);
    const control = verification.calculateControl({
      actualValue:record.actualValue,
      actualUnit:record.unit,
      referenceValue:reference.valid ? reference.value : null,
      referenceUnit:reference.valid ? reference.unit : "",
      tolerancePercent:tolerance
    });
    const actualNominal = record.actualValue === null
      ? ""
      : `${verification.formatNumber(record.actualValue)} ${record.unit}`.trim();
    const allowedRange = Number.isFinite(control.lowerBase) && Number.isFinite(control.upperBase)
      ? `${verification.formatBaseValue(control.lowerBase, component.ref, reference.unit)} — ${verification.formatBaseValue(control.upperBase, component.ref, reference.unit)}`
      : "";

    return {
      reference:String(component?.ref || ""),
      componentType:componentType(component?.ref),
      bomNominal:reference.label,
      tolerance:tolerance === null ? "" : `±${verification.formatNumber(tolerance)} %`,
      actualNominal,
      absoluteDeviation:signedBaseValue(control.deltaBase, component?.ref, record.unit),
      percentDeviation:signedPercent(control.percentDelta),
      allowedRange,
      verificationStatus:record.checked ? "Проверен" : "Не проверен",
      controlResult:STATUS_LABELS[control.status] || STATUS_LABELS.not_comparable,
      comment:record.comment
    };
  }

  function buildRows(project) {
    const components = Array.isArray(project?.components) ? project.components : [];
    const verificationMap = project?.verificationMap && typeof project.verificationMap === "object"
      ? project.verificationMap
      : {};
    return components.map(component => buildRow(component, verificationMap));
  }

  function tableData(rows) {
    const source = Array.isArray(rows) ? rows : [];
    return [
      COLUMNS.map(column => column.label),
      ...source.map(row => COLUMNS.map(column => String(row?.[column.key] ?? "")))
    ];
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
  }

  function toCsv(rows) {
    return "\uFEFF" + tableData(rows).map(row => row.map(csvCell).join(";")).join("\r\n");
  }

  function xml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      "\"":"&quot;",
      "'":"&apos;"
    })[character]);
  }

  function columnName(index) {
    let value = index + 1;
    let result = "";
    while (value > 0) {
      value -= 1;
      result = String.fromCharCode(65 + value % 26) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }

  function crc32(buffer) {
    let crc = 0xFFFFFFFF;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipStore(entries) {
    if (typeof Buffer === "undefined") throw new Error("XLSX export requires Node.js.");
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    entries.forEach(entry => {
      const name = Buffer.from(entry.name, "utf8");
      const data = Buffer.from(entry.content, "utf8");
      const checksum = crc32(data);
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034B50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(0, 10);
      localHeader.writeUInt16LE(0, 12);
      localHeader.writeUInt32LE(checksum, 14);
      localHeader.writeUInt32LE(data.length, 18);
      localHeader.writeUInt32LE(data.length, 22);
      localHeader.writeUInt16LE(name.length, 26);
      localHeader.writeUInt16LE(0, 28);
      localParts.push(localHeader, name, data);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014B50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(0, 12);
      centralHeader.writeUInt16LE(0, 14);
      centralHeader.writeUInt32LE(checksum, 16);
      centralHeader.writeUInt32LE(data.length, 20);
      centralHeader.writeUInt32LE(data.length, 24);
      centralHeader.writeUInt16LE(name.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);
      centralParts.push(centralHeader, name);
      offset += localHeader.length + name.length + data.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054B50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat([...localParts, ...centralParts, end]);
  }

  function toXlsxBuffer(rows, metadata = {}) {
    const data = tableData(rows);
    const lastCell = `${columnName(COLUMNS.length - 1)}${Math.max(1, data.length)}`;
    const columns = COLUMNS.map((column, index) => (
      `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`
    )).join("");
    const sheetRows = data.map((row, rowIndex) => {
      const cells = row.map((value, columnIndex) => {
        const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
        return `<c r="${reference}" s="${rowIndex === 0 ? 1 : 2}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join("");
    const generatedAt = metadata.generatedAt instanceof Date && Number.isFinite(metadata.generatedAt.getTime())
      ? metadata.generatedAt
      : new Date();
    const projectName = String(metadata.projectName || "PCB project").slice(0, 200);
    const isoDate = generatedAt.toISOString();

    return zipStore([
      {
        name:"[Content_Types].xml",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
      },
      {
        name:"_rels/.rels",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
      },
      {
        name:"docProps/core.xml",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>SolderMap</dc:creator>
  <dc:title>${xml(projectName)} — проверка компонентов</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${isoDate}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${isoDate}</dcterms:modified>
</cp:coreProperties>`
      },
      {
        name:"docProps/app.xml",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>SolderMap</Application>
</Properties>`
      },
      {
        name:"xl/workbook.xml",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Проверка компонентов" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
      },
      {
        name:"xl/_rels/workbook.xml.rels",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
      },
      {
        name:"xl/styles.xml",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Arial"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563A6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD0D5DD"/></left><right style="thin"><color rgb="FFD0D5DD"/></right><top style="thin"><color rgb="FFD0D5DD"/></top><bottom style="thin"><color rgb="FFD0D5DD"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
      },
      {
        name:"xl/worksheets/sheet1.xml",
        content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columns}</cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:${lastCell}"/>
</worksheet>`
      }
    ]);
  }

  return Object.freeze({
    COLUMNS,
    STATUS_LABELS,
    componentType,
    buildRows,
    tableData,
    toCsv,
    toXlsxBuffer
  });
});
