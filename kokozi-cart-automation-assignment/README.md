# 코코지몰 회원 상품 담기 자동화 과제

첨부된 `코코지몰 장바구니 개편 TC` 중 **KZ-CART-025 회원 상품 담기(P0)**를 자동화한 제출용 프로젝트입니다.

코코지 Android 앱에서 코코지몰 모바일 웹으로 진입한 뒤 회원 A로 상품을 담고, 상품 정보가 정확히 반영되는지와 회원 B의 장바구니에 영향을 주지 않는지를 검증합니다.

## 선택한 테스트케이스

| 항목 | 내용 |
| --- | --- |
| TC ID | KZ-CART-025 |
| 테스트명 | 회원 상품 담기 |
| 우선순위 | P0 |
| 원본 플랫폼 | PC Web / Mobile Web |
| 자동화 실행 경로 | Android App → Mobile Web |
| 사전조건 | 회원 A 로그인 가능, 장바구니 기능 배포 |
| 테스트 데이터 | 정상 상품 A, 회원 A, 회원 B |
| 기대 결과 | 회원 A 장바구니에 상품 A 표시, 회원 B 장바구니에는 영향 없음 |

## 자동화 시나리오

1. 코코지 Android 앱을 실행합니다.
2. 앱 상단 헤더에서 `코코지몰`을 선택합니다.
3. 이메일 방식으로 회원 A에 로그인합니다.
4. 로그인 후 코코지몰 화면으로 이동했는지 확인합니다.
5. 판매 가능한 정상 상품 A를 선택합니다.
6. 상품 상세에서 `구매하기`를 선택합니다.
7. 필수 옵션을 선택합니다.
8. 활성화된 `장바구니 담기` 버튼을 선택합니다.
9. 담기 완료 모달에서 `장바구니로 이동`을 선택합니다.
10. 회원 A 장바구니에서 상품 이미지, 상품명, 옵션, 가격, 수량을 확인합니다.
11. 로그아웃한 뒤 회원 B로 로그인합니다.
12. 회원 B 장바구니에 회원 A가 담은 상품이 표시되지 않는지 확인합니다.

## 작성 언어와 도구

| 구분 | 사용 기술 | 역할 |
| --- | --- | --- |
| 작성 언어 | JavaScript(CommonJS) | 테스트 시나리오와 판정 로직 작성 |
| 실행 환경 | Node.js | CLI 및 단계별 테스트 실행 |
| 단말 제어 | Android Debug Bridge(ADB) | 앱 실행, 탭, 스와이프, 화면 캡처 |
| UI 탐색 | UIAutomator XML | 텍스트, 접근성 설명, 리소스 ID와 bounds 탐색 |
| 결과 기록 | JSON, PNG, XML | 단계별 결과와 실패 증적 저장 |

### JavaScript를 선택한 이유

- `async/await`로 앱 실행부터 장바구니 검증까지 사용자 행동 순서를 읽기 쉽게 표현할 수 있습니다.
- Node.js의 `child_process`와 파일 API를 이용해 ADB 명령 실행과 결과 저장을 하나의 런타임에서 처리할 수 있습니다.
- 별도 컴파일 과정 없이 `node src/cli.js`로 실행할 수 있어 테스트 수정과 반복 실행이 간단합니다.
- 단말 제어, UI 탐색, 실행 관리, 테스트 시나리오를 모듈로 분리하기 좋습니다.

## 설계 구조

```text
CLI
 └─ 테스트 실행기
     ├─ 단계별 PASS/FAIL 기록
     ├─ Android ADB 제어
     ├─ UIAutomator 요소 탐색
     └─ 장바구니 업무 검증
```

### 의미 기반 요소 탐색

화면의 고정 좌표를 직접 사용하지 않고 UIAutomator XML의 `text`, `content-desc`, `resource-id`, `bounds`, `enabled` 값을 사용합니다. 버튼의 의미를 먼저 찾고 해당 요소의 현재 bounds 중앙을 탭하므로 화면 크기 변화에 대응할 수 있습니다.

### 단계별 실행 결과

각 사용자 행동을 독립된 단계로 실행하고 소요시간과 PASS/FAIL을 기록합니다. 실패하면 마지막 성공 단계와 실패 단계를 구분할 수 있으며, 화면 PNG와 UI XML도 함께 저장합니다.

