const { execFile } = require("child_process");

function execute(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { maxBuffer: 10 * 1024 * 1024, timeout: 30000, ...options },
      (error, stdout, stderr) => {
        if (error) {
          error.message = `${error.message}\n${String(stderr || "").trim()}`.trim();
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

async function runAdb(config, args, options = {}) {
  const fullArgs = config.deviceId ? ["-s", config.deviceId, ...args] : args;
  try {
    return await execute(config.adbPath, fullArgs, options);
  } catch (error) {
    // USB 연결이 잠깐 흔들린 경우 한 번만 재시도합니다.
    // 무제한 재시도는 기능 오류를 인프라 문제로 숨길 수 있어 사용하지 않습니다.
    if (!/offline|not found|closed|timeout/i.test(error.message)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 700));
    return execute(config.adbPath, fullArgs, options);
  }
}

async function dumpUi(config) {
  const result = await runAdb(
    config,
    ["exec-out", "uiautomator", "dump", "/dev/tty"],
    { timeout: config.uiTimeoutMs }
  );
  return String(result.stdout || "");
}

async function screenshotPng(config) {
  const result = await runAdb(
    config,
    ["exec-out", "screencap", "-p"],
    { encoding: "buffer", timeout: config.uiTimeoutMs }
  );
  return result.stdout;
}

async function tap(config, x, y) {
  await runAdb(config, ["shell", "input", "tap", String(Math.round(x)), String(Math.round(y))]);
}

async function inputText(config, value) {
  // ADB input text에서 공백은 %s로 전달합니다. 계정 값은 환경 변수에서 받아
  // 제출 코드와 실행 결과에 비밀번호가 남지 않게 합니다.
  const encoded = String(value).replace(/%/g, "%25").replace(/ /g, "%s");
  await runAdb(config, ["shell", "input", "text", encoded]);
}

async function swipe(config, fromX, fromY, toX, toY, durationMs = 350) {
  await runAdb(config, [
    "shell", "input", "swipe",
    String(fromX), String(fromY), String(toX), String(toY), String(durationMs)
  ]);
}

async function launchApp(config) {
  await runAdb(config, ["shell", "am", "force-stop", config.appPackage]);
  await runAdb(config, [
    "shell", "monkey", "-p", config.appPackage,
    "-c", "android.intent.category.LAUNCHER", "1"
  ]);
}

module.exports = {
  dumpUi,
  inputText,
  launchApp,
  runAdb,
  screenshotPng,
  swipe,
  tap
};
