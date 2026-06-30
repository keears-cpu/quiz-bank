# Quiz Bank

최종 문제은행 앱 배포용 저장소입니다.

## 포함 파일

- `app/index.html`: 정적 앱 진입점
- `app/app.js`: 시험지 선택, 문항 생성, Preview/Solve/원본PDF 전환, 채점 UI
- `app/styles.css`: 앱 및 인쇄 레이아웃 스타일
- `safe-question-bank.json`: 앱 로딩용 최종 안전 데이터
- `vercel.json`: 정적 배포 라우팅 설정

## 데이터 요약

- 시험지 수: 278
- 문항 수: 13,139
- 데이터 구조: `meta`, `exams`, `questions`
- 기준 데이터: `safe-question-bank.json`
- prompt 비어 있음: 44문항
- Solve fallback 가능: 44문항 모두 `sectionTitle`로 표시
- 보고서 축 동기화: `reportAxisJsonSync20260630`
- 보고서 CSV 기준 축 동기화 문항: 5,155문항
- 그래프 모드: `balanced_radar` 162개, `focused_axis` 116개

## 배포

- GitHub: `keears-cpu/quiz-bank`
- Vercel: `question-bank-all`
- Production URL: https://question-bank-all.vercel.app/app/index.html

## 사용

로컬에서는 정적 서버로 실행합니다.

```bash
python3 -m http.server 8765
```

브라우저에서 `http://localhost:8765/app/index.html`을 엽니다.
