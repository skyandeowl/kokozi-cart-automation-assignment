const {
  dumpUi,
  inputText,
  launchApp
} = require("../infra/adb");
const {
  findByScrolling,
  findNode,
  nodeText,
  parseNodes,
  tapNode,
  waitForNode
} = require("../infra/ui-xml");

const EXCLUDED_PRODUCT_LABELS = /홈|검색|로그인|회원가입|마이페이지|장바구니|구매하기|품절|메뉴/;

function extractPrice(nodes) {
  for (const node of nodes) {
    const match = nodeText(node).match(/\d[\d,]*\s*원/);
    if (match) return match[0].replace(/\s+/g, "");
  }
  return "";
}

function findProductCandidate(nodes, preferredName) {
  if (preferredName) {
    return findNode(nodes, (node) => nodeText(node).includes(preferredName));
  }

  // 지정 상품이 없을 때는 판매 가능한 첫 상품을 선택합니다. 선택한 이름을 결과에
  // 남겨 동일한 실패를 다시 확인할 수 있도록 합니다.
  return nodes.find((node) => {
    const text = nodeText(node);
    const looksLikeProduct = /product|goods|item|상품/i.test(node["resource-id"] || node["content-desc"] || "");
    return node.clickable === "true" && text && looksLikeProduct && !EXCLUDED_PRODUCT_LABELS.test(text);
  }) || null;
}

function findInput(nodes, matcher, fallbackIndex) {
  const editables = nodes.filter((node) => /EditText|textfield/i.test(node.class || node["resource-id"] || ""));
  return findNode(editables, matcher) || editables[fallbackIndex] || null;
}

async function loginMember(config, member) {
  // 로그인 방식은 결과가 재현되도록 이메일 로그인을 고정 사용합니다.
  const { node: loginEntry } = await waitForNode(config, /로그인/);
  await tapNode(config, loginEntry);

  let xml = await dumpUi(config);
  let nodes = parseNodes(xml);
  const emailMethod = findNode(nodes, /이메일.*로그인|이메일로.*계속|이메일/);
  if (emailMethod && !/EditText|textfield/i.test(emailMethod.class || "")) {
    await tapNode(config, emailMethod);
  }

  ({ xml } = await waitForNode(config, /이메일|휴대폰|비밀번호/));
  nodes = parseNodes(xml);
  const emailInput = findInput(nodes, /이메일|email|아이디|휴대폰/i, 0);
  const passwordInput = findInput(nodes, /비밀번호|password/i, 1);
  if (!emailInput || !passwordInput) throw new Error("회원 로그인 입력 영역을 찾지 못했습니다.");

  await tapNode(config, emailInput);
  await inputText(config, member.email);
  await tapNode(config, passwordInput);
  await inputText(config, member.password);

  const { node: submitButton } = await waitForNode(config, /로그인/);
  await tapNode(config, submitButton);
  await waitForNode(config, /마이페이지|내\s*정보|장바구니|상품/);
}

async function logoutMember(config) {
  const { node: myPage } = await waitForNode(config, /마이페이지|내\s*정보|MY/);
  await tapNode(config, myPage);
  const { node: logout } = await findByScrolling(config, /로그아웃/, 4);
  await tapNode(config, logout);

  const xml = await dumpUi(config);
  const confirm = findNode(parseNodes(xml), /확인|로그아웃/);
  if (confirm) await tapNode(config, confirm);
  await waitForNode(config, /로그인/);
}

async function selectProduct(config) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const xml = await dumpUi(config);
    const nodes = parseNodes(xml);
    const productNode = findProductCandidate(nodes, config.testProductName);
    if (productNode) {
      const selectedName = config.testProductName || productNode.text ||
        productNode["content-desc"] || nodeText(productNode);
      await tapNode(config, productNode);
      return selectedName;
    }

    const { swipe } = require("../infra/adb");
    await swipe(config, 540, 1700, 540, 750, 320);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("코코지몰 상품 목록에서 선택 가능한 상품을 찾지 못했습니다.");
}

async function selectRequiredOption(config) {
  let xml = await dumpUi(config);
  let nodes = parseNodes(xml);
  const addButton = findNode(nodes, /장바구니.*담기/);

  // 필수 옵션이 없는 상품이라면 이미 활성화된 담기 버튼을 그대로 사용합니다.
  if (addButton && addButton.enabled !== "false") return "옵션 없음";

  const optionTrigger = findNode(nodes, /필수.*옵션|옵션.*선택|선택해\s*주세요/);
  if (!optionTrigger) throw new Error("구매 상세에서 필수 옵션 선택 영역을 찾지 못했습니다.");
  await tapNode(config, optionTrigger);

  await new Promise((resolve) => setTimeout(resolve, 400));
  xml = await dumpUi(config);
  nodes = parseNodes(xml);
  const optionNode = config.testOptionName
    ? findNode(nodes, (node) => nodeText(node).includes(config.testOptionName))
    : findNode(nodes, (node) => {
      const text = nodeText(node);
      return node.clickable === "true" && node.enabled !== "false" && text &&
        !/선택|필수|품절|취소|닫기/.test(text);
    });

  if (!optionNode) throw new Error("선택 가능한 필수 옵션 값을 찾지 못했습니다.");
  const selectedOption = config.testOptionName || nodeText(optionNode);
  await tapNode(config, optionNode);
  return selectedOption;
}

