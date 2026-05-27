<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Estate Project: 부동산 수요 전이 기반 가격 상승 예측 시스템

## 프로젝트 개요
**Next-Step** — 서울/경기/인천 수도권 대장아파트 상승 신호를 감지하고, 인접 지역으로의 수요 이동 경로를 분석하여 다음 상승 지역을 예측하는 시스템.

## 기술 스택
- **Framework**: Next.js 16.2.1 (App Router) + React 19.2.4
- **DB**: PostgreSQL 16 (Docker, 포트 5433) + Prisma 7.6.0 (@prisma/adapter-pg)
- **Charts**: Recharts 3.8.1
- **Map**: Leaflet + react-leaflet (dynamic import, SSR 비활성화)
- **API 파싱**: fast-xml-parser (공공데이터포털 XML→JSON)
- **스타일**: CSS (globals.css, 다크 테마, glass-panel 디자인)

## 환경 설정
```bash
# PostgreSQL (Docker)
docker compose up -d  # 포트 5433

# .env / .env.local 필수 변수
DATABASE_URL="postgresql://estate:estate_dev@localhost:5433/estate"
DATA_GO_KR_API_KEY="공공데이터포털 Decoding 키"

# Prisma
npx prisma db push    # 스키마 동기화
npx prisma db seed    # 시드 데이터 (70지역, 162인접관계, 22대장아파트)
npx prisma generate   # 클라이언트 생성 (lib/generated/prisma/)
```

## 핵심 파일 구조
```
app/
  api/proxy/route.js           # 공공데이터 API 프록시 (34개 엔드포인트)
  api/predict/
    collect/route.js           # POST: 매매/전월세 데이터 수집 (DB 캐시 지원)
    score/route.js             # GET: Phase 1→2→3 전체 파이프라인
    trigger/route.js           # GET: Phase 1 트리거 감지만 실행
    results/route.js           # GET: 저장된 예측 결과 조회
    status/route.js            # GET: 수집 작업 상태/통계
  predict/
    page.js                    # 예측 대시보드 (트리거 + 지도 + 순위표 + 흐름도)
    components/PredictionMap.js # Leaflet 지도 (구 경계 + 마커 + 화살표)
  components/
    TopNav.js                  # 네비게이션 (/, /trends, /predict)
    BlueChipTrends.js          # 대장아파트 시세 트렌드 (차트 + 기간 선택)
  page.js                      # 부동산 API 탐색기 (메인 페이지)
  trends/page.js               # 트렌드 페이지

lib/
  db.js                        # Prisma 싱글턴 (PrismaPg 어댑터)
  apiClient.js                 # 서버사이드 API 호출 + XML/JSON 파싱
  utils.js                     # formatPrice, getLastNMonths, batchProcess
  constants/
    regionCodes.js             # 수도권 70개 지역 (서울25+경기35+인천10, 급지 포함)
    adjacencyGraph.js          # 서울 구 인접 그래프 + 서울-경기 경계 연결
    blueChipApartments.js      # 22개 대장아파트 목록
    regionCoordinates.js       # 지역별 위경도 좌표
  predict/
    triggerDetection.js        # Phase 1: ATH_90, PRICE_JUMP_5PCT 감지
    demandMigration.js         # Phase 2: 1차/2차 인접 지역 후보 선별
    scoring.js                 # Phase 3: 4지표 100점 만점 스코어링

prisma/
  schema.prisma                # 9개 테이블 (Region, Trade, Rent, TriggerEvent 등)
  seed.ts                      # 시드 스크립트 (tsx로 실행)
  comments.sql                 # 테이블/컬럼 설명 SQL

public/data/
  seoul-gu.geojson             # 서울 25구 경계 (LAWD_CD 매핑 완료)
```

## 예측 알고리즘 (3-Phase)

### Phase 1: 트리거 감지 (triggerDetection.js)
- 대장아파트 22개 모니터링
- 조건 A: 최근 3개월 최고가 ≥ 전고점의 90% → `ATH_90`
- 조건 B: 직전 거래 대비 5%+ 상승 → `PRICE_JUMP_5PCT`

### Phase 2: 수요 이동 매핑 (demandMigration.js)
- 트리거 지역의 1차 인접(distance=1), 2차 인접(distance=2) 탐색
- 필터: 트리거 지역보다 낮은 가격 + 상승 전 가격 수준과 유사
- 서울-경기 경계 가중치: 0.7~0.8

