# Matching session JSON format

The matching session document is an external exchange format for running
automatic footprint matching. It is separate from `project.json`: project
components currently use image coordinates, while every coordinate and
dimension in this document is explicitly measured in millimetres.

## Top-level structure

```json
{
  "format": "soldermap-matching-session",
  "version": 1,
  "units": "mm",
  "options": {
    "radiusScale": 1.5,
    "defaultRadiusMm": 5
  },
  "expectedFootprints": [],
  "foundFootprints": []
}
```

- `format`, `version`, and `units` are required and validated strictly.
- `options` is optional. Missing values use the approved defaults.
- `expectedFootprints` and `foundFootprints` are required arrays.
- UTF-8 JSON with an optional byte-order mark is accepted.

## Expected footprint

```json
{
  "id": "TOP:R1",
  "ref": "R1",
  "side": "TOP",
  "center": {"x": 10, "y": 20},
  "rotationDegrees": 90,
  "geometry": {
    "pads": [
      {"x": -1, "y": 0, "width": 1, "height": 1},
      {"x": 1, "y": 0, "width": 1, "height": 1}
    ]
  }
}
```

- `ref`, `side`, and the centre coordinates are required.
- `id` defaults to `<SIDE>:<REF>`.
- `rotationDegrees` defaults to `0`.
- `geometry` may be `null`. An empty `pads` array is normalized to `null`.

## Found footprint

```json
{
  "id": "detected-1",
  "side": "TOP",
  "center": {"x": 10.2, "y": 20},
  "geometry": null
}
```

- `side` and the centre coordinates are required.
- `id` defaults to `found:<SIDE>:<one-based index>`.
- `geometry` follows the same pad structure as an expected footprint.

All IDs must be non-empty and unique within their corresponding array. Sides
are normalized to `TOP` or `BOTTOM`. Pad dimensions must be finite positive
numbers. Coordinates and rotations must be finite numbers.

## Compatibility

Version `1` is the only supported version. A document with another `format`,
`version`, or coordinate unit is rejected instead of being interpreted
implicitly. Future incompatible changes require a new document version and an
explicit parser branch.
