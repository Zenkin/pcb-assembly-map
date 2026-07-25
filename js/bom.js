(function initBom(root, factory) {
  const verification = typeof module === "object" && module.exports
    ? require("./verification.js")
    : root?.SolderMapVerification;
  const api = factory(verification);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SolderMapBom = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBomApi(verification) {
  const MAX_BACKUPS = 10;
  const HEADER_ALIASES = Object.freeze({
    ref:["ref", "reference", "references", "designator", "designators", "позиция", "позиционное обозначение", "обозначение", "поз. обозначение", "поз"],
    value:["value", "nominal", "номинал", "значение", "деталь", "part", "part number", "mpn"],
    type:["type", "тип", "тип компонента", "component type"],
    tolerance:["tolerance", "tolerance %", "допуск", "допуск %", "допуск, %"],
    side:["side", "сторона", "layer", "слой"]
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizedHeader(value) {
    return String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function detectDelimiter(line) {
    const candidates = [";", "\t", ","];
    return candidates.reduce((best, delimiter) => {
      const count = String(line || "").split(delimiter).length - 1;
      return count > best.count ? {delimiter, count} : best;
    }, {delimiter:";", count:-1}).delimiter;
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const source = String(text || "").replace(/\r\n?/g, "\n");
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
    if (quoted) throw new Error("В BOM не закрыта кавычка.");
    return rows;
  }

  function columnIndex(headers, field) {
    const aliases = HEADER_ALIASES[field];
    return headers.findIndex(header => aliases.includes(normalizedHeader(header)));
  }

  function expandReferenceToken(token) {
    const value = String(token || "").trim().toUpperCase();
    const range = value.match(/^([A-ZА-Я]+)(\d+)\s*[-–—]\s*(?:[A-ZА-Я]+)?(\d+)$/u);
    if (!range) return value ? [value] : [];
    const start = Number(range[2]);
    const end = Number(range[3]);
    if (end < start || end - start > 10000) return [value];
    return Array.from({length:end - start + 1}, (_, index) => `${range[1]}${start + index}`);
  }

  function splitReferences(value) {
    return String(value || "")
      .split(/[\s,|/]+/u)
      .flatMap(expandReferenceToken)
      .filter(Boolean);
  }

  function inferredType(ref) {
    const prefix = String(ref || "").trim().match(/^[^\d]+/u)?.[0]?.toUpperCase() || "";
    return ({
      R:"Резистор",
      C:"Конденсатор",
      L:"Катушка",
      D:"Диод",
      Q:"Транзистор",
      U:"Микросхема"
    })[prefix] || prefix;
  }

  function normalizeTolerance(value) {
    const parsed = verification?.parseTolerance?.(value, true);
    return parsed === null || parsed === undefined ? null : parsed;
  }

  function parseBom(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    if (!source.trim()) throw new Error("Файл BOM пуст.");
    const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0]);
    const table = parseDelimited(source, delimiter);
    if (table.length < 2) throw new Error("В BOM нет строк компонентов.");
    const headers = table[0].map(normalizedHeader);
    const indexes = Object.fromEntries(Object.keys(HEADER_ALIASES).map(field => [field, columnIndex(headers, field)]));
    if (indexes.ref < 0) throw new Error("Не найден столбец позиционных обозначений.");
    const entries = [];
    const errors = [];
    table.slice(1).forEach((row, rowIndex) => {
      const refs = splitReferences(row[indexes.ref]);
      if (!refs.length) {
        errors.push(`Строка ${rowIndex + 2}: нет позиционного обозначения.`);
        return;
      }
      const value = indexes.value >= 0 ? String(row[indexes.value] || "").trim() : "";
      const explicitType = indexes.type >= 0 ? String(row[indexes.type] || "").trim() : "";
      const toleranceRaw = indexes.tolerance >= 0 ? String(row[indexes.tolerance] || "").trim() : "";
      const tolerance = normalizeTolerance(toleranceRaw);
      if (toleranceRaw && tolerance === null) {
        errors.push(`Строка ${rowIndex + 2}: некорректный допуск «${toleranceRaw}».`);
        return;
      }
      const sideRaw = indexes.side >= 0 ? String(row[indexes.side] || "").trim().toUpperCase() : "";
      const side = sideRaw === "BOTTOM" || sideRaw === "BOT" || sideRaw === "НИЗ" ? "BOTTOM" : "TOP";
      refs.forEach(ref => entries.push({
        ref,
        value,
        type:explicitType || inferredType(ref),
        tolerance,
        side,
        sourceRow:rowIndex + 2
      }));
    });
    if (errors.length) {
      const error = new Error(errors.slice(0, 8).join("\n"));
      error.details = errors;
      throw error;
    }
    if (!entries.length) throw new Error("В BOM не найдено ни одного компонента.");
    return {entries, delimiter, headers};
  }

  function typeKey(value, ref) {
    return String(value || inferredType(ref)).trim().toLowerCase();
  }

  function nominalKey(value, ref) {
    const parsed = verification?.parseNominal?.(value, ref);
    if (parsed?.valid) return `${parsed.baseValue}`;
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function effectiveTolerance(item) {
    const explicit = normalizeTolerance(item?.tolerance);
    return explicit ?? verification?.parseTolerance?.(item?.value) ?? null;
  }

  function mapKeysForRef(map, ref) {
    const suffix = `:${String(ref || "").toUpperCase()}`;
    return Object.keys(map || {}).filter(key => String(key).toUpperCase().endsWith(suffix));
  }

  function planUpdate(components, entries, verificationMap) {
    const current = Array.isArray(components) ? components : [];
    const records = verificationMap && typeof verificationMap === "object" ? verificationMap : {};
    const incomingGroups = new Map();
    (Array.isArray(entries) ? entries : []).forEach(entry => {
      const ref = String(entry?.ref || "").trim().toUpperCase();
      if (!ref) return;
      if (!incomingGroups.has(ref)) incomingGroups.set(ref, []);
      incomingGroups.get(ref).push({...entry, ref});
    });
    const duplicates = [...incomingGroups.entries()].filter(([, group]) => group.length > 1);
    const incoming = new Map([...incomingGroups.entries()].map(([ref, group]) => [ref, group[0]]));
    const currentRefs = new Map();
    current.forEach(component => currentRefs.set(String(component.ref || "").trim().toUpperCase(), component));
    const changes = [];
    const conflicts = duplicates.map(([ref, group]) => ({
      ref,
      kind:"duplicate",
      label:`Найден в строках ${group.map(item => item.sourceRow).join(", ")}`
    }));
    const resetRefs = new Set();

    currentRefs.forEach((component, ref) => {
      const next = incoming.get(ref);
      if (!next) {
        changes.push({
          ref,
          kind:"removed",
          label:"Отсутствует в новой BOM",
          before:{type:component.type || inferredType(component.ref), value:component.value || "", tolerance:effectiveTolerance(component)},
          after:null
        });
        conflicts.push({ref, kind:"removed", label:"Компонент будет удалён"});
        resetRefs.add(ref);
        return;
      }
      const typeChanged = typeKey(component.type, component.ref) !== typeKey(next.type, next.ref);
      const valueChanged = nominalKey(component.value, component.ref) !== nominalKey(next.value, next.ref);
      const toleranceChanged = effectiveTolerance(component) !== effectiveTolerance(next);
      if (typeChanged || valueChanged || toleranceChanged) {
        const kind = typeChanged && valueChanged ? "type_and_value" : (typeChanged ? "type" : (valueChanged ? "value" : "tolerance"));
        changes.push({
          ref,
          kind,
          label:typeChanged || valueChanged ? "Проверка будет сброшена" : "Допуск будет обновлён",
          before:{type:component.type || inferredType(component.ref), value:component.value || "", tolerance:effectiveTolerance(component)},
          after:{type:next.type, value:next.value, tolerance:effectiveTolerance(next)}
        });
        if (typeChanged || valueChanged) resetRefs.add(ref);
        if (typeChanged && valueChanged) conflicts.push({ref, kind, label:"Одновременно изменились тип и номинал"});
      } else {
        changes.push({ref, kind:"unchanged", label:"Без изменений", before:null, after:null});
      }
    });
    incoming.forEach((entry, ref) => {
      if (!currentRefs.has(ref)) {
        changes.push({
          ref,
          kind:"added",
          label:"Новый компонент, пока не размещён",
          before:null,
          after:{type:entry.type, value:entry.value, tolerance:effectiveTolerance(entry)}
        });
      }
    });

    const duplicateRefs = new Set(duplicates.map(([ref]) => ref));
    const nextComponents = current
      .filter(component => incoming.has(String(component.ref || "").trim().toUpperCase()))
      .map(component => {
        const ref = String(component.ref || "").trim().toUpperCase();
        const entry = incoming.get(ref);
        if (duplicateRefs.has(ref)) return clone(component);
        return {...clone(component), value:entry.value, type:entry.type, tolerance:entry.tolerance};
      });
    incoming.forEach((entry, ref) => {
      if (currentRefs.has(ref) || duplicateRefs.has(ref)) return;
      nextComponents.push({
        ref:entry.ref,
        side:entry.side,
        stage:"",
        group:"",
        value:entry.value,
        type:entry.type,
        tolerance:entry.tolerance,
        x:0,
        y:0,
        w:40,
        h:28,
        note:"",
        unplaced:true
      });
    });
    const nextVerificationMap = clone(records);
    resetRefs.forEach(ref => mapKeysForRef(nextVerificationMap, ref).forEach(key => delete nextVerificationMap[key]));
    return {
      changed:changes.some(change => change.kind !== "unchanged"),
      changes,
      conflicts,
      resetRefs:[...resetRefs],
      nextComponents,
      nextVerificationMap
    };
  }

  function createBackup(backups, verificationMap, reason, now = new Date()) {
    const source = Array.isArray(backups) ? backups : [];
    const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
    const backup = {
      id:`${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt:timestamp,
      reason:String(reason || "Резервная копия"),
      verificationMap:clone(verificationMap || {})
    };
    return {backup, backups:[backup, ...clone(source)].slice(0, MAX_BACKUPS)};
  }

  function compareBackup(currentMap, backupMap, refs = null) {
    const current = currentMap || {};
    const saved = backupMap || {};
    const selected = refs?.length ? new Set(refs.map(ref => String(ref).trim().toUpperCase()).filter(Boolean)) : null;
    const keys = new Set([...Object.keys(current), ...Object.keys(saved)]);
    const changes = [];
    keys.forEach(key => {
      const ref = String(key).split(":").pop().toUpperCase();
      if (selected && !selected.has(ref)) return;
      const before = current[key];
      const after = saved[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({key, ref, hasCurrent:Boolean(before), hasBackup:Boolean(after)});
      }
    });
    return changes;
  }

  function restoreBackup(currentMap, backupMap, refs = null) {
    const next = clone(currentMap || {});
    const saved = clone(backupMap || {});
    if (!refs?.length) return saved;
    const selected = new Set(refs.map(ref => String(ref).trim().toUpperCase()).filter(Boolean));
    [...new Set([...Object.keys(next), ...Object.keys(saved)])].forEach(key => {
      const ref = String(key).split(":").pop().toUpperCase();
      if (!selected.has(ref)) return;
      if (Object.prototype.hasOwnProperty.call(saved, key)) next[key] = saved[key];
      else delete next[key];
    });
    return next;
  }

  return Object.freeze({
    MAX_BACKUPS,
    parseBom,
    planUpdate,
    createBackup,
    compareBackup,
    restoreBackup,
    splitReferences
  });
});