### Phase 3: 스코어링 (scoring.js)
| 지표 | 배점 | 산출 |
|------|------|------|
| 전세가율 | 30점 | 전세/매매 비율 0.5→0.7 스케일 + 상승 추세 보너스 |
| 거래량 | 30점 | 최근3개월 / 3년평균 비율 1.0→2.0 스케일 |
| 인접성 | 20점 | 1차=20, 2차=10, 경계 가중치 적용 |
| 가격차 | 20점 | 트리거 대비 저평가 0.1→0.5 스케일 |

## DB 스키마 (9개 테이블)
- **Region**: 수도권 70개 지역 (LAWD_CD, 급지)
- **RegionAdjacency**: 인접 그래프 (from→to, weight)
- **BlueChipApartment**: 22개 대장아파트
- **Trade**: 매매 실거래 캐시 (regionId, dealYmd, aptName, dealAmount...)
- **Rent**: 전월세 실거래 캐시 (rentType=전세|월세, deposit, monthlyRent...)
- **MonthlyRegionStat**: 월별 집계 (avgTradePrice, leaseToPrice...)
- **TriggerEvent**: Phase 1 결과
- **PredictionResult**: Phase 3 결과 (totalScore, 4개 세부 점수, reasoning JSON)
- **CollectionJob**: 수집 작업 추적

## 데이터 수집 최적화
- DB에 이미 있는 (regionId, dealYmd) 조합은 API 호출 스킵
- 5개씩 배치 호출 + 200ms 딜레이 (API 속도 제한 대응)
- numOfRows=9999로 페이지네이션 회피

## 코딩 규칙
- Prisma 클라이언트는 `lib/db.js`에서 import (PrismaPg 어댑터 사용)
- 서버사이드 API 호출은 `lib/apiClient.js`의 `fetchFromDataGoKr()` 사용
- 가격 포맷팅은 `lib/utils.js`의 `formatPrice()` 사용
- 지도 컴포넌트는 반드시 `dynamic(() => import(...), { ssr: false })` 로 로드
- CSS는 globals.css에 추가 (다크 테마 변수 사용)
- 새 페이지 추가 시 TopNav.js에 링크 추가

## MCP 서버

이 프로젝트는 `.mcp.json`에서 **context7** MCP 서버를 등록한다. Next.js 16 / Prisma 7 / React 19 등 학습 데이터 이후 변경된 API를 다룰 때 **context7로 최신 공식 문서를 먼저 조회**한다. 사용 흐름:

1. 라이브러리 식별: `mcp__context7__resolve-library-id` 로 정확한 라이브러리 ID 확인 (예: `next`, `prisma`, `leaflet`)
2. 문서 조회: `mcp__context7__get-library-docs` 로 특정 토픽의 최신 문서 가져오기 (예: topic="app router middleware")
3. 보조 확인: 로컬 `node_modules/next/dist/docs/` 도 함께 참고 (deprecation 노트 포함)

context7로도 정보가 부족하면 사용자에게 공식 문서 URL 확인 요청.

## 멀티 에이전트 협업

이 프로젝트는 **5명의 가상 직원**(Claude Code subagents)이 협업하는 구조로 운영된다. 모든 에이전트는 한국어로 응답한다.

### 역할표

| 에이전트 | 역할 | 권한 | 모델 |
|---|---|---|---|
| **real-estate-expert** | 부동산 투자 상담 + 기능 아이디어 발굴 | 코드/PRD read-only | opus |
| **planner** | 기획자 (PM) — PRD 작성·관리 | `prd/**`만 RW, 코드 read-only | opus |
| **developer** | Next.js/Prisma 코드 작성·수정 | 소스코드 RW, PRD read-only | sonnet |
| **qa-engineer** | PRD 8섹션 기반 검증·재현·무결성 점검 | read-only + Bash | sonnet |
| **cto-reviewer** | 코드 게이트 + 최종 배포 결정 | read-only + Bash (git/배포) | opus |

### 단일 소스: `prd/` 디렉토리

기획 문서(PRD)는 `prd/NNN-<slug>/PRD.md`에 피쳐별로 보관되며, **planner만 작성/수정**한다. developer/qa-engineer/cto-reviewer는 모두 이 PRD를 참조해 작업한다. 변경 시 직전본은 `history/YYYY-MM-DD-*.md`로 자동 스냅샷. 자세한 규칙은 [prd/README.md](prd/README.md).

### 자동 라우팅 트리거 (키워드)

