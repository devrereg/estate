# Next-Step: 부동산 수요 전이 기반 가격 상승 예측 시스템

> 수도권(서울/경기/인천) 대장아파트의 상승 신호를 감지하고, 인접 지역으로의 수요 이동 경로를 분석하여 **다음 상승 지역**을 예측합니다.

## 핵심 아이디어

부동산 시장에서 가격 상승은 동시다발적으로 일어나지 않습니다. 일반적으로 **대장아파트 → 인접 지역 → 차상위 지역** 순으로 수요가 전이됩니다. Next-Step은 이 패턴을 3단계 파이프라인으로 정량화합니다.

1. **Phase 1 — 트리거 감지**: 대장아파트 22곳에서 전고점 근접(ATH 90%) 또는 직전 거래 대비 5%+ 급등 신호 포착
2. **Phase 2 — 수요 이동 매핑**: 트리거 지역의 1차/2차 인접 지역 중 가격이 낮고 상승 전 수준과 유사한 후보 선별
3. **Phase 3 — 스코어링**: 전세가율(30) · 거래량(30) · 인접성(20) · 가격차(20), 100점 만점

## 기술 스택

| 영역 | 사용 기술 |
|------|----------|
| Framework | Next.js 16.2.1 (App Router) + React 19.2.4 |
| Database | PostgreSQL 16 (Docker) + Prisma 7.6.0 (`@prisma/adapter-pg`) |
| Charts | Recharts 3.8.1 |
| Map | Leaflet + react-leaflet (SSR 비활성화) |
| 데이터 소스 | 공공데이터포털 부동산 실거래가 API (XML) |

## 빠른 시작

### 사전 요구사항

- Node.js 20+
- Docker (PostgreSQL 컨테이너용)
- 공공데이터포털 [부동산 실거래가 API](https://www.data.go.kr/) 인증키

### 설치

```bash
# 1. 저장소 클론
git clone <repo-url>
cd estate-project

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cat > .env.local <<EOF
DATABASE_URL="postgresql://estate:estate_dev@localhost:5433/estate"
DATA_GO_KR_API_KEY="공공데이터포털에서 발급받은 Decoding 키"
EOF

# 4. PostgreSQL 컨테이너 기동 (포트 5433)
docker compose up -d

# 5. DB 스키마 + 시드 데이터 적재 (70개 지역, 162개 인접관계, 22개 대장아파트)
npx prisma db push
npx prisma db seed
npx prisma generate

# 6. 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기.

## 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 부동산 API 탐색기 — 34개 공공데이터 엔드포인트 호출 UI |
| `/trends` | 대장아파트 시세 트렌드 차트 (기간 선택) |
| `/predict` | 예측 대시보드 — 트리거 + 지도 + 순위표 + 수요 흐름도 |

## 예측 파이프라인 상세

### Phase 1: 트리거 감지 ([lib/predict/triggerDetection.js](lib/predict/triggerDetection.js))

대장아파트 22곳을 모니터링하며 다음 두 조건을 검사합니다.

- **`ATH_90`** — 최근 3개월 최고가가 전고점의 90% 이상
- **`PRICE_JUMP_5PCT`** — 직전 거래 대비 5% 이상 상승

### Phase 2: 수요 이동 매핑 ([lib/predict/demandMigration.js](lib/predict/demandMigration.js))

- 인접 그래프(`RegionAdjacency`)에서 1차(distance=1), 2차(distance=2) 후보 탐색
- 트리거 지역보다 낮은 가격대 + 상승 전 가격 수준과 유사한 지역으로 필터링
- 서울–경기 경계 교차는 가중치 0.7~0.8 적용

### Phase 3: 스코어링 ([lib/predict/scoring.js](lib/predict/scoring.js))

| 지표 | 배점 | 산식 |
|------|-----:|------|
| 전세가율 | 30 | 전세/매매 비율 0.5→0.7 스케일 + 상승 추세 보너스 |
| 거래량 | 30 | 최근 3개월 / 3년 평균 비율 1.0→2.0 스케일 |
| 인접성 | 20 | 1차 인접=20, 2차=10, 경계 가중치 적용 |
| 가격차 | 20 | 트리거 대비 저평가 0.1→0.5 스케일 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/proxy?...` | 공공데이터 API 프록시 (34개 엔드포인트) |
| `POST` | `/api/predict/collect` | 매매/전월세 데이터 수집 (DB 캐시 지원) |
| `GET` | `/api/predict/trigger` | Phase 1 트리거만 실행 |
| `GET` | `/api/predict/score` | Phase 1→2→3 전체 파이프라인 |
| `GET` | `/api/predict/results` | 저장된 예측 결과 조회 |
| `GET` | `/api/predict/status` | 수집 작업 상태/통계 |

## DB 스키마 (9개 테이블)

- `Region` — 수도권 70개 지역 (LAWD_CD, 급지 정보)
- `RegionAdjacency` — 지역 인접 그래프 (가중치 포함)
- `BlueChipApartment` — 대장아파트 22곳
- `Trade` / `Rent` — 매매·전월세 실거래 캐시
- `MonthlyRegionStat` — 월별 집계 (평균가, 전세가율 등)
- `TriggerEvent` — Phase 1 결과 로그
- `PredictionResult` — Phase 3 최종 결과 (4개 세부 점수 + reasoning JSON)
- `CollectionJob` — 수집 작업 추적

자세한 컬럼 설명은 [prisma/schema.prisma](prisma/schema.prisma) 및 [prisma/comments.sql](prisma/comments.sql) 참고.

## 데이터 수집 최적화

- 동일 `(regionId, dealYmd)` 조합은 DB 캐시 사용, API 호출 스킵
- 5건씩 배치 + 200ms 딜레이로 공공데이터 API 속도 제한 회피
- `numOfRows=9999`로 페이지네이션 회피

## 디렉터리 구조

```
app/
  api/proxy/route.js              # 공공데이터 API 프록시
  api/predict/{collect,trigger,score,results,status}/route.js
  predict/                        # 예측 대시보드 + Leaflet 지도
  trends/                         # 대장아파트 시세 트렌드
  components/                     # TopNav, BlueChipTrends
lib/
  apiClient.js                    # 서버사이드 API 호출 + XML/JSON 파싱
  db.js                           # Prisma 싱글턴 (PrismaPg 어댑터)
  utils.js                        # formatPrice, batchProcess 등
  constants/                      # 지역코드, 인접그래프, 대장아파트, 좌표
  predict/                        # 3-Phase 알고리즘
prisma/
  schema.prisma                   # 9개 테이블 정의
  seed.ts                         # 시드 스크립트
public/data/
  seoul-gu.geojson                # 서울 25개 구 경계
```

## 스크립트

```bash
npm run dev      # 개발 서버 (Turbopack)
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 실행
npm run lint     # ESLint

npx prisma db push      # 스키마 동기화
npx prisma db seed      # 시드 데이터 적재
npx prisma studio       # DB GUI
```

## 라이선스

이 프로젝트는 공공데이터포털의 부동산 실거래가 정보를 활용합니다. 데이터 사용에 관한 자세한 약관은 [공공데이터포털](https://www.data.go.kr/)을 참고하세요.
