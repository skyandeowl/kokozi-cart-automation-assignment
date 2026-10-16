const test = require("node:test");
const assert = require("node:assert/strict");
const { boundsCenter, findNode, parseNodes } = require("./ui-xml");

test("UIAutomator XML에서 텍스트와 bounds를 읽는다", () => {
  const xml = '<hierarchy><node text="장바구니 담기" clickable="true" enabled="true" bounds="[10,20][110,80]" /></hierarchy>';
  const nodes = parseNodes(xml);
  const target = findNode(nodes, /장바구니.*담기/);

  assert.equal(nodes.length, 1);
  assert.equal(target.text, "장바구니 담기");
  assert.deepEqual(boundsCenter(target.bounds), { x: 60, y: 50 });
});
