const { dumpUi, swipe, tap } = require("./adb");

function decodeXml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseNodes(xml) {
  const nodes = [];
  for (const nodeMatch of String(xml || "").matchAll(/<node\b([^>]*)\/?\s*>/g)) {
    const attrs = {};
    for (const attrMatch of nodeMatch[1].matchAll(/([\w:-]+)="([^"]*)"/g)) {
      attrs[attrMatch[1]] = decodeXml(attrMatch[2]);
    }
    nodes.push(attrs);
  }
  return nodes;
}

function nodeText(node) {
  // UI 구현 방식에 따라 이름이 text, 접근성 설명, resource-id 중 하나에만
  // 노출될 수 있어 세 속성을 하나의 검색 문자열로 정규화합니다.
  return [node.text, node["content-desc"], node["resource-id"]]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function boundsCenter(bounds) {
  const match = String(bounds || "").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return null;
  return {
    x: (Number(match[1]) + Number(match[3])) / 2,
    y: (Number(match[2]) + Number(match[4])) / 2
  };
}

function findNode(nodes, matcher) {
  if (typeof matcher === "function") return nodes.find(matcher) || null;
  return nodes.find((node) => matcher.test(nodeText(node))) || null;
}

async function waitForNode(config, matcher, timeoutMs = config.uiTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastXml = "";
  while (Date.now() < deadline) {
    lastXml = await dumpUi(config);
    const node = findNode(parseNodes(lastXml), matcher);
    if (node) return { node, xml: lastXml };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const label = matcher instanceof RegExp ? matcher.toString() : "custom matcher";
  throw new Error(`화면에서 ${label} 요소를 찾지 못했습니다.`);
}

async function tapNode(config, node) {
  // 고정 좌표 대신 현재 요소 bounds의 중앙을 계산해 화면 크기 변화에 대응합니다.
  const center = boundsCenter(node.bounds);
  if (!center) throw new Error(`탭할 요소의 bounds가 없습니다: ${nodeText(node)}`);
  await tap(config, center.x, center.y);
}

async function findByScrolling(config, matcher, maxSwipes = 5) {
  // 화면에 즉시 보이지 않는 버튼은 제한된 횟수만 스크롤하며 탐색합니다.
  for (let attempt = 0; attempt <= maxSwipes; attempt += 1) {
    const xml = await dumpUi(config);
    const node = findNode(parseNodes(xml), matcher);
    if (node) return { node, xml, swipes: attempt };
    if (attempt < maxSwipes) {
      await swipe(config, 540, 1750, 540, 650, 320);
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
  }
  throw new Error("스크롤 후에도 대상 요소를 찾지 못했습니다.");
}

module.exports = {
  boundsCenter,
  findByScrolling,
  findNode,
  nodeText,
  parseNodes,
  tapNode,
  waitForNode
};
