const path = require("path");
require("dotenv").config();

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
}

function loadConfig() {
  // 단말과 테스트 데이터는 코드에서 분리해 동일한 시나리오를 여러 환경에서
  // 재사용할 수 있도록 환경 변수로 주입합니다.
  return {
    adbPath: process.env.ADB_PATH || "adb",
    deviceId: required("ANDROID_DEVICE_ID"),
    appPackage: required("KOKOZI_APP_PACKAGE"),
    testProductName: String(process.env.TEST_PRODUCT_NAME || "").trim(),
    testOptionName: String(process.env.TEST_OPTION_NAME || "").trim(),
    memberA: {
      email: required("MEMBER_A_EMAIL"),
      password: required("MEMBER_A_PASSWORD")
    },
    memberB: {
      email: required("MEMBER_B_EMAIL"),
      password: required("MEMBER_B_PASSWORD")
    },
    uiTimeoutMs: Number(process.env.UI_TIMEOUT_MS || 15000),
    reportBaseDir: path.resolve(process.env.REPORT_DIR || "output")
  };
}

module.exports = { loadConfig };
