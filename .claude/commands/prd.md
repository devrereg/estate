PRD 신규 작성 또는 기존 PRD 업데이트. planner 에이전트를 호출해 `prd/` 디렉토리를 관리한다.

## 절차

1. **planner 호출**: 사용자 인자(`$ARGUMENTS`)를 분석해 다음 중 하나로 분기
   - **신규 작성**: 피쳐명 또는 자연어 설명 → planner가 다음 번호 결정 + 디렉토리 생성 + PRD 초안
   - **기존 업데이트**: `001`, `002` 같은 PRD ID 또는 슬러그 → planner가 직전본 history 스냅샷 + 본문 수정 + decisions.md 추가

2. **planner 결과 수신**: `## 기획 결과` + `## 작성/변경 요약` + `## 다음 액션 제안` 형식

3. **오픈 이슈 확인**: PRD에 오픈 이슈가 있으면 사용자에게 결정 요청 항목 제시

## 사용 예시

### 신규 작성
```
/prd 투자 포트폴리오 트래커
/prd 유사 지역 추천 알림
/prd 단지별 전세가율 차트
```

### 기존 업데이트
```
/prd 001                        # ID로 지정
/prd portfolio-tracker          # 슬러그로 지정
/prd 001 status를 approved로    # 변경 의도까지 명시
```

## 출력 형식

planner의 출력 그대로. 핵심 정보:
- 생성/수정된 PRD 경로
- 변경 사항 요약 (FR/NFR/QA 항목 수)
- 다음 액션 제안 (`/feature NNN`으로 구현 진입 또는 오픈 이슈 결정 요청)

## 주의 사항

- planner만 `prd/` 디렉토리에 write 권한
- 신규 PRD는 `status: draft`로 시작. 사용자 승인 후 `approved`로 변경 (다시 `/prd <NNN> approved` 호출)
- 작성된 PRD는 [prd/README.md](../../prd/README.md) 인덱스에 자동 등록되어야 함
- PRD 변경 시 직전본은 `history/YYYY-MM-DD-<slug>.md`로 반드시 보존
