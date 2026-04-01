@AGENTS.md

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
