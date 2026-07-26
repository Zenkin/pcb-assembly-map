const test = require("node:test");
const assert = require("node:assert/strict");
const importer = require("../js/recognition-import.js");

test("imports canonical and common JSON recognition containers", () => {
  const canonical = importer.parseRecognition(JSON.stringify({
    units:"mm",
    foundFootprints:[{
      id:"fp-1",
      side:"TOP",
      center:{x:10, y:20},
      geometry:{pads:[{x:-1, y:0, width:2, height:1}]}
    }]
  }));
  const common = importer.parseRecognition(JSON.stringify({
    units:"mil",
    detections:[{
      name:"fp-2",
      layer:"back",
      bbox:[100, 200, 40, 20]
    }]
  }));

  assert.deepEqual(canonical.foundFootprints[0], {
    id:"fp-1",
    side:"TOP",
    center:{x:10, y:20},
    x:10,
    y:20,
    geometry:{pads:[{x:-1, y:0, width:2, height:1}]}
  });
  assert.deepEqual(common.foundFootprints[0].center, {x:3.048, y:5.334});
  assert.deepEqual(common.foundFootprints[0].geometry, {
    pads:[{x:0, y:0, width:1.016, height:0.508}]
  });
});

test("imports semicolon recognition tables with decimal commas", () => {
  const parsed = importer.parseRecognition([
    "ID;Центр X (мм);Центр Y (мм);Сторона;Ширина;Высота",
    "det-1;10,5;20,25;Верх;2,4;1,2",
    "det-2;30;40;Низ;;"
  ].join("\n"));

  assert.equal(parsed.format, "table");
  assert.deepEqual(parsed.foundFootprints.map(item => ({
    id:item.id,
    side:item.side,
    center:item.center,
    geometry:item.geometry
  })), [
    {
      id:"det-1",
      side:"TOP",
      center:{x:10.5, y:20.25},
      geometry:{pads:[{x:0, y:0, width:2.4, height:1.2}]}
    },
    {
      id:"det-2",
      side:"BOTTOM",
      center:{x:30, y:40},
      geometry:null
    }
  ]);
});

test("rejects malformed recognition sources with actionable diagnostics", () => {
  assert.throws(() => importer.parseRecognition(""), /пуст/iu);
  assert.throws(
    () => importer.parseRecognition("ID,X,Y\nx,1,2"),
    /обязательные столбцы/
  );
  assert.throws(
    () => importer.parseRecognition(JSON.stringify({
      detections:[{id:"x", side:"left", x:1, y:2}]
    })),
    /TOP или BOTTOM/
  );
  assert.throws(
    () => importer.parseRecognition(JSON.stringify({
      detections:[
        {id:"x", side:"TOP", x:1, y:2},
        {id:"x", side:"TOP", x:3, y:4}
      ]
    })),
    /должен быть уникальным/
  );
  assert.throws(
    () => importer.parseRecognition("X,Y,Side,Width,Height\n1,2,TOP,3,"),
    /указаны вместе/
  );
});
