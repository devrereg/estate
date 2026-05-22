# PRD (Product Requirements Document) 디렉토리

이 디렉토리는 Estate 플랫폼의 **기획 문서(PRD)**를 피쳐별로 버전 관리하는 단일 소스(single source of truth)입니다.

`developer`, `qa-engineer`, `cto-reviewer` 에이전트는 모두 이 디렉토리의 PRD를 참조해서 작업합니다.

## 디렉토리 구조

```
prd/
  README.md                              ← (이 파일) 인덱스 + 규칙
  _template.md                           ← 표준 PRD 템플릿
  001-investment-portfolio-tracker/      ← 피쳐별 디렉토리 (3자리 번호-슬러그)
    PRD.md                               ← 현재 유효한 PRD (단일 소스)
    history/
      2026-05-22-initial.md              ← 작성/변경 시점별 스냅샷
      2026-05-25-scope-cut.md
    decisions.md                         ← 채택/기각 결정 로그
  002-similar-region-recommender/
    PRD.md
    history/...
```

## 작성/변경 규칙

1. **1피쳐 = 1디렉토리**. 번호는 단조 증가 (`001`, `002`, ...).
2. `PRD.md`는 **항상 최신본**. developer/qa/CTO가 참조하는 단일 소스.
3. **변경 시**: 기존 `PRD.md`를 `history/YYYY-MM-DD-<slug>.md`로 복사한 뒤 본문 수정.
4. **변경 사유**: `decisions.md`에 "변경 사유 + 영향 범위" 1~3줄 추가.
5. **상태(status) 라이프사이클**: `draft → approved → in-development → shipped → deprecated`
6. **작성/변경 권한**: `planner` 에이전트만 가능. 다른 에이전트는 read-only.

## PRD 작성 시 원칙

- **모호함은 가정으로 명시**: 추측으로 본문을 채우지 말고 `9. 오픈 이슈`에 적는다.
- **비목표(Non-Goals) 필수**: 이번 스코프에 포함되지 않는 것을 명시해 스코프 크리프 방지.
- **검증 가능한 문장**: FR/NFR/QA 체크리스트는 PASS/FAIL을 판정할 수 있게 작성.
- **번호 매김**: FR-1, FR-2, ... 식으로 번호를 매겨 developer가 코드 주석/커밋에서 참조하도록.

## PRD 인덱스

| ID | 제목 | 상태 | 생성일 | 최종 업데이트 |
|---|---|---|---|---|
| _(아직 PRD 없음)_ | | | | |

신규 PRD 작성 시 위 표에 한 줄 추가하세요.

## 관련 에이전트/커맨드

- **planner** (`.claude/agents/planner.md`): 이 디렉토리의 유일한 작성자
- **`/consult <질문>`**: real-estate-expert 상담 → 기능 후보 발굴
- **`/prd <피쳐명 or NNN>`**: planner 호출 (신규 작성 or 업데이트)
- **`/feature <피쳐명 or NNN>`**: PRD를 단일 소스로 삼아 dev → qa → CTO 파이프라인 실행
