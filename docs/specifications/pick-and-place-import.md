# Pick and Place import

## Purpose

The importer converts placement-table rows into the canonical
`expectedFootprints` array used by a SolderMap matching session. It does not
write to `project.json` and does not infer detected footprints from the board
image.

## Supported tables

The first row containing all four required fields is treated as the header.
The parser recognizes common English and Russian aliases:

| Canonical field | Examples |
| --- | --- |
| Reference | `Ref`, `Designator`, `Reference Designator`, `Обозначение` |
| X coordinate | `PosX`, `Mid X`, `Center X`, `Центр X` |
| Y coordinate | `PosY`, `Mid Y`, `Center Y`, `Центр Y` |
| Board side | `Side`, `Layer`, `Сторона`, `Слой` |
| Rotation (optional) | `Rot`, `Rotation`, `Angle`, `Угол поворота` |

Comma-, semicolon-, tab-, and whitespace-delimited rows are accepted. Quoted
CSV values, UTF-8 byte-order marks, and KiCad comment lines before and after
the data are supported.

## Coordinates

Canonical output coordinates are millimetres. Units can be declared in an X
or Y header, appended to an individual value, or supplied as the parser's
default unit:

- `mm` / `мм`;
- `mil` / `thou`;
- `in` / `inch`.

Bare coordinate values default to millimetres. A decimal comma is accepted
when the table delimiter does not use the comma.

## Normalization and validation

- References are trimmed and converted to uppercase.
- Sides are normalized to `TOP` or `BOTTOM`; common `TopLayer`, `BottomLayer`,
  `front`, `back`, and Russian labels are accepted.
- Missing rotations become `0` degrees.
- Expected geometry is `null`, because placement tables do not describe pad
  geometry.
- A duplicate case-insensitive `reference + side`, missing field, unsupported
  side, invalid coordinate, or invalid rotation rejects the import with source
  row details.

The importer deliberately does not guess a side or silently discard malformed
rows. A later workflow can combine its `expectedFootprints` with detected
footprints and serialize the complete versioned matching-session JSON.
