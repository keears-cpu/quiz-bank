# 최종 문제은행 데이터 마감 리포트

- 작성일: 2026-06-27
- 기준 폴더: `/Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all`
- 최종 JSON: `/Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/all-question-bank.json`
- 앱 내장 데이터: `/Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/app/data.js`
- 문항 CSV: `/Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/analysis/all-question-bank.complete.csv`
- 시험지 목록 CSV: `/Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/analysis/exam-manifest-final-20260627.csv`

## 최종 카운트

| 항목 | 수량 |
|---|---:|
| 시험지 | 278 |
| 문항 | 13,139 |
| JSON-앱 데이터 동기화 | OK |
| 문항-시험지 연결 누락 | 0 |
| 정답 누락 | 0 |
| 보고서용 5축 누락 | 0 |
| 보고서 eligibility 플래그 누락 | 0 |

## 카테고리별 시험지

| 카테고리 | 시험지 수 |
|---|---:|
| Grammar | 102 |
| Phonics | 10 |
| Reading | 85 |
| Speaking | 6 |
| Writing | 75 |

## 시험 종류별 시험지

| 종류 | 시험지 수 |
|---|---:|
| final | 85 |
| midterm | 55 |
| level | 4 |
| unit | 14 |
| practice | 118 |
| placement | 1 |
| other | 1 |

## 보고서용 5축 상태

기존 상세 분류인 `domainKey`, `domainLabel`은 보존하고, 성적표/오각형 그래프용으로 별도 필드 `reportAxisKey`, `reportAxisLabel`, `reportAxisSet`, `reportAxisSource`를 추가했다.

| 그래프 모드 | 시험지 수 | 의미 |
|---|---:|---|
| balanced_radar | 140 | 5축 그래프 표시 적합 |
| focused_axis | 138 | 문항 특성상 일부 축 집중형, 그래프는 표시하되 해석은 집중형으로 처리 |

주요 보고서 축 분포 상위 항목:

| 축 | 문항 수 |
|---|---:|
| 문장전환/쓰기 | 2,816 |
| 문법/해석 | 1,730 |
| 동사/시제 | 1,320 |
| 문장영작 | 1,286 |
| 어휘 의미 | 1,097 |
| 철자/스펠링 | 1,060 |
| 형태/품사 | 1,008 |
| 문장배열 | 801 |
| 추론/어법 | 364 |
| 세부내용 | 348 |

## CSV 산출물 검수

| 파일 | 행 수 | 상태 |
|---|---:|---|
| `all-question-bank.complete.csv` | 13,139문항 + header | OK |
| `all-question-bank.complete-20260627.csv` | 13,139문항 + header | OK |
| `exam-manifest-final-20260627.csv` | 278시험지 + header | OK |
| `balanced-report-axis-by-exam-20260627.csv` | 278시험지 + header | OK |

CSV는 셀 내부 줄바꿈을 literal `\n`으로 escape해서 Google Sheets/Excel에서 물리 행이 깨지지 않도록 처리했다.

## 현재 보류

정답키가 없어 병합하지 않은 파일 2개만 남아 있다. 이 둘은 원문은 파싱 가능하지만 검증 가능한 answer key가 없어 최종 데이터에 넣지 않았다.

| 파일 | 상태 |
|---|---|
| `Reading/The Clip Reading/7A/CLIP7A_Reading_WT_U5.doc` | 정답 원천 필요 |
| `Reading/The Clip Reading/8A/CLIP8A_U1_RW_DT_통합.doc` | 정답 원천 필요 |

상세 보류 보고서:
`/Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/analysis/final-residual-answer-hold-report-20260627.md`

## 재생성 명령

최종 JSON을 수정한 뒤에는 아래 순서로 다시 실행한다.

```bash
node /Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/analysis/apply-balanced-report-axis-20260627.mjs
node /Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/analysis/export-final-bank-assets-20260627.mjs
node --check /Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/app/data.js
node --check /Users/essenz/Documents/Playground/question-bank-all/midterm/question-bank-all/app/app.js
```

## 다음 작업 기준

- 앱은 `app/data.js`의 `window.QUESTION_BANK_DATA`를 읽는다.
- 외부 분석/시트 업로드는 `analysis/all-question-bank.complete.csv`를 기준으로 한다.
- 시험지 목록/개수 관리는 `analysis/exam-manifest-final-20260627.csv`를 기준으로 한다.
- 새 시험지 추가 시 `all-question-bank.json`에 병합한 뒤 `app/data.js`와 CSV를 반드시 재생성한다.
