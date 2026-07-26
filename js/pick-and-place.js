(function initPickAndPlace(root, factory) {
  const sessionApi = typeof module === "object" && module.exports
    ? require("./matching-session.js")
    : root?.SolderMapMatchingSession;
  const api = factory(sessionApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapPickAndPlace = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPickAndPlaceApi(
  sessionApi
) {
  if (!sessionApi) throw new Error("SolderMapMatchingSession is required");

  const HEADER_ALIASES = Object.freeze({
    ref:[
      "ref", "refs", "reference", "reference designator", "refdes",
      "designator", "component", "позиция", "позиционное обозначение",
      "обозначение", "поз обозначение", "поз. обозначение", "поз"
    ],
    x:[
      "x", "posx", "pos x", "position x", "mid x", "center x", "centre x",
      "центр x", "позиция x", "координата x"
    ],
    y:[
      "y", "posy", "pos y", "position y", "mid y", "center y", "centre y",
      "центр y", "позиция y", "координата y"
    ],
    side:["side", "layer", "board side", "tb", "сторона", "слой"],
    rotation:[
      "rotation", "rot", "angle", "rotation degrees", "rotation deg",
      "поворот", "угол", "угол поворота"
    ]
  });
  const DELIMITERS = Object.freeze([",", ";", "\t"]);
  const UNIT_FACTORS_MM = Object.freeze({
    mm:1,
    mil:0.0254,
    in:25.4
  });

  function normalizeHeader(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s*(?:\(|\[)\s*(?:mm|мм|mil|mils|thou|in|inch|inches|дюйм(?:а|ов)?)\s*(?:\)|\])\s*/giu, " ")
      .replace(/[.:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const source = String(text ?? "").replace(/\r\n?/g, "\n");
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === "\"") {
        if (quoted && source[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        row.push(cell);
        cell = "";
      } else if (character === "\n" && !quoted) {
        row.push(cell);
        if (row.some(value => String(value).trim())) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }
    row.push(cell);
    if (row.some(value => String(value).trim())) rows.push(row);
    if (quoted) throw new Error("В Pick and Place не закрыта кавычка.");
    return rows;
  }

  function parseWhitespaceLine(line) {
    const cells = [];
    let cell = "";
    let quoted = false;
    const source = String(line ?? "").trim();
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === "\"") {
        if (quoted && source[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (/\s/u.test(character) && !quoted) {
        if (cell) {
          cells.push(cell);
          cell = "";
        }
      } else {
        cell += character;
      }
    }
    if (quoted) throw new Error("В Pick and Place не закрыта кавычка.");
    if (cell) cells.push(cell);
    return cells;
  }

  function columnIndex(headers, field) {
    const aliases = HEADER_ALIASES[field];
    return headers.findIndex(header => aliases.includes(normalizeHeader(header)));
  }

  function columnIndexes(headers) {
    return Object.fromEntries(
      Object.keys(HEADER_ALIASES).map(field => [field, columnIndex(headers, field)])
    );
  }

  function hasRequiredColumns(indexes) {
    return ["ref", "x", "y", "side"].every(field => indexes[field] >= 0);
  }

  function findHeader(source) {
    const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const rawLine = lines[lineIndex];
      const line = rawLine.replace(/^\s*#+\s*/, "");
      if (!line.trim()) continue;
      for (const delimiter of [...DELIMITERS, null]) {
        const headers = delimiter === null
          ? parseWhitespaceLine(line)
          : parseDelimited(line, delimiter)[0] || [];
        const indexes = columnIndexes(headers);
        if (hasRequiredColumns(indexes)) {
          return {lineIndex, delimiter, headers, indexes};
        }
      }
    }
    throw new Error(
      "Не найдены обязательные столбцы Pick and Place: обозначение, X, Y и сторона."
    );
  }

  function normalizedUnit(value, name) {
    const unit = String(value ?? "mm").trim().toLowerCase();
    if (["mm", "мм"].includes(unit)) return "mm";
    if (["mil", "mils", "thou"].includes(unit)) return "mil";
    if (["in", "inch", "inches", "дюйм", "дюйма", "дюймов"].includes(unit)) return "in";
    throw new TypeError(`${name} must be mm, mil, or in`);
  }

  function unitFromHeader(header) {
    const match = String(header ?? "").toLowerCase().match(
      /(?:\(|\[|\s)(mm|мм|mil|mils|thou|in|inch|inches|дюйм(?:а|ов)?)(?:\)|\]|\s|$)/iu
    );
    return match ? normalizedUnit(match[1], "coordinate unit") : null;
  }

  function parseCoordinate(value, header, defaultUnit, label) {
    const text = String(value ?? "").trim().replace(/\s+/g, "");
    const match = text.match(
      /^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)((?:mm|мм|mil|mils|thou|in|inch|inches|дюйм(?:а|ов)?))?$/iu
    );
    if (!match) throw new TypeError(`${label}: некорректная координата «${text || "пусто"}».`);
    const number = Number(match[1].replace(",", "."));
    if (!Number.isFinite(number)) {
      throw new TypeError(`${label}: координата должна быть конечным числом.`);
    }
    const unit = match[2]
      ? normalizedUnit(match[2], `${label} unit`)
      : unitFromHeader(header) || defaultUnit;
    return number * UNIT_FACTORS_MM[unit];
  }

  function parseRotation(value, label) {
    const text = String(value ?? "").trim();
    if (!text) return 0;
    const match = text.replace(/\s+/g, "").match(
      /^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)(?:°|deg|degrees|град(?:усов)?)?$/iu
    );
    const number = match ? Number(match[1].replace(",", ".")) : Number.NaN;
    if (!Number.isFinite(number)) {
      throw new TypeError(`${label}: некорректный угол «${text}».`);
    }
    return number;
  }

  function parseSide(value, label) {
    const side = String(value ?? "").trim().toLowerCase().replace(/[_\s-]+/g, "");
    if ([
      "top", "toplayer", "front", "f", "t", "верх", "верхняя", "верхний"
    ].includes(side)) return "TOP";
    if ([
      "bottom", "bottomlayer", "bot", "back", "b", "низ", "нижняя", "нижний"
    ].includes(side)) return "BOTTOM";
    throw new TypeError(`${label}: сторона должна быть TOP или BOTTOM.`);
  }

  function tableFromHeader(source, header) {
    const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
    const body = lines.slice(header.lineIndex);
    if (header.delimiter === null) {
      return body
        .map((line, index) => (
          index === 0 ? line.replace(/^\s*#+\s*/, "").trim() : line.trim()
        ))
        .filter(line => line && !line.startsWith("#"))
        .map(parseWhitespaceLine);
    }
    return parseDelimited(body.join("\n"), header.delimiter);
  }

  function parsePickAndPlace(text, options = {}) {
    const source = String(text ?? "").replace(/^\uFEFF/, "");
    if (!source.trim()) throw new Error("Файл Pick and Place пуст.");
    const defaultUnit = normalizedUnit(options.defaultUnit ?? "mm", "options.defaultUnit");
    const header = findHeader(source);
    const table = tableFromHeader(source, header);
    const headers = table[0] || header.headers;
    const indexes = columnIndexes(headers);
    const expectedFootprints = [];
    const errors = [];
    const seen = new Map();

    table.slice(1).forEach((row, rowIndex) => {
      const sourceRow = header.lineIndex + rowIndex + 2;
      if (!row.some(value => String(value ?? "").trim())) return;
      try {
        const ref = String(row[indexes.ref] ?? "").trim().toUpperCase();
        if (!ref) throw new TypeError(`Строка ${sourceRow}: нет позиционного обозначения.`);
        const side = parseSide(row[indexes.side], `Строка ${sourceRow}`);
        const duplicateKey = `${side}:${ref}`;
        if (seen.has(duplicateKey)) {
          throw new Error(
            `Строка ${sourceRow}: ${ref} на стороне ${side} уже встречался в строке ${seen.get(duplicateKey)}.`
          );
        }
        const center = {
          x:parseCoordinate(
            row[indexes.x],
            headers[indexes.x],
            defaultUnit,
            `Строка ${sourceRow}, X`
          ),
          y:parseCoordinate(
            row[indexes.y],
            headers[indexes.y],
            defaultUnit,
            `Строка ${sourceRow}, Y`
          )
        };
        const rotationDegrees = indexes.rotation >= 0
          ? parseRotation(row[indexes.rotation], `Строка ${sourceRow}`)
          : 0;
        seen.set(duplicateKey, sourceRow);
        expectedFootprints.push(sessionApi.normalizeExpectedFootprint({
          id:duplicateKey,
          ref,
          side,
          center,
          rotationDegrees,
          geometry:null
        }, expectedFootprints.length));
      } catch (error) {
        errors.push(error.message);
      }
    });

    if (errors.length) {
      const error = new Error(errors.slice(0, 8).join("\n"));
      error.details = errors;
      throw error;
    }
    if (!expectedFootprints.length) {
      throw new Error("В Pick and Place не найдено ни одного компонента.");
    }
    return {
      expectedFootprints,
      delimiter:header.delimiter,
      headers:headers.map(value => String(value ?? "").trim()),
      defaultUnit
    };
  }

  return Object.freeze({
    HEADER_ALIASES,
    UNIT_FACTORS_MM,
    normalizeHeader,
    parseDelimited,
    parseCoordinate,
    parseRotation,
    parseSide,
    parsePickAndPlace
  });
});
