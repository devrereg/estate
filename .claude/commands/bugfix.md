버그 신고를 받아 **qa-engineer 재현 → developer 픽스 → cto-reviewer 게이트** 순서로 처리한다. cto-reviewer가 PASS하면 최종 보고와 배포 여부 질문까지 진행.

## 절차

1. **qa-engineer 호출 (재현 + 원인 가설)**:
   - 사용자 신고 (`$ARGUMENTS`)를 그대로 전달
   - 관련 PRD가 식별 가능하면 (예: 영향 라우트가 prd/NNN의 FR에 해당) PRD 8섹션도 함께 참조
   - 출력: 재현 절차 / 기대 / 실제 / 영향 범위 + 원인 가설 + 데이터 무결성 점검

2. **PRD 확장 필요 여부 판단**:
   - 발견된 케이스가 PRD에 없던 시나리오면 → planner 호출해 해당 PRD의 QA 체크리스트 확장
   - 단순 회귀 버그면 → 곧장 developer로

3. **developer 호출 (픽스)**:
   - qa-engineer의 재현 절차 + 원인 가설 전달
   - PRD의 FR 번호와 매핑된 픽스인지 명시
   - 출력: 변경 파일 목록 + 픽스 설명 + 빌드 검증

4. **qa-engineer 재검증** (회귀 방지):
   - 원래 신고 케이스 + 인접한 동작 영역 확인
   - 데이터 무결성 점검 우선순위 4항목 재확인 (DB 수정이 있었다면)

5. **cto-reviewer 호출 (게이트)**:
   - PRD FR/NFR ↔ 픽스 일치 + 점검 축 6개
   - 판정: PASS / CONDITIONAL / FAIL
   - FAIL → developer 재작업
   - PASS → **자동으로 최종 보고 + 배포 여부 질문 단계로 진입**

6. **최종 보고 & 배포 게이트** (cto-reviewer가 PASS 시 자동):
   - 사용자에게 `[1] 배포 진행 / [2] 커밋만 / [3] 보류` 선택 요청
   - 핫픽스 성격이면 커밋 메시지 `fix:` 프리픽스 권장

## 사용 예시

```
/bugfix /predict 페이지에서 마커 클릭 시 팝업이 안 뜸
/bugfix 수집 후 강동구 Trade 레코드가 비어있음
/bugfix MonthlyRegionStat의 2025-12 데이터가 누락됨
```

## 분기 다이어그램

```
/bugfix
  └─ qa-engineer (재현 + 원인 가설 + 무결성 점검)
       ├─ 신규 케이스 → planner (QA 체크리스트 확장)
       └─ 회귀 버그
            └─ developer (픽스)
                 └─ qa-engineer (재검증 + 회귀 점검)
                      └─ cto-reviewer (게이트)
                           ├─ FAIL → developer 재작업
                           └─ PASS → 🚢 최종 보고 + 배포 게이트
                                ├─ [1] 배포 (fix: 커밋)
                                ├─ [2] 커밋만
                                └─ [3] 보류
```

## 주의 사항

- 데이터 무결성 이슈는 발견 즉시 보고. 영향 범위가 광범위하면 사용자에게 "수집/시드 재실행 필요 여부" 확인
- 핫픽스라 하더라도 `git push --force` / `--no-verify`는 사용자 명시 요청 없으면 금지
- 같은 버그가 3회 이상 재발하면 PRD나 아키텍처에 구조적 문제가 있을 가능성 — 사용자에게 alert
