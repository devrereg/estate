-- =============================================
-- Next-Step 다음 상승지 예측 시스템 - 테이블/컬럼 설명
-- =============================================

-- 1. Region: 수도권 지역 마스터
COMMENT ON TABLE "Region" IS '수도권 지역 마스터 (서울25구 + 경기31개 시/구 + 인천10개 구/군 = 총 66개)';
COMMENT ON COLUMN "Region"."id" IS '법정동 지역코드 (LAWD_CD 5자리, 예: 11680=강남구)';
COMMENT ON COLUMN "Region"."name" IS '지역명 (예: 강남구, 분당구, 연수구)';
COMMENT ON COLUMN "Region"."city" IS '시/도 구분 (서울 | 경기 | 인천)';
COMMENT ON COLUMN "Region"."fullLabel" IS '표시용 전체 라벨 (예: 서울 강남구, 경기 성남분당구)';
COMMENT ON COLUMN "Region"."tier" IS '급지 등급 (1=최상위/대장, 2=상위, 3=중위, 4=하위, NULL=미분류)';

-- 2. RegionAdjacency: 지역 인접 그래프
COMMENT ON TABLE "RegionAdjacency" IS '지역 간 인접 관계 그래프 (수요 이동 경로 매핑에 사용)';
COMMENT ON COLUMN "RegionAdjacency"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "RegionAdjacency"."fromRegionId" IS '출발 지역 코드 (FK → Region.id)';
COMMENT ON COLUMN "RegionAdjacency"."toRegionId" IS '도착 지역 코드 (FK → Region.id)';
COMMENT ON COLUMN "RegionAdjacency"."weight" IS '인접 가중치 (1.0=서울 내 직접 인접, 0.7~0.8=서울-경기 경계, 0.5=2차 인접)';

-- 3. BlueChipApartment: 대장아파트 목록
COMMENT ON TABLE "BlueChipApartment" IS '서울 대장아파트 22개 (Phase 1 트리거 감지 대상 = 시장 선행 지표)';
COMMENT ON COLUMN "BlueChipApartment"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "BlueChipApartment"."name" IS '아파트명 (예: 래미안원베일리, 트리마제)';
COMMENT ON COLUMN "BlueChipApartment"."regionId" IS '소재 지역 코드 (FK → Region.id)';
COMMENT ON COLUMN "BlueChipApartment"."dong" IS '법정동명 (예: 반포동, 성수동)';
COMMENT ON COLUMN "BlueChipApartment"."district" IS '구+동 표시명 (예: 서초구 반포동)';

-- 4. Trade: 아파트 매매 실거래 데이터
COMMENT ON TABLE "Trade" IS '국토교통부 아파트 매매 실거래 데이터 캐시 (API 수집 → DB 저장)';
COMMENT ON COLUMN "Trade"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "Trade"."regionId" IS '거래 지역 코드 (FK → Region.id)';
COMMENT ON COLUMN "Trade"."dealYmd" IS '계약년월 6자리 (예: 202603)';
COMMENT ON COLUMN "Trade"."aptName" IS '아파트명 (API 원본값)';
COMMENT ON COLUMN "Trade"."dealAmount" IS '거래금액 (만원 단위, 예: 180000 = 18억)';
COMMENT ON COLUMN "Trade"."excArea" IS '전용면적 (㎡)';
COMMENT ON COLUMN "Trade"."floor" IS '거래 층수';
COMMENT ON COLUMN "Trade"."dealDay" IS '계약일 (일, 1~31)';
COMMENT ON COLUMN "Trade"."buildYear" IS '건축년도';
COMMENT ON COLUMN "Trade"."collectedAt" IS 'DB 수집 시각';

-- 5. Rent: 아파트 전월세 실거래 데이터
COMMENT ON TABLE "Rent" IS '국토교통부 아파트 전월세 실거래 데이터 캐시 (전세가율 계산에 핵심)';
COMMENT ON COLUMN "Rent"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "Rent"."regionId" IS '거래 지역 코드 (FK → Region.id)';
COMMENT ON COLUMN "Rent"."dealYmd" IS '계약년월 6자리 (예: 202603)';
COMMENT ON COLUMN "Rent"."aptName" IS '아파트명 (API 원본값)';
COMMENT ON COLUMN "Rent"."rentType" IS '임대 유형 (전세 | 월세)';
COMMENT ON COLUMN "Rent"."deposit" IS '보증금 (만원 단위)';
COMMENT ON COLUMN "Rent"."monthlyRent" IS '월세 (만원 단위, 전세일 경우 0)';
COMMENT ON COLUMN "Rent"."excArea" IS '전용면적 (㎡)';
COMMENT ON COLUMN "Rent"."floor" IS '거래 층수';
COMMENT ON COLUMN "Rent"."dealDay" IS '계약일 (일, 1~31)';
COMMENT ON COLUMN "Rent"."collectedAt" IS 'DB 수집 시각';

