---
id: NNN
title: <한 줄 요약>
status: draft
owner: planner
created: YYYY-MM-DD
updated: YYYY-MM-DD
source_consult: <real-estate-expert 상담 세션 요약 또는 null>
---

# <피쳐 이름>

## 1. 배경 / 문제
- 이 기능이 왜 필요한가? (사용자 문제, 시장 기회, 또는 기술 부채)
- 현재 어떤 우회 방식으로 처리되고 있는가?

## 2. 목표 / 비목표
**목표 (Goals)**
- G1. ...
- G2. ...

**비목표 (Non-Goals)** — 이번 스코프에 포함되지 않는 것을 명시해 스코프 크리프 방지
- NG1. ...
- NG2. ...

## 3. 사용자 스토리
- US-1. <역할>로서 <목적>을 위해 <행동>을 하고 싶다.
- US-2. ...

## 4. 기능 요구사항 (FR)
검증 가능한 단위로 번호 부여. developer가 코드 주석/커밋에서 이 번호를 참조.
- FR-1. <명확한 동작 명세>
- FR-2. ...

## 5. 비기능 요구사항 (NFR)
- NFR-1. 성능: (예) `/api/predict/score` 응답 5초 이내
- NFR-2. 데이터: (예) (regionId, dealYmd) 중복 0건 보장
- NFR-3. 보안: (예) API 키 클라이언트 번들에 포함 금지
- NFR-4. 호환성: (예) Next.js 16 App Router 컨벤션 준수

## 6. 성공 지표 (Metrics)
이 기능이 잘 동작하는지 어떻게 측정할 것인가?
- M1. ...
- M2. ...

## 7. 기술 노트
- 영향받는 파일/모듈: `app/...`, `lib/...`
- DB 스키마 변경: (있다면) Prisma 모델 변경 + `npx prisma db push` 필요
- 외부 API 의존: (있다면) 공공데이터포털 엔드포인트
- 재사용할 기존 유틸: [lib/utils.js](../../lib/utils.js), [lib/constants/](../../lib/constants/), [lib/predict/](../../lib/predict/)

## 8. QA 체크리스트
qa-engineer가 PASS/FAIL/N/A로 한 줄씩 판정. 검증 가능한 문장으로 작성.
- [ ] QA-1. <검증 가능한 동작>
- [ ] QA-2. 데이터 무결성: (regionId, dealYmd) 중복 없음
- [ ] QA-3. 에러/빈 데이터 상태 UI 렌더링
- [ ] QA-4. 다크 테마 일관성 유지
- [ ] QA-5. `npm run build` 성공

## 9. 오픈 이슈
확정되지 않은 가정·결정 대기 사항. 추측으로 채우지 말고 여기 명시.
- OI-1. ...
