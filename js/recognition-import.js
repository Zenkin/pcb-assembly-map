(function initRecognitionImport(root, factory) {
  const sessionApi = typeof module === "object" && module.exports
    ? require("./matching-session.js")
    : root?.SolderMapMatchingSession;
  const api = factory(sessionApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapRecognitionImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRecognitionImportApi(
  sessionApi
) {
  if (!sessionApi) throw new Error("SolderMapMatchingSession is required");

  const UNIT_FACTORS_MM = Object.freeze({mm:1, mil:0.0254, in:25.4});
  const HEADER_ALIASES = Object.freeze({
    id:["id", "name", "label", "detection", "footprint", "объект", "метка"],
    x:["x", "center x", "centre x", "centerx", "cx", "центр x", "координата x"],
    y:["y", "center y", "centre y", "centery", "cy", "центр y", "координата y"],
    side:["side", "layer", "board side", "сторона", "слой"],
    width:["width", "w", "bbox width", "ширина"],
    height:["height", "h", "bbox height", "высота"]
  });

  function normalizedUnit(value, name = "units") {
    const unit = String(value ?? "mm").trim().toLowerCase();
    if (["mm", "мм"].includes(unit)) return "mm";
    if (["mil", "mils", "thou"].includes(unit)) return "mil";
    if (["in", "inch", "inches", "дюйм", "дюйма", "дюймов"].includes(unit)) return "in";
    throw new TypeError(`${name} must be mm, mil, or in`);
  }

  function normalizeHeader(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s*(?:\(|\[)\s*(?:mm|мм|mil|mils|thou|in|inch|inches)\s*(?:\)|\])\s*/giu, " ")
      .replace(/[.:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseSide(value, label) {
    const side = String(value ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");
    if (["top", "toplayer", "front", "f", "t", "верх", "верхняя"].includes(side)) {
      return "TOP";
    }
    if (["bottom", "bottomlayer", "bot", "back", "b", "низ", "нижняя"].includes(side)) {
      return "BOTTOM";
    }
    throw new TypeError(`${label}: сторона должна быть TOP или BOTTOM.`);
  }

  function finiteNumber(value, label) {
    const text = String(value ?? "").trim().replace(",", ".");
    const number = Number(text);
    if (!text || !Number.isFinite(number)) {
      throw new TypeError(`${label}: требуется конечное число.`);
    }
    return number;
  }

  function positiveNumber(value, label) {
    const number = finiteNumber(value, label);
    if (number <= 0) throw new RangeError(`${label}: размер должен быть больше нуля.`);
    return number;
  }

  function unitFromHeader(header) {
    const match = String(header ?? "").toLowerCase().match(
      /(?:\(|\[|\s)(mm|мм|mil|mils|thou|in|inch|inches)(?:\)|\]|\s|$)/iu
    );
    return match ? normalizedUnit(match[1]) : null;
  }

  function coordinate(value, header, defaultUnit, label) {
    return finiteNumber(value, label) * UNIT_FACTORS_MM[unitFromHeader(header) || defaultUnit];
  }

  function parseDelimitedLine(line, delimiter) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === "\"") {
        if (quoted && line[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        cells.push(cell);
        cell = "";
      } else cell += character;
    }
    if (quoted) throw new Error("В файле распознавания не закрыта кавычка.");
    cells.push(cell);
    return cells;
  }

  function delimiterFor(header) {
    return [",", ";", "\t"].sort((a, b) => (
      header.split(b).length - header.split(a).length
    ))[0];
  }

  function columnIndex(headers, field) {
    return headers.findIndex(header => HEADER_ALIASES[field].includes(normalizeHeader(header)));
  }

  function geometryFromSize(width, height, factor, label) {
    if (width === undefined || width === null || String(width).trim() === "") {
      if (height === undefined || height === null || String(height).trim() === "") return null;
      throw new Error(`${label}: ширина и высота должны быть указаны вместе.`);
    }
    if (height === undefined || height === null || String(height).trim() === "") {
      throw new Error(`${label}: ширина и высота должны быть указаны вместе.`);
    }
    return {
      pads:[{
        x:0,
        y:0,
        width:positiveNumber(width, `${label}, ширина`) * factor,
        height:positiveNumber(height, `${label}, высота`) * factor
      }]
    };
  }

  function parseTable(text, options = {}) {
    const source = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const lines = source.split("\n").filter(line => line.trim() && !line.trim().startsWith("#"));
    if (lines.length < 2) throw new Error("В таблице распознавания нет строк данных.");
    const delimiter = delimiterFor(lines[0]);
    const headers = parseDelimitedLine(lines[0], delimiter);
    const indexes = Object.fromEntries(
      Object.keys(HEADER_ALIASES).map(field => [field, columnIndex(headers, field)])
    );
    if (["x", "y", "side"].some(field => indexes[field] < 0)) {
      throw new Error("Не найдены обязательные столбцы распознавания: X, Y и сторона.");
    }
    const defaultUnit = normalizedUnit(options.defaultUnit ?? "mm", "options.defaultUnit");
    const xUnit = unitFromHeader(headers[indexes.x]) || defaultUnit;
    const yUnit = unitFromHeader(headers[indexes.y]) || defaultUnit;
    if (xUnit !== yUnit) throw new Error("Единицы X и Y должны совпадать.");
    const factor = UNIT_FACTORS_MM[xUnit];
    const foundFootprints = [];
    const errors = [];

    lines.slice(1).forEach((line, rowIndex) => {
      const sourceRow = rowIndex + 2;
      try {
        const cells = parseDelimitedLine(line, delimiter);
        const side = parseSide(cells[indexes.side], `Строка ${sourceRow}`);
        const id = indexes.id >= 0 && String(cells[indexes.id] ?? "").trim()
          ? String(cells[indexes.id]).trim()
          : `found:${side}:${foundFootprints.length + 1}`;
        foundFootprints.push(sessionApi.normalizeFoundFootprint({
          id,
          side,
          center:{
            x:coordinate(cells[indexes.x], headers[indexes.x], defaultUnit, `Строка ${sourceRow}, X`),
            y:coordinate(cells[indexes.y], headers[indexes.y], defaultUnit, `Строка ${sourceRow}, Y`)
          },
          geometry:geometryFromSize(
            indexes.width >= 0 ? cells[indexes.width] : null,
            indexes.height >= 0 ? cells[indexes.height] : null,
            factor,
            `Строка ${sourceRow}`
          )
        }, foundFootprints.length));
      } catch (error) {
        errors.push(error.message);
      }
    });
    if (errors.length) {
      const error = new Error(errors.slice(0, 8).join("\n"));
      error.details = errors;
      throw error;
    }
    return {foundFootprints, format:"table", units:"mm"};
  }

  function detectionArray(value) {
    if (Array.isArray(value)) return value;
    for (const key of ["foundFootprints", "detections", "footprints", "items"]) {
      if (Array.isArray(value?.[key])) return value[key];
    }
    throw new TypeError(
      "JSON должен содержать массив foundFootprints, detections, footprints или items."
    );
  }

  function bboxOf(value) {
    const source = value?.bbox ?? value?.box ?? value?.boundingBox;
    if (Array.isArray(source) && source.length >= 4) {
      return {x:source[0], y:source[1], width:source[2], height:source[3]};
    }
    return source && typeof source === "object" ? source : null;
  }

  function parseJson(text, options = {}) {
    let value;
    try {
      value = JSON.parse(String(text ?? "").replace(/^\uFEFF/, ""));
    } catch (error) {
      throw new SyntaxError(`Некорректный JSON распознавания: ${error.message}`);
    }
    const unit = normalizedUnit(value?.units ?? options.defaultUnit ?? "mm", "units");
    const factor = UNIT_FACTORS_MM[unit];
    const rows = detectionArray(value);
    const foundFootprints = rows.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new TypeError(`detections[${index}] должен быть объектом.`);
      }
      const label = `detections[${index}]`;
      const side = parseSide(item.side ?? item.layer ?? item.boardSide, label);
      const bbox = bboxOf(item);
      const center = item.center && typeof item.center === "object"
        ? item.center
        : {
          x:item.x ?? item.centerX ?? item.cx ?? (
            bbox ? finiteNumber(bbox.x ?? bbox.left, `${label}.bbox.x`)
              + positiveNumber(bbox.width ?? bbox.w, `${label}.bbox.width`) / 2 : undefined
          ),
          y:item.y ?? item.centerY ?? item.cy ?? (
            bbox ? finiteNumber(bbox.y ?? bbox.top, `${label}.bbox.y`)
              + positiveNumber(bbox.height ?? bbox.h, `${label}.bbox.height`) / 2 : undefined
          )
        };
      let geometry = item.geometry ?? (Array.isArray(item.pads) ? {pads:item.pads} : null);
      if (!geometry) {
        const width = item.width ?? item.w ?? bbox?.width ?? bbox?.w;
        const height = item.height ?? item.h ?? bbox?.height ?? bbox?.h;
        geometry = geometryFromSize(width, height, factor, label);
      } else {
        geometry = {
          pads:geometry.pads.map(pad => ({
            x:finiteNumber(pad.x, `${label}.pad.x`) * factor,
            y:finiteNumber(pad.y, `${label}.pad.y`) * factor,
            width:positiveNumber(pad.width ?? pad.w, `${label}.pad.width`) * factor,
            height:positiveNumber(pad.height ?? pad.h, `${label}.pad.height`) * factor
          }))
        };
      }
      return sessionApi.normalizeFoundFootprint({
        id:item.id ?? item.name ?? item.label ?? `found:${side}:${index + 1}`,
        side,
        center:{
          x:finiteNumber(center.x, `${label}.center.x`) * factor,
          y:finiteNumber(center.y, `${label}.center.y`) * factor
        },
        geometry
      }, index);
    });
    return {foundFootprints, format:"json", units:"mm"};
  }

  function assertUniqueIds(items) {
    const seen = new Set();
    items.forEach((item, index) => {
      if (seen.has(item.id)) {
        throw new Error(`foundFootprints[${index}].id должен быть уникальным: ${item.id}`);
      }
      seen.add(item.id);
    });
  }

  function parseRecognition(text, options = {}) {
    const source = String(text ?? "");
    if (!source.trim()) throw new Error("Файл результатов распознавания пуст.");
    const parsed = /^[\s\uFEFF]*[\[{]/u.test(source)
      ? parseJson(source, options)
      : parseTable(source, options);
    if (!parsed.foundFootprints.length) {
      throw new Error("В файле не найдено ни одного распознанного места.");
    }
    assertUniqueIds(parsed.foundFootprints);
    return parsed;
  }

  return Object.freeze({
    HEADER_ALIASES,
    UNIT_FACTORS_MM,
    normalizeHeader,
    parseSide,
    parseJson,
    parseTable,
    parseRecognition
  });
});