async function openCart(config) {
  const { node } = await waitForNode(config, /장바구니/);
  await tapNode(config, node);
  await waitForNode(config, /장바구니|주문\s*상품/);
}

async function assertMemberCart(config, expected) {
  const xml = await dumpUi(config);
  const nodes = parseNodes(xml);
  const allText = nodes.map(nodeText).join(" ").replace(/\s+/g, " ");

  if (expected.productName && !allText.includes(expected.productName)) {
    throw new Error(`회원 A 장바구니에서 상품명 '${expected.productName}'을 확인하지 못했습니다.`);
  }
  if (expected.optionName !== "옵션 없음" && !allText.includes(expected.optionName)) {
    throw new Error(`회원 A 장바구니에서 옵션 '${expected.optionName}'을 확인하지 못했습니다.`);
  }
  if (expected.price && !allText.replace(/\s+/g, "").includes(expected.price)) {
    throw new Error(`상품 상세 가격 '${expected.price}'과 장바구니 가격이 일치하지 않습니다.`);
  }
  if (!/(수량\s*1|1\s*개|quantity\s*1)/i.test(allText)) {
    throw new Error("회원 A 장바구니에서 최초 수량 1개를 확인하지 못했습니다.");
  }
  if (!nodes.some((node) => /ImageView|image/i.test(node.class || node["resource-id"] || ""))) {
    throw new Error("회원 A 장바구니에서 상품 이미지를 확인하지 못했습니다.");
  }
}

async function assertOtherMemberUnaffected(config, productName) {
  const allText = parseNodes(await dumpUi(config)).map(nodeText).join(" ").replace(/\s+/g, " ");
  if (productName && allText.includes(productName)) {
    throw new Error(`회원 A가 담은 상품 '${productName}'이 회원 B 장바구니에도 표시됩니다.`);
  }
}

/**
 * Source TC: KZ-CART-025 회원 상품 담기 (P0)
 *
 * 작성 언어와 실행 환경
 * - Language: JavaScript (CommonJS)
 * - Runtime: Node.js
 * - Android driver: ADB + UIAutomator
 * - Result format: JSON, failure screenshot PNG, UI XML
 *
 * 기술 선택 이유
 * - Node.js는 별도 컴파일 없이 실행할 수 있고 ADB 명령과 파일 저장을 하나의
 *   JavaScript 런타임에서 처리할 수 있습니다.
 * - 순서가 중요한 앱 동작은 async/await로 작성해 수동 TC와 코드 흐름을 맞춥니다.
 * - 고정 좌표 대신 UIAutomator 요소의 의미와 bounds를 사용해 화면 변화에 대응합니다.
 * - 회원 A와 회원 B를 분리 검증해 상품 표시뿐 아니라 회원별 데이터 격리도 판정합니다.
 */
async function runKokoziMallCartTest({ config, step }) {
  await step("코코지 Android 앱 실행", async () => {
    await launchApp(config);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await waitForNode(config, /코코지|홈/);
  });

  await step("앱 상단 코코지몰 선택", async () => {
    const { node } = await waitForNode(config, /코코지\s*몰/);
    await tapNode(config, node);
  });

  await step("코코지몰 회원 A 로그인", async () => {
    await loginMember(config, config.memberA);
  });

  let productName = "";
  await step("정상 판매 상품 A 선택", async () => {
    productName = await selectProduct(config);
  });

  await step("상품 상세 구매하기 선택", async () => {
    const { node } = await findByScrolling(config, /구매하기/, 3);
    await tapNode(config, node);
  });

  let optionName = "";
  let detailPrice = "";
  await step("구매 상세 필수 옵션 선택", async () => {
    optionName = await selectRequiredOption(config);
    detailPrice = extractPrice(parseNodes(await dumpUi(config)));
  });

  await step("활성화된 장바구니 담기 선택", async () => {
    const { node } = await findByScrolling(config, /장바구니.*담기/, 3);
    if (node.enabled === "false") throw new Error("필수 옵션 선택 후 장바구니 담기 버튼이 비활성화 상태입니다.");
    await tapNode(config, node);
  });

  await step("담기 완료 모달에서 장바구니로 이동", async () => {
    const { node } = await waitForNode(config, /장바구니로\s*이동|장바구니\s*보기/);
    await tapNode(config, node);
  });

  await step("회원 A 장바구니 상품 정보 확인", async () => {
    await waitForNode(config, /장바구니/);
    await assertMemberCart(config, { productName, optionName, price: detailPrice });
  });

  await step("회원 B 계정으로 전환", async () => {
    await logoutMember(config);
    await loginMember(config, config.memberB);
    await openCart(config);
  });

  await step("회원 B 장바구니 데이터 격리 확인", async () => {
    await assertOtherMemberUnaffected(config, productName);
  });

  return {
    product_name: productName,
    option_name: optionName,
    detail_price: detailPrice || "가격 표시 없음",
    verified: [
      "회원 A 로그인",
      "상품 담기 완료",
      "상품명",
      "옵션",
      "가격",
      "수량",
      "이미지",
      "회원 B 장바구니 격리"
    ]
  };
}

module.exports = { runKokoziMallCartTest };
