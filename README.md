# Unified Exam Question Bank

이 폴더는 기존 앱 데이터와 분리된 `all` 문제은행 산출물입니다.

## 포함 파일

- `source-snapshot/exams.snapshot.json`: 원본 `data/exams.json` 복사본
- `all-question-bank.json`: 이미지 참조와 구조 보존용 메인 데이터
- `all-question-bank.csv`: 검색/필터링용 평면 데이터
- `all-question-bank.qa.json`: coverage와 검수 우선순위 요약
- `assets/exam-previews/`: 시험지 preview 이미지 복사본
- `assets/question-crops/`: 문항 단위 자동 crop 이미지
- `app/`: 시험지 복수선택 + 랜덤퀴즈 + 오답체크용 별도 앱

## 요약

- 시험지 수: 80
- 문항 수: 1840
- prompt 비어 있음: 133
- 이미지 참조 필요 문항: 187
- 빈칸/밑줄 포함 문항: 453

## 카테고리

- Phonics: 6개 시험지
- Reading: 52개 시험지
- Writing: 22개 시험지

## 사용 권장

- 문제은행 원본 기준은 `all-question-bank.json`을 사용
- 빠른 검색/정렬은 `all-question-bank.csv`을 사용
- prompt가 비어 있는 문항은 `imageReferences`와 `sectionMaterialText`를 함께 확인
- 문항 이미지는 `questionImage`를 우선 사용하고, 필요한 문항만 `imageReferences`를 함께 확인
- `surfaceMode`는 `question_crop`, `page_reference`, `text_only` 중 하나로 문항 표면 상태를 나타냄
- 빈칸, 밑줄은 `promptRaw`, `promptLinesRaw`, `hasBlank`, `hasUnderline` 필드 기준으로 보존 확인
