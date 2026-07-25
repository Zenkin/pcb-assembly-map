# Matching coordinate calibration

Automatic matching uses millimetres, while component areas in `project.json`
use source-image pixels. These coordinate systems must not be mixed directly.
An explicit calibration is required for each PCB side before a matching result
can be applied to the project.

## Contract

A calibration contains:

```json
{
  "side": "TOP",
  "maxResidualPx": 2,
  "controlPoints": [
    {"mm": {"x": 0, "y": 0}, "pixel": {"x": 120, "y": 80}},
    {"mm": {"x": 100, "y": 0}, "pixel": {"x": 2120, "y": 90}},
    {"mm": {"x": 0, "y": 50}, "pixel": {"x": 110, "y": 1080}}
  ]
}
```

- `side` is strictly `TOP` or `BOTTOM`.
- At least three non-collinear control points are required.
- Millimetre and pixel coordinates must be finite numbers.
- `maxResidualPx` is positive and defaults to `2`.
- TOP and BOTTOM use independent calibrations.

## Transformation

The module fits the six coefficients of an affine transform:

```text
pixelX = a × mmX + b × mmY + c
pixelY = d × mmX + e × mmY + f
```

With more than three control points, coefficients are found by least squares.
The result reports the residual for every point, RMS residual, and maximum
residual. A result whose maximum residual exceeds `maxResidualPx` is rejected.

An affine transform supports translation, rotation, independent axis scales,
shear, and reflection. A negative determinant is retained and reported as
`mirrored: true`; this is valid and may be intentional for a BOTTOM image.

## Safety rules

- Collinear control points are rejected because they do not define a planar
  transform.
- A degenerate fitted transform is rejected.
- Bounds are transformed by mapping all four corners and then constructing a
  pixel-aligned enclosing rectangle.
- This module does not modify `project.json`.
- Applying matched locations remains a separate, explicit user action.

Perspective-distorted photographs are outside the affine contract. They must
first be rectified or use a future versioned projective-calibration contract.
