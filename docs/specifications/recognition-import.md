# Recognition import and operator resolution

## Purpose

The recognition importer converts detector output to the canonical
`foundFootprints` array. The renderer combines it with an independently
selected Pick and Place table and runs the existing matching engine without
writing either source to `project.json`.

## JSON input

The root may be an array or an object containing one of:

- `foundFootprints`;
- `detections`;
- `footprints`;
- `items`.

Each item requires a side and centre. Common aliases such as `layer`,
`centerX`, `centerY`, `cx`, and `cy` are accepted. A bounding box may be an
object or `[x, y, width, height]`; its X and Y are interpreted as its top-left
corner and converted to a centre. Geometry may be supplied as canonical
`geometry.pads`, a direct `pads` array, or a positive width and height.

The optional root `units` field accepts `mm`, `mil`, or `in`. Missing units
default to millimetres.

## Table input

CSV, TSV, and semicolon-delimited text are accepted. Required columns are:

- centre X;
- centre Y;
- side.

ID, width, and height are optional. Russian and English headers are
recognized. Width and height must be provided together and describe the
detected bounding rectangle. Decimal commas are accepted when the delimiter
is not a comma.

## Validation

- Sides normalize to `TOP` or `BOTTOM`.
- IDs must be unique.
- Coordinates must be finite.
- Width and height must be positive.
- Source files are limited to 10 MB by both Electron and browser paths.
- Unknown units, malformed rows, and incomplete dimensions reject the import
  with a row or item diagnostic.

## Operator resolution

Exact and acceptable results require no intervention. For uncertain or
ambiguous results, the interface lists only candidates that:

- are on the expected side;
- lie inside the calculated search radius;
- contain usable geometry.

The operator may select one candidate or leave the result skipped. A manual
selection is transient, is never read from the imported source, and is
revalidated by the application-plan layer. Duplicate use of a detected place
or a project component is still rejected.
