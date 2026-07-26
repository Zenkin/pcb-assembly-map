const test = require("node:test");
const assert = require("node:assert/strict");
const pickAndPlace = require("../js/pick-and-place.js");

test("imports JLC-style CPL rows with explicit millimeter values", () => {
  const parsed = pickAndPlace.parsePickAndPlace([
    "\uFEFFDesignator,Mid X,Mid Y,Layer,Rotation",
    "\"R1\",10.5mm,20mm,Top,90",
    "\"U2\",35mm,4.25mm,Bottom,180°"
  ].join("\n"));

  assert.equal(parsed.delimiter, ",");
  assert.equal(parsed.defaultUnit, "mm");
  assert.deepEqual(parsed.expectedFootprints, [
    {
      id:"TOP:R1",
      ref:"R1",
      side:"TOP",
      center:{x:10.5, y:20},
      x:10.5,
      y:20,
      rotationDegrees:90,
      geometry:null
    },
    {
      id:"BOTTOM:U2",
      ref:"U2",
      side:"BOTTOM",
      center:{x:35, y:4.25},
      x:35,
      y:4.25,
      rotationDegrees:180,
      geometry:null
    }
  ]);
});

test("imports KiCad-style CSV columns and defaults missing rotation to zero", () => {
  const parsed = pickAndPlace.parsePickAndPlace([
    "Ref,Val,Package,PosX,PosY,Rot,Side",
    "C1,100n,C_0603,12.5,7.75,,top",
    "D1,LED,D_0805,21,9,-45,bottom"
  ].join("\n"));

  assert.deepEqual(
    parsed.expectedFootprints.map(item => [
      item.id,
      item.center.x,
      item.center.y,
      item.rotationDegrees
    ]),
    [
      ["TOP:C1", 12.5, 7.75, 0],
      ["BOTTOM:D1", 21, 9, -45]
    ]
  );
});

test("uses header units and converts mil and inch coordinates to millimeters", () => {
  const mil = pickAndPlace.parsePickAndPlace([
    "Designator\tCenter X (mil)\tCenter Y [mil]\tLayer\tAngle",
    "R1\t1000\t500\tTopLayer\t0"
  ].join("\n"));
  const inches = pickAndPlace.parsePickAndPlace([
    "Ref;X (in);Y (inch);Side",
    "U1;1.5;0.25;BottomLayer"
  ].join("\n"));

  assert.deepEqual(mil.expectedFootprints[0].center, {x:25.4, y:12.7});
  assert.deepEqual(inches.expectedFootprints[0].center, {x:38.099999999999994, y:6.35});
});

test("accepts decimal commas in semicolon-delimited Russian exports", () => {
  const parsed = pickAndPlace.parsePickAndPlace([
    "Поз. обозначение;Центр X (мм);Центр Y (мм);Сторона;Угол поворота",
    "r10;10,25;5,75;Верх;90,5",
    "c3;3,5;4,5;Низ;0"
  ].join("\n"));

  assert.deepEqual(
    parsed.expectedFootprints.map(item => [
      item.id,
      item.center,
      item.rotationDegrees
    ]),
    [
      ["TOP:R10", {x:10.25, y:5.75}, 90.5],
      ["BOTTOM:C3", {x:3.5, y:4.5}, 0]
    ]
  );
});

test("uses an explicit default unit for bare coordinate values", () => {
  const parsed = pickAndPlace.parsePickAndPlace(
    "Ref;X;Y;Side\nR1;1000;2000;TOP",
    {defaultUnit:"mil"}
  );

  assert.deepEqual(parsed.expectedFootprints[0].center, {x:25.4, y:50.8});
  assert.equal(parsed.defaultUnit, "mil");
});

test("finds a KiCad whitespace header after comments", () => {
  const parsed = pickAndPlace.parsePickAndPlace([
    "### Module positions - created on 2026-07-26",
    "## Ref Val Package PosX PosY Rot Side",
    "R1 10k R_0603 10.0 20.0 90 top",
    "C1 100n C_0603 12.0 22.0 0 bottom",
    "## End"
  ].join("\n"));

  assert.equal(parsed.delimiter, null);
  assert.deepEqual(
    parsed.expectedFootprints.map(item => item.id),
    ["TOP:R1", "BOTTOM:C1"]
  );
});

test("rejects missing required columns and unsupported default units", () => {
  assert.throws(
    () => pickAndPlace.parsePickAndPlace("Ref,PosX,PosY\nR1,1,2"),
    /обязательные столбцы/
  );
  assert.throws(
    () => pickAndPlace.parsePickAndPlace(
      "Ref,X,Y,Side\nR1,1,2,TOP",
      {defaultUnit:"px"}
    ),
    /must be mm, mil, or in/
  );
});

test("reports row-specific side, coordinate, rotation, and duplicate errors", () => {
  assert.throws(
    () => pickAndPlace.parsePickAndPlace([
      "Ref,X,Y,Side,Rotation",
      "R1,nope,2,left,nope",
      "R1,1,2,TOP,0",
      "r1,3,4,top,90"
    ].join("\n")),
    error => {
      assert.equal(error.details.length, 2);
      assert.match(error.details[0], /Строка 2: сторона должна быть TOP или BOTTOM/);
      assert.match(error.details[1], /уже встречался в строке 3/);
      return true;
    }
  );

  assert.throws(
    () => pickAndPlace.parsePickAndPlace(
      "Ref,X,Y,Side,Rotation\nR1,nope,2,TOP,nope"
    ),
    /Строка 2, X: некорректная координата/
  );
  assert.throws(
    () => pickAndPlace.parsePickAndPlace(
      "Ref,X,Y,Side,Rotation\nR1,1,2,TOP,nope"
    ),
    /Строка 2: некорректный угол/
  );
});

test("rejects empty files, unclosed quotes, and files without component rows", () => {
  assert.throws(() => pickAndPlace.parsePickAndPlace(" \n "), /файл Pick and Place пуст/iu);
  assert.throws(
    () => pickAndPlace.parsePickAndPlace("Ref,X,Y,Side\n\"R1,1,2,TOP"),
    /не закрыта кавычка/
  );
  assert.throws(
    () => pickAndPlace.parsePickAndPlace("Ref,X,Y,Side\n"),
    /не найдено ни одного компонента/
  );
});