-- 6. MonthlyRegionStat: 월별 지역 통계 (집계 테이블)
COMMENT ON TABLE "MonthlyRegionStat" IS '월별 지역 통계 집계 (Trade/Rent 기반 계산, 스코어링 입력값)';
COMMENT ON COLUMN "MonthlyRegionStat"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "MonthlyRegionStat"."regionId" IS '지역 코드 (FK → Region.id)';
COMMENT ON COLUMN "MonthlyRegionStat"."dealYmd" IS '통계 대상 년월 6자리 (예: 202603)';
COMMENT ON COLUMN "MonthlyRegionStat"."tradeCount" IS '해당 월 매매 거래 건수';
COMMENT ON COLUMN "MonthlyRegionStat"."avgTradePrice" IS '평균 매매가 (만원)';
COMMENT ON COLUMN "MonthlyRegionStat"."maxTradePrice" IS '최고 매매가 (만원)';
COMMENT ON COLUMN "MonthlyRegionStat"."rentCount" IS '해당 월 전세 거래 건수';
COMMENT ON COLUMN "MonthlyRegionStat"."avgRentDeposit" IS '평균 전세 보증금 (만원)';
COMMENT ON COLUMN "MonthlyRegionStat"."leaseToPrice" IS '전세가율 (0.0~1.0, 예: 0.65 = 전세가가 매매가의 65%)';
COMMENT ON COLUMN "MonthlyRegionStat"."computedAt" IS '통계 계산 시각';

-- 7. TriggerEvent: Phase 1 상승 신호 감지 결과
COMMENT ON TABLE "TriggerEvent" IS 'Phase 1 결과: 대장아파트 상승 신호 이벤트 (전고점 돌파 또는 급등 감지)';
COMMENT ON COLUMN "TriggerEvent"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "TriggerEvent"."regionId" IS '트리거 발생 지역 (FK → Region.id)';
COMMENT ON COLUMN "TriggerEvent"."apartmentId" IS '트리거 발생 아파트 (FK → BlueChipApartment.id, NULL 가능)';
COMMENT ON COLUMN "TriggerEvent"."triggerType" IS '신호 유형 (ATH_90=전고점 90% 도달, PRICE_JUMP_5PCT=직전 대비 5%+ 상승)';
COMMENT ON COLUMN "TriggerEvent"."triggerValue" IS '신호 수치 (ATH_90: 0.93=전고점의 93%, PRICE_JUMP_5PCT: 0.07=7% 상승)';
COMMENT ON COLUMN "TriggerEvent"."referencePrice" IS '기준가 (만원, ATH_90=전고점가, PRICE_JUMP_5PCT=직전 거래가)';
COMMENT ON COLUMN "TriggerEvent"."currentPrice" IS '현재 거래가 (만원)';
COMMENT ON COLUMN "TriggerEvent"."detectedAt" IS '신호 감지 시각';

-- 8. PredictionResult: Phase 3 최종 예측 결과
COMMENT ON TABLE "PredictionResult" IS 'Phase 3 결과: 다음 상승 예측 지역별 종합 점수 (100점 만점)';
COMMENT ON COLUMN "PredictionResult"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "PredictionResult"."regionId" IS '예측 대상 지역 (FK → Region.id)';
COMMENT ON COLUMN "PredictionResult"."triggerRegionId" IS '이 예측을 유발한 트리거 지역 코드';
COMMENT ON COLUMN "PredictionResult"."totalScore" IS '종합 점수 (0~100, leaseScore+volumeScore+proximityScore+priceGapScore)';
COMMENT ON COLUMN "PredictionResult"."leaseScore" IS '전세가율 점수 (0~30, 전세가율 60~70%↑ = 고점수, 상승 추세 보너스)';
COMMENT ON COLUMN "PredictionResult"."volumeScore" IS '거래량 점수 (0~30, 최근3개월 거래량이 3년 평균의 1.5배↑ = 고점수)';
COMMENT ON COLUMN "PredictionResult"."proximityScore" IS '인접성 점수 (0~20, 1차 인접=20점, 2차 인접=10점, 가중치 적용)';
COMMENT ON COLUMN "PredictionResult"."priceGapScore" IS '가격차 점수 (0~20, 트리거 지역 대비 저평가 40%↑ = 고점수)';
COMMENT ON COLUMN "PredictionResult"."reasoning" IS 'JSON: 점수 산출 근거 상세 (avgTrade, leaseRatio, volumeRatio 등)';
COMMENT ON COLUMN "PredictionResult"."computedAt" IS '예측 실행 시각';

-- 9. CollectionJob: 데이터 수집 작업 추적
COMMENT ON TABLE "CollectionJob" IS 'API 데이터 수집 배치 작업 추적 (진행률 모니터링)';
COMMENT ON COLUMN "CollectionJob"."id" IS '자동 증가 PK';
COMMENT ON COLUMN "CollectionJob"."jobType" IS '수집 유형 (TRADE=매매만, RENT=전월세만, FULL=전체)';
COMMENT ON COLUMN "CollectionJob"."status" IS '작업 상태 (PENDING → RUNNING → COMPLETED | FAILED)';
COMMENT ON COLUMN "CollectionJob"."totalTasks" IS '전체 태스크 수 (지역수 × 월수 × 유형수)';
COMMENT ON COLUMN "CollectionJob"."completed" IS '완료된 태스크 수';
COMMENT ON COLUMN "CollectionJob"."failed" IS '실패한 태스크 수';
COMMENT ON COLUMN "CollectionJob"."startedAt" IS '수집 시작 시각';
COMMENT ON COLUMN "CollectionJob"."finishedAt" IS '수집 완료 시각';
COMMENT ON COLUMN "CollectionJob"."errorLog" IS '에러 로그 (실패 시)';
COMMENT ON COLUMN "CollectionJob"."createdAt" IS '작업 생성 시각';
