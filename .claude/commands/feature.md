PRD를 단일 소스로 삼아 **developer → qa-engineer → cto-reviewer** 순서로 구현 파이프라인을 실행한다. cto-reviewer가 PASS하면 최종 보고와 배포 여부 질문까지 진행.

## 전제 조건

- `prd/NNN-<slug>/PRD.md`가 존재하고 `status: approved` 또는 `in-development` 상태여야 한다
- 없으면 먼저 `/prd <피쳐명>`으로 PRD를 작성하고 사용자 승인을 받아야 한다

## 절차

1. **PRD 식별**: `$ARGUMENTS`를 분석해 대상 PRD 결정
   - `001` 같은 ID 또는 슬러그
   - 자연어 설명이면 [prd/README.md](../../prd/README.md) 인덱스에서 가장 가까운 PRD 매칭
   - 매칭 실패 시 → "PRD를 먼저 작성하시겠습니까? `/prd <피쳐명>`" 안내 후 중단

2. **PRD 사전 검토**: `prd/NNN-*/PRD.md`를 읽고 `status` 확인
   - `draft` → 사용자에게 "approved로 승격하시겠습니까?" 묻고, 동의하면 planner 호출해 상태 갱신
   - `approved` / `in-development` → 진행
   - `shipped` / `deprecated` → 사용자에게 확인 요청

3. **developer 호출**: PRD 경로를 명시적으로 전달
   - "[prd/NNN-<slug>/PRD.md](../../prd/NNN-<slug>/PRD.md)를 참조해 FR-1 ~ FR-N을 구현해줘"
   - developer는 PRD를 읽고 코드 작성 + 변경 파일 목록 + FR 매핑 표 출력

4. **qa-engineer 호출**: PRD `8. QA 체크리스트`로 검증
   - QA-1 ~ QA-N PASS/FAIL/N/A 판정 + 발견 이슈 보고
   - FAIL 항목 있으면 → developer로 돌아가 재작업 (사용자에게 보고 후 진행)

5. **cto-reviewer 호출**: PRD FR/NFR ↔ 구현 일치 + 점검 축 6개
   - 판정: PASS / CONDITIONAL / FAIL
   - FAIL → developer로 돌아가 패치
   - CONDITIONAL → 사용자에게 머지 여부 묻기
   - PASS → **자동으로 최종 보고 + 배포 여부 질문 단계로 진입**

6. **최종 보고 & 배포 게이트** (cto-reviewer가 PASS 시 자동):
   - `## 🚢 최종 보고` 출력
   - 사용자에게 `[1] 배포 진행 / [2] 커밋만 / [3] 보류` 선택 요청
   - **사용자 응답 받기 전까지 git push·배포 명령 절대 미실행**
   - [1] → 메시지 초안 확인 후 `git add <파일들>` + `git commit` + `git push`
   - [2] → 커밋까지만
   - [3] → 보류 후 종료

7. **(옵션)** PASS + 배포 완료 후 사용자에게 `/update-docs` 호출 제안 (AGENTS.md 갱신)

## 사용 예시

```
/feature 001
/feature portfolio-tracker
/feature 단지별 전세가율 차트          # 인덱스에서 매칭
```

## 분기 다이어그램

```
/feature
  └─ PRD 확인 (없으면 /prd 안내 후 중단)
       └─ developer (구현 + FR 매핑)
            └─ qa-engineer (PRD 8섹션 검증)
                 ├─ FAIL → developer 재작업
                 └─ PASS
                      └─ cto-reviewer (PRD FR/NFR + 점검 축 6개)
                           ├─ FAIL → developer 재작업
                           ├─ CONDITIONAL → 사용자 확인
                           └─ PASS → 🚢 최종 보고 + 배포 게이트
                                ├─ [1] 배포 진행
                                ├─ [2] 커밋만
                                └─ [3] 보류
```

## 주의 사항

- 각 단계 결과는 사용자에게 보고하며 진행 — 단계 사이에 사용자 개입 여지 보장
- FAIL 후 재작업 횟수가 3회 이상이면 사용자에게 "PRD를 재검토하시겠습니까?" 묻기 (스코프/요구사항 문제 가능성)
- 배포는 **반드시** cto-reviewer의 PASS 판정 + 사용자 명시 동의 후에만
