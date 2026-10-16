const fs = require("fs");
const path = require("path");

function pad(value) {
  return String(value).padStart(2, "0");
}

function createExecutionId(testId, now = new Date()) {
  // 테스트 ID와 실행 시각을 조합해 여러 실행의 결과 파일이 섞이지 않게 합니다.
  const stamp = [
    now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()), "-",
    pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())
  ].join("");
  return `qa-${stamp}-${testId}`;
}

function createRunStore(reportBaseDir, request) {
  const executionId = request.execution_id || createExecutionId(request.test_id);
  const runDir = path.join(reportBaseDir, executionId);
  const screenshotsDir = path.join(runDir, "screenshots");
  const logsDir = path.join(runDir, "logs");

  // JSON 결과와 화면/로그 증적을 실행 단위 디렉터리에 함께 보관합니다.
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  const fullRequest = { execution_id: executionId, ...request, created_at: new Date().toISOString() };
  fs.writeFileSync(path.join(runDir, "request.json"), JSON.stringify(fullRequest, null, 2));

  return {
    executionId,
    runDir,
    screenshotsDir,
    logsDir,
    request: fullRequest,
    writeProgress(progress) {
      fs.writeFileSync(
        path.join(runDir, "progress.json"),
        JSON.stringify({ ...progress, updated_at: new Date().toISOString() }, null, 2)
      );
    },
    writeResult(result) {
      fs.writeFileSync(path.join(runDir, "result.json"), JSON.stringify(result, null, 2));
    },
    writeScreenshot(name, buffer) {
      const filePath = path.join(screenshotsDir, `${name}.png`);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    },
    writeLog(name, content) {
      const filePath = path.join(logsDir, name);
      fs.writeFileSync(filePath, String(content));
      return filePath;
    }
  };
}

module.exports = { createExecutionId, createRunStore };