- "어디 살까 / 매수 타이밍 / 전세가율 / 포트폴리오" → **real-estate-expert**
- "기획해줘 / PRD 써줘 / 정리해줘" → **planner**
- "구현 / 추가 / 수정 / 개발" → **developer**
- "버그 / 에러 / 안 됨 / 이상함" → **qa-engineer**
- "리뷰 / 머지 가능 / 배포해도 돼?" → **cto-reviewer**

### 협업 워크플로

```
사용자 ── /consult ──> real-estate-expert (투자 상담 + 💡 기능 후보)
                          │
                          ▼
                       planner ── prd/NNN/PRD.md (draft → approved)
                          │
                          ▼ /feature NNN
                       developer ── PRD 기반 구현
                          │
                          ▼
                       qa-engineer ── PRD 8섹션 검증
                          │
                          ▼
                       cto-reviewer ── PRD ↔ 구현 + 점검 축 6개
                          │
                          ▼ PASS
                       🚢 최종 보고 + 배포 여부 질문 [1] 배포 / [2] 커밋만 / [3] 보류
```

### 슬래시 커맨드

- **`/consult <질문>`**: 부동산 투자 상담 진입점
- **`/prd <피쳐명 or NNN>`**: PRD 신규 작성 또는 업데이트
- **`/feature <피쳐명 or NNN>`**: dev → qa → CTO 전체 파이프라인 (PASS 시 배포 게이트)
- **`/bugfix <증상>`**: qa 재현 → dev 픽스 → CTO 게이트
- (기존) `/evaluate` 100점 루브릭 / `/update-docs` 본 문서 갱신

### ⚠️ 워크플로 강제 규칙 (MUST FOLLOW)

**아래 상황에서 절대 단독으로 코드를 수정하면 안 된다. 반드시 명시된 워크플로/스킬을 invoke한다.**

| 사용자 의도 | 필수 워크플로 | 건너뛰기 금지 단계 |
|---|---|---|
| 버그 보고 (에러 / 안 됨 / 이상함 / 타임아웃 / 500 / 에러메세지 포함) | `/bugfix` 또는 `bugfix` 스킬 | qa-engineer 재현 → developer 픽스 → **cto-reviewer 게이트** |
| 신규 기능 / 기능 변경 / 알고리즘 수정 | `/feature <NNN>` | planner(PRD) → developer → qa-engineer → **cto-reviewer 게이트** |
| 기획·요구사항 정리 | `/prd <피쳐명>` | planner 단독 |
| 부동산 투자 상담 | `/consult` | real-estate-expert |

**판단 기준 — 위 워크플로가 필요한지 결정하는 체크리스트:**

1. 사용자 메시지에 "에러", "안 됨", "이상함", "타임아웃", HTTP 상태코드(4xx/5xx), 스택트레이스, 에러 로그가 포함돼 있다 → **`/bugfix` 무조건 invoke**
2. 사용자가 "고쳐줘", "해결해줘", "수정해줘"라고 했고 변경 대상이 `app/`, `lib/`, `prisma/` 안의 로직이다 → **단독 수정 금지**, `/bugfix` 또는 `/feature` invoke
3. 변경 분량이 한 함수 / 한 라우트 이상이다 → **cto-reviewer 게이트 필수**

**예외 (단독 수정 허용):**

- `README.md`, `AGENTS.md`, `CLAUDE.md` 등 문서 파일만 수정
- 오타, 공백, 주석 수정 (로직 변화 없음)
- 사용자가 명시적으로 "리뷰 없이 바로 해", "QA 생략", "워크플로 스킵"이라고 말한 경우

**위반 시 사후 처리:**

워크플로를 건너뛰고 코드를 수정한 사실을 발견하면, **사용자에게 보고하지 않고 묻혀버리는 것이 가장 큰 위반**이다. 다음 순서로 즉시 회복:

1. 사용자에게 "워크플로 건너뛴 점 사과" 명시
2. 변경된 파일 목록을 qa-engineer에 검증 의뢰 (subagent 또는 general-purpose에 qa-engineer 페르소나 위임)
3. cto-reviewer 게이트 통과 후에야 배포 게이트(아래 규칙)로 진입

### 배포 게이트 규칙

`cto-reviewer`가 PASS를 판정하면 자동으로 `## 🚢 최종 보고` + 배포 여부 질문(1/2/3)을 출력한다. **사용자가 응답하기 전에는 `git push`나 배포 명령을 절대 실행하지 않는다**. `git push --force`, `--no-verify`, `main` 강제 푸시는 사용자 명시 요청 없이는 금지.
