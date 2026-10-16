const { dumpUi, screenshotPng } = require("../infra/adb");
const { createRunStore } = require("./run-store");

async function runTest({ request, config, test }) {
  const store = createRunStore(config.reportBaseDir, request);
  const startedAt = Date.now();
  const steps = [];
  store.writeProgress({ status: "running", current_step: "실행 준비", steps });

  // 수동 TC의 한 줄을 하나의 자동화 단계로 기록합니다. 전체 결과만 남기는 것보다
  // 마지막 성공 동작과 실패 동작을 빠르게 구분할 수 있습니다.
  async function step(name, action) {
    const stepStartedAt = Date.now();
    try {
      const value = await action();
      steps.push({ name, status: "pass", duration_ms: Date.now() - stepStartedAt });
      store.writeProgress({ status: "running", current_step: name, steps });
      return value;
    } catch (error) {
      steps.push({
        name,
        status: "fail",
        duration_ms: Date.now() - stepStartedAt,
        message: error.message
      });
      store.writeProgress({ status: "fail", current_step: name, steps });
      throw error;
    }
  }

  try {
    const summary = await test({ config, store, step });
    const result = {
      execution_id: store.executionId,
      test_id: request.test_id,
      test_name: request.test_name,
      status: "pass",
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      steps,
      summary
    };
    store.writeProgress({ status: "pass", current_step: "검증 완료", steps });
    store.writeResult(result);
    return result;
  } catch (error) {
    const artifacts = [];

    // 실패 당시 화면과 접근성 트리를 함께 저장합니다. 화면만으로는 잘못된
    // selector인지 실제 기능 오류인지 구분하기 어려운 경우가 있기 때문입니다.
    try {
      artifacts.push(store.writeScreenshot("failure", await screenshotPng(config)));
    } catch (captureError) {
      steps.push({ name: "실패 화면 캡처", status: "warning", message: captureError.message });
    }
    try {
      artifacts.push(store.writeLog("failure-ui.xml", await dumpUi(config)));
    } catch (captureError) {
      steps.push({ name: "실패 UI XML 저장", status: "warning", message: captureError.message });
    }

    const result = {
      execution_id: store.executionId,
      test_id: request.test_id,
      test_name: request.test_name,
      status: "fail",
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      steps,
      error: { message: error.message, stack: error.stack },
      artifacts
    };
    store.writeProgress({
      status: "fail",
      current_step: steps.findLast?.((item) => item.status === "fail")?.name || "검증 실패",
      steps
    });
    store.writeResult(result);
    return result;
  }
}

module.exports = { runTest };