### 재현 가능한 상품 선택

`TEST_PRODUCT_NAME`을 지정하면 해당 상품을 선택합니다. 값이 없으면 화면에서 판매 가능한 첫 번째 상품을 선택하고, 선택한 상품명과 옵션을 결과에 기록합니다. 회원 계정은 환경 변수로 분리해 코드에 인증정보를 저장하지 않습니다.

### 엄격한 PASS 기준

장바구니 화면 진입만으로 PASS 처리하지 않습니다. 상품 상세에서 선택한 값과 장바구니의 상품명, 옵션, 가격을 비교하고 최초 수량 1개와 상품 이미지까지 확인합니다.

## 프로젝트 구조

```text
kokozi-cart-automation-assignment/
├── docs/
│   └── TC-AUTOMATION-MAPPING.md
├── src/
│   ├── cli.js
│   ├── config.js
│   ├── infra/
│   │   ├── adb.js
│   │   ├── ui-xml.js
│   │   └── ui-xml.unit.test.js
│   ├── orchestrator/
│   │   ├── run-store.js
│   │   └── run-test.js
│   └── tests/
│       └── kokozi-mall-cart.test.js
├── .env.example
├── .gitignore
└── package.json
```

## 주요 파일

- `src/tests/kokozi-mall-cart.test.js`: KZ-CART-025의 회원 상품 담기와 계정별 장바구니 격리 기준을 정의합니다.
- `src/infra/adb.js`: Android 앱 실행, 탭, 스와이프, 화면 캡처를 담당합니다.
- `src/infra/ui-xml.js`: UI XML을 분석하고 의미 기반으로 요소를 찾아 탭합니다.
- `src/orchestrator/run-test.js`: 단계별 결과와 최종 PASS/FAIL을 관리합니다.
- `src/orchestrator/run-store.js`: 실행별 JSON, PNG, XML 결과를 분리해 저장합니다.
- `docs/TC-AUTOMATION-MAPPING.md`: 원본 TC와 자동화 코드의 대응 관계를 정리합니다.

## 실행 방법

```bash
npm install
cp .env.example .env
npm start
```

`.env`에는 테스트 단말과 앱 정보를 입력합니다.

```dotenv
ADB_PATH=adb
ANDROID_DEVICE_ID=emulator-5554
KOKOZI_APP_PACKAGE=com.example.kokozi
TEST_PRODUCT_NAME=상품 A
TEST_OPTION_NAME=기본 옵션
MEMBER_A_EMAIL=member-a@example.com
MEMBER_A_PASSWORD=member-a-password
MEMBER_B_EMAIL=member-b@example.com
MEMBER_B_PASSWORD=member-b-password
UI_TIMEOUT_MS=15000
REPORT_DIR=output
```

## 결과 파일

실행마다 독립된 폴더를 만들고 요청 정보, 진행 상태, 최종 결과를 저장합니다.

```text
output/
└── qa-20261016-143000-KZ-CART-025/
    ├── request.json
    ├── progress.json
    ├── result.json
    ├── logs/
    │   └── failure-ui.xml
    └── screenshots/
        └── failure.png
```

PASS 결과에는 선택한 상품명, 옵션, 가격과 검증 완료 항목이 포함됩니다. FAIL 결과에는 실패 단계, 오류 메시지, 화면과 UI 구조 증적이 포함됩니다.

## PASS 판정 기준

아래 항목을 모두 만족해야 PASS입니다.

1. 코코지 Android 앱의 헤더에서 코코지몰로 진입합니다.
2. 회원 A로 로그인하고 상품 상세 화면으로 이동합니다.
3. 필수 옵션 선택 후 장바구니 담기 버튼이 활성화됩니다.
4. 담기 완료 안내와 장바구니 이동 버튼이 표시됩니다.
5. 회원 A 장바구니 상품명이 선택한 상품명과 일치합니다.
6. 선택 옵션과 가격이 장바구니 표시값과 일치합니다.
7. 최초 수량이 1개이며 상품 이미지가 표시됩니다.
8. 회원 B 장바구니에는 회원 A가 담은 상품이 표시되지 않습니다.

