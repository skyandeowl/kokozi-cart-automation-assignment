const { loadConfig } = require("./config");
const { runTest } = require("./orchestrator/run-test");
const { runKokoziMallCartTest } = require("./tests/kokozi-mall-cart.test");

async function main() {
  const config = loadConfig();
  // CLI는 실행할 TC와 플랫폼 정보를 구성하고 공통 테스트 실행기에 전달합니다.
  const result = await runTest({
    request: {
      test_id: "KZ-CART-025",
      test_name: "회원 상품 담기",
      platform: "android-app-to-mobile-web"
    },
    config,
    test: runKokoziMallCartTest
  });

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "pass" ? 0 : 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
