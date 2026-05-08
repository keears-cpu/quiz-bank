const DATA_URL = '../all-question-bank.json';

const state = {
  payload: null,
  exams: [],
  questions: [],
  filteredExams: [],
  selectedExamIds: new Set(),
  loadedExamIds: [],
  sessionQuestions: [],
  wrongQuestionKeys: [],
  currentView: 'preview',
  columnMode: 1,
  includeAnswerKey: true,
};

function storageKey(suffix) {
  const label = (state.payload?.meta?.bankLabel || 'exam-bank').toLowerCase().replace(/\s+/g, '-');
  return `question-bank:${label}:${suffix}`;
}

async function init() {
  if (window.__QUESTION_BANK_DATA__) {
    state.payload = window.__QUESTION_BANK_DATA__;
  } else {
    const response = await fetch(DATA_URL);
    state.payload = await response.json();
  }
  state.exams = state.payload.exams || [];
  state.questions = state.payload.questions || [];
  state.filteredExams = [...state.exams];
  document.getElementById('bank-label').textContent = state.payload.meta?.bankLabel || 'Exam Question Bank';
  fillCategoryFilter();
  fillExamKindFilter();
  restoreSessionState();
  bindControls();
  renderExamList();
  renderOperatorWarning();
  updateViewMode();
  updateColumnButtons();
  updateAnswerKeyToggle();
  renderPaperPreview();
}

function fillCategoryFilter() {
  const select = document.getElementById('category-filter');
  const categories = [...new Set(state.exams.map(exam => exam.category).filter(Boolean))].sort();
  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }
}

function fillExamKindFilter() {
  const select = document.getElementById('exam-kind-filter');
  const kinds = [...new Set(state.exams.map(exam => exam.examKind).filter(Boolean))].sort();
  for (const kind of kinds) {
    const option = document.createElement('option');
    option.value = kind;
    option.textContent = kind;
    select.appendChild(option);
  }
}

function bindControls() {
  document.getElementById('category-filter').addEventListener('change', filterExams);
  document.getElementById('exam-kind-filter').addEventListener('change', filterExams);
  document.getElementById('surface-filter').addEventListener('change', filterExams);
  document.getElementById('distribution-mode').addEventListener('change', persistSessionState);
  document.getElementById('question-visibility-filter').addEventListener('change', persistSessionState);
  document.getElementById('question-count').addEventListener('change', persistSessionState);
  document.getElementById('answer-key-toggle').addEventListener('change', (event) => {
    state.includeAnswerKey = event.target.checked;
    persistSessionState();
    renderPaperPreview();
  });
  document.getElementById('load-exams').addEventListener('click', loadSelectedExams);
  document.getElementById('select-all').addEventListener('click', () => {
    for (const exam of state.filteredExams) state.selectedExamIds.add(exam.id);
    persistSessionState();
    renderExamList();
    renderOperatorWarning();
  });
  document.getElementById('clear-all').addEventListener('click', () => {
    state.selectedExamIds.clear();
    persistSessionState();
    renderExamList();
    renderOperatorWarning();
  });
  document.getElementById('build-quiz').addEventListener('click', () => buildQuiz(false));
  document.getElementById('retry-wrong').addEventListener('click', () => buildQuiz(true));
  document.getElementById('grade-quiz').addEventListener('click', gradeQuiz);
  document.getElementById('show-preview').addEventListener('click', () => switchView('preview'));
  document.getElementById('show-solve').addEventListener('click', () => switchView('solve'));
  document.getElementById('column-one').addEventListener('click', () => setColumnMode(1));
  document.getElementById('column-two').addEventListener('click', () => setColumnMode(2));
  document.getElementById('print-paper').addEventListener('click', handlePrint);
  document.getElementById('save-html').addEventListener('click', handleSaveHtml);
}

function restoreSessionState() {
  try {
    const selected = JSON.parse(localStorage.getItem(storageKey('selectedExams')) || '[]');
    const loaded = JSON.parse(localStorage.getItem(storageKey('loadedExams')) || '[]');
    const wrong = JSON.parse(localStorage.getItem(storageKey('wrongQuestions')) || '[]');
    const distributionMode = localStorage.getItem(storageKey('distributionMode')) || 'random';
    const questionVisibilityFilter = localStorage.getItem(storageKey('questionVisibilityFilter')) || 'all';
    const questionCount = localStorage.getItem(storageKey('questionCount')) || '15';
    const currentView = localStorage.getItem(storageKey('currentView')) || 'preview';
    const columnMode = Number(localStorage.getItem(storageKey('columnMode')) || '1');
    const includeAnswerKey = localStorage.getItem(storageKey('includeAnswerKey'));
    state.selectedExamIds = new Set(selected);
    state.wrongQuestionKeys = Array.isArray(wrong) ? wrong : [];
    state.currentView = currentView;
    state.columnMode = columnMode === 2 ? 2 : 1;
    state.includeAnswerKey = includeAnswerKey === null ? true : includeAnswerKey === 'true';
    document.getElementById('distribution-mode').value = distributionMode;
    document.getElementById('question-visibility-filter').value = questionVisibilityFilter;
    document.getElementById('question-count').value = questionCount;
    state.loadedExamIds = Array.isArray(loaded) ? loaded : [];
  } catch (error) {
    state.selectedExamIds = new Set();
    state.loadedExamIds = [];
    state.wrongQuestionKeys = [];
  }
}

function persistSessionState() {
  localStorage.setItem(storageKey('selectedExams'), JSON.stringify([...state.selectedExamIds]));
  localStorage.setItem(storageKey('loadedExams'), JSON.stringify(state.loadedExamIds));
  localStorage.setItem(storageKey('wrongQuestions'), JSON.stringify(state.wrongQuestionKeys));
  localStorage.setItem(storageKey('distributionMode'), document.getElementById('distribution-mode').value);
  localStorage.setItem(storageKey('questionVisibilityFilter'), document.getElementById('question-visibility-filter').value);
  localStorage.setItem(storageKey('questionCount'), document.getElementById('question-count').value);
  localStorage.setItem(storageKey('currentView'), state.currentView);
  localStorage.setItem(storageKey('columnMode'), String(state.columnMode));
  localStorage.setItem(storageKey('includeAnswerKey'), String(state.includeAnswerKey));
}

function filterExams() {
  const category = document.getElementById('category-filter').value;
  const examKind = document.getElementById('exam-kind-filter').value;
  const surfaceFilter = document.getElementById('surface-filter').value;
  state.filteredExams = state.exams.filter(exam => {
    const surfacePass =
      !surfaceFilter ||
      (surfaceFilter === 'with-image' && exam.hasQuestionCrops) ||
      (surfaceFilter === 'no-image' && !exam.hasQuestionCrops) ||
      (surfaceFilter === 'manual-review' && exam.manualReviewStatus !== 'light');
    return (!category || exam.category === category) && (!examKind || exam.examKind === examKind) && surfacePass;
  });
  renderExamList();
}

function renderExamList() {
  const container = document.getElementById('exam-list');
  const summary = document.getElementById('exam-selection-summary');
  container.innerHTML = '';
  const selectedVisibleCount = state.filteredExams.filter(exam => state.selectedExamIds.has(exam.id)).length;
  const selectedTotalCount = state.selectedExamIds.size;
  summary.textContent = `현재 ${state.filteredExams.length}개 시험지 중 ${selectedVisibleCount}개 선택됨 · 전체 선택 ${selectedTotalCount}개`;
  for (const exam of state.filteredExams) {
    const card = document.createElement('div');
    card.className = 'exam-card';
    const checked = state.selectedExamIds.has(exam.id) ? 'checked' : '';
    card.innerHTML = `
      <label>
        <input type="checkbox" data-exam-id="${escapeHtml(exam.id)}" ${checked}>
        <span class="exam-card-title">${escapeHtml(exam.title)}</span>
        <span class="exam-card-meta">${escapeHtml(exam.examKind || 'other')} · ${escapeHtml(exam.category)} · ${escapeHtml(exam.series)} · ${exam.questionCount}문항 · crop ${Math.round((exam.questionImageCoverage || 0) * 100)}% · ${escapeHtml(exam.manualReviewStatus || 'light')}</span>
      </label>
    `;
    card.querySelector('input').addEventListener('change', (event) => {
      const examId = event.target.getAttribute('data-exam-id');
      if (event.target.checked) state.selectedExamIds.add(examId);
      else state.selectedExamIds.delete(examId);
      persistSessionState();
      renderExamList();
      renderOperatorWarning();
    });
    container.appendChild(card);
  }
}

function loadSelectedExams() {
  const selected = state.exams.filter(exam => state.selectedExamIds.has(exam.id));
  if (!selected.length) {
    alert('시험지를 하나 이상 선택하세요.');
    return;
  }
  state.loadedExamIds = selected.map(exam => exam.id);
  persistSessionState();
  switchView('preview');
  renderPaperPreview();
}

function buildQuiz(onlyWrong) {
  const count = Math.max(1, Number(document.getElementById('question-count').value || 15));
  const distributionMode = document.getElementById('distribution-mode').value;
  const questionVisibilityFilter = document.getElementById('question-visibility-filter').value;
  let pool = [];
  if (onlyWrong && state.wrongQuestionKeys.length) {
    const wrongSet = new Set(state.wrongQuestionKeys);
    pool = state.questions.filter(question => wrongSet.has(question.questionKey));
  } else {
    const selected = new Set(state.selectedExamIds);
    pool = state.questions.filter(question => selected.has(question.examId));
  }
  if (questionVisibilityFilter === 'image-only') {
    pool = pool.filter(question => question.surfaceMode === 'question_crop' && question.questionImage);
  }
  if (!pool.length) {
    alert(onlyWrong ? '오답 문항이 없습니다.' : '시험지를 하나 이상 선택하세요.');
    return;
  }
  state.sessionQuestions =
    distributionMode === 'balanced'
      ? sampleBalanced(pool, Math.min(count, pool.length))
      : sample(pool, Math.min(count, pool.length));
  persistSessionState();
  renderOperatorWarning();
  renderSolveForm();
  renderPaperPreview();
}

function renderSolveForm() {
  const form = document.getElementById('quiz-form');
  const meta = document.getElementById('solve-meta');
  const summary = document.getElementById('session-summary');
  form.innerHTML = '';

  if (!state.sessionQuestions.length) {
    meta.textContent = '아직 생성된 세션이 없습니다.';
    summary.textContent = '시험지를 선택하고 세션을 생성하세요.';
    return;
  }

  const withImage = state.sessionQuestions.filter(question => question.surfaceMode === 'question_crop').length;
  const pageReference = state.sessionQuestions.filter(question => question.surfaceMode === 'page_reference').length;
  const textOnly = state.sessionQuestions.filter(question => question.surfaceMode === 'text_only').length;
  summary.textContent = `${state.sessionQuestions.length}문항 세션 준비 완료 · 문항이미지 ${withImage} · 원본참조 ${pageReference} · 텍스트형 ${textOnly}`;
  meta.textContent = [...new Set(state.sessionQuestions.map(question => question.examTitle))].join(' / ');

  state.sessionQuestions.forEach((question, index) => {
    const article = document.createElement('article');
    article.className = 'question-card';
    const visualHtml = renderQuestionVisual(question);
    const sectionHtml = question.sectionMaterialText
      ? `<div class="section-text">${escapeHtml(question.sectionMaterialText)}</div>`
      : '';
    const promptText = question.promptDisplay || question.promptRaw || '';
    article.innerHTML = `
      <div class="question-topline">
        <span>${index + 1}번 세션문항</span>
        <span>${escapeHtml(question.examTitle)}</span>
        <span>${escapeHtml(question.sectionTitle || '')}</span>
      </div>
      ${renderSurfaceChip(question)}
      ${sectionHtml}
      ${visualHtml}
      ${promptText ? `<div class="question-text">${escapeHtml(promptText)}</div>` : ''}
      ${renderAnswerInput(question, index)}
      <div class="result" id="result-${index}" hidden></div>
    `;
    form.appendChild(article);
  });
}

function renderPaperPreview() {
  const meta = document.getElementById('quiz-meta');
  const preview = document.getElementById('paper-preview');
  const fullPreview = document.getElementById('full-exam-preview');
  preview.classList.toggle('two-column', state.columnMode === 2);
  renderFullExamPreview();

  if (!state.sessionQuestions.length) {
    meta.textContent = state.loadedExamIds.length ? '선택한 원본 시험지를 불러왔습니다.' : '세션 생성 전입니다.';
    preview.innerHTML = `<div class="print-header"><div class="print-title">${escapeHtml(state.payload?.meta?.bankLabel || 'Exam Question Bank')}</div><div class="print-subtitle">왼쪽에서 시험지를 선택하고 세션을 생성하세요.</div></div>`;
    return;
  }

  const selectedTitles = [...new Set(state.sessionQuestions.map(question => question.examTitle))];
  meta.textContent = `${selectedTitles.join(' / ')} · ${state.columnMode}열 · ${state.includeAnswerKey ? '정답지 포함' : '정답지 제외'}`;
  preview.innerHTML = buildPaperHtml();
}

function renderFullExamPreview() {
  const container = document.getElementById('full-exam-preview');
  const loadedExams = state.exams.filter(exam => state.loadedExamIds.includes(exam.id));
  if (!loadedExams.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <div class="full-exam-header">
      <div>
        <h3>선택 시험지 확인</h3>
        <p>파싱되어 재구성된 시험지 본문과 원본 시험지를 함께 확인합니다.</p>
      </div>
    </div>
    <div class="full-exam-grid">
      ${loadedExams.map(renderFullExamCard).join('')}
    </div>
  `;
}

function renderFullExamCard(exam) {
  const pages = exam.imageReferences || [];
  const questions = state.questions
    .filter(question => question.examId === exam.id)
    .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
  return `
    <article class="full-exam-card">
      <div class="full-exam-card-top">
        <strong>${escapeHtml(exam.title)}</strong>
        <span>${pages.length} page${pages.length === 1 ? '' : 's'}</span>
      </div>
      <section class="reconstructed-exam">
        <div class="reconstructed-exam-title">파싱 재구성 본문</div>
        <div class="reconstructed-exam-body">
          ${questions.map((question, index) => renderLoadedExamQuestion(question, index)).join('')}
        </div>
      </section>
      <section class="original-exam">
        <div class="reconstructed-exam-title">원본 시험지</div>
      ${pages.length ? `
      <div class="full-exam-pages">
        ${pages.map((imagePath, index) => `
          <figure class="full-exam-page">
            <img src="../${escapeAttr(imagePath)}" alt="${escapeAttr(exam.title)} ${index + 1}페이지">
            <figcaption>${index + 1}페이지</figcaption>
          </figure>
        `).join('')}
      </div>
      ` : `<div class="preview-note">원본 preview 없음</div>`}
      </section>
    </article>
  `;
}

function renderLoadedExamQuestion(question, index) {
  const promptText = question.promptDisplay || question.promptRaw || '';
  const sectionText = question.sectionMaterialText
    ? `<div class="paper-section-text">${escapeHtml(question.sectionMaterialText)}</div>`
    : '';
  const visual = renderPrintableVisual(question);
  const choices = renderPrintableChoices(question);
  const needsOriginalPreview = question.surfaceMode === 'page_reference' || (question.promptMissing && (question.imageReferences || []).length) || ((question.uiMode || '').startsWith('image_') && !question.questionImage);
  const previewNote = !visual && needsOriginalPreview ? `<div class="preview-note">재구성 본문만으로 부족합니다. 아래 원본 시험지를 함께 확인하세요.</div>` : '';
  const answerLine = question.answerType === 'short_text' ? `<div class="paper-prompt"><span class="paper-answer-line"></span></div>` : '';
  return `
    <section class="paper-question compact">
      <div class="paper-q-top"><span class="paper-qn">${index + 1}.</span><span>${escapeHtml(question.sectionTitle || '')}</span></div>
      ${sectionText}
      ${visual}
      ${previewNote}
      ${promptText ? `<div class="paper-prompt">${escapeHtml(promptText)}</div>` : ''}
      ${choices}
      ${answerLine}
    </section>
  `;
}

function buildPaperHtml() {
  const selectedTitles = [...new Set(state.sessionQuestions.map(question => question.examTitle))];
  const header = `
    <div class="print-header">
      <div class="print-title">${escapeHtml(state.payload?.meta?.bankLabel || 'Exam Question Bank')}</div>
      <div class="print-subtitle">${escapeHtml(selectedTitles.join(' / '))}</div>
      <div class="print-info">
        <span>Name: ____________</span>
        <span>Date: ____________</span>
        <span>Score: ____________</span>
      </div>
    </div>
  `;

  const body = `
    <div class="paper-body">
      ${state.sessionQuestions.map((question, index) => renderPrintableQuestion(question, index)).join('')}
    </div>
  `;

  const answers = state.includeAnswerKey ? `
    <div class="answer-break"></div>
    <div class="print-header">
      <div class="print-title">[ Answer Key ]</div>
      <div class="print-subtitle">${escapeHtml(selectedTitles.join(' / '))}</div>
    </div>
    <div class="answer-grid">
      ${state.sessionQuestions.map((question, index) => `<div class="answer-item"><strong>${index + 1}.</strong> ${escapeHtml(question.answerText || '')}</div>`).join('')}
    </div>
  ` : '';

  return `${header}${body}${answers}`;
}

function renderPrintableQuestion(question, index) {
  const promptText = question.promptDisplay || question.promptRaw || '';
  const sectionText = question.sectionMaterialText
    ? `<div class="paper-section-text">${escapeHtml(question.sectionMaterialText)}</div>`
    : '';
  const visual = renderPrintableVisual(question);
  const choices = renderPrintableChoices(question);
  const answerLine = question.answerType === 'short_text' ? `<div class="paper-prompt"><span class="paper-answer-line"></span></div>` : '';
  return `
    <section class="paper-question">
      <div class="paper-q-top"><span class="paper-qn">${index + 1}.</span><span>${escapeHtml(question.sectionTitle || '')}</span></div>
      ${renderPaperSurface(question)}
      ${sectionText}
      ${visual}
      ${promptText ? `<div class="paper-prompt">${escapeHtml(promptText)}</div>` : ''}
      ${choices}
      ${answerLine}
    </section>
  `;
}

function renderPrintableVisual(question) {
  if (question.requiresImageReference && question.questionImage) {
    return `<img class="paper-image" src="../${escapeAttr(question.questionImage)}" alt="문항 이미지">`;
  }
  return '';
}

function renderPrintableChoices(question) {
  if (!String(question.answerType || '').startsWith('multiple_choice') || !(question.choiceOptions || []).length) {
    return '';
  }
  return `<div class="paper-choices">${question.choiceOptions.map((choice, index) => `<span class="paper-choice">(${index + 1}) ${escapeHtml(choice)}</span>`).join('')}</div>`;
}

function renderQuestionVisual(question) {
  if (question.requiresImageReference && question.questionImage) {
    return `<img src="../${escapeAttr(question.questionImage)}" alt="문항 이미지">`;
  }
  return '';
}

function renderAnswerInput(question, index) {
  const name = `q-${index}`;
  if ((question.answerType || '').startsWith('multiple_choice') && (question.choiceOptions || []).length) {
    return `
      <div class="choice-grid">
        ${question.choiceOptions.map((choice) => `
          <label class="choice-item">
            <input type="${question.answerType.includes('multi') ? 'checkbox' : 'radio'}" name="${name}" value="${escapeAttr(choice)}">
            <span>${escapeHtml(choice)}</span>
          </label>
        `).join('')}
      </div>
    `;
  }
  return `<input class="short-answer" type="text" name="${name}" placeholder="정답 입력">`;
}

function gradeQuiz() {
  if (!state.sessionQuestions.length) return;
  const form = document.getElementById('quiz-form');
  const wrong = [];
  let correct = 0;

  state.sessionQuestions.forEach((question, index) => {
    const result = document.getElementById(`result-${index}`);
    const userAnswer = readUserAnswer(form, question, index);
    const expected = normalizeAnswer(question.answerText);
    const actual = normalizeAnswer(userAnswer);
    const ok = expected === actual;
    result.hidden = false;
    result.className = `result ${ok ? 'ok' : 'bad'}`;
    result.textContent = ok
      ? `정답: ${question.answerText}`
      : `오답 · 입력: ${userAnswer || '(빈 답안)'} / 정답: ${question.answerText}`;
    if (ok) correct += 1;
    else wrong.push(question.questionKey);
  });

  state.wrongQuestionKeys = wrong;
  persistSessionState();
  document.getElementById('session-summary').textContent = `점수 ${correct}/${state.sessionQuestions.length} · 오답 ${wrong.length}`;
}

function readUserAnswer(form, question, index) {
  const name = `q-${index}`;
  if ((question.answerType || '').startsWith('multiple_choice') && (question.choiceOptions || []).length) {
    const selected = [...form.querySelectorAll(`[name="${name}"]:checked`)].map(input => input.value);
    return selected.join(', ');
  }
  return form.querySelector(`[name="${name}"]`)?.value || '';
}

function normalizeAnswer(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ');
  if (!normalized.includes(',')) return normalized;
  return normalized
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .sort()
    .join(', ');
}

function renderOperatorWarning() {
  const box = document.getElementById('operator-warning');
  const selected = state.exams.filter(exam => state.selectedExamIds.has(exam.id));
  if (!selected.length) {
    box.hidden = true;
    return;
  }
  const risky = selected.filter(exam => exam.manualReviewStatus && exam.manualReviewStatus !== 'light');
  const textOnly = selected.filter(exam => !exam.hasQuestionCrops);
  if (!risky.length && !textOnly.length) {
    box.hidden = true;
    return;
  }
  const parts = [];
  if (risky.length) parts.push(`수동 검수 권장 시험지 ${risky.length}개`);
  if (textOnly.length) parts.push(`문항 이미지 없는 시험지 ${textOnly.length}개`);
  box.textContent = `운영자 주의: ${parts.join(' · ')}`;
  box.hidden = false;
}

function switchView(view) {
  state.currentView = view;
  persistSessionState();
  updateViewMode();
}

function updateViewMode() {
  document.getElementById('preview-view').classList.toggle('hidden', state.currentView !== 'preview');
  document.getElementById('solve-view').classList.toggle('hidden', state.currentView !== 'solve');
  document.getElementById('show-preview').classList.toggle('active', state.currentView === 'preview');
  document.getElementById('show-solve').classList.toggle('active', state.currentView === 'solve');
}

function setColumnMode(mode) {
  state.columnMode = mode;
  persistSessionState();
  updateColumnButtons();
  renderPaperPreview();
}

function updateColumnButtons() {
  document.getElementById('column-one').classList.toggle('active', state.columnMode === 1);
  document.getElementById('column-two').classList.toggle('active', state.columnMode === 2);
}

function updateAnswerKeyToggle() {
  document.getElementById('answer-key-toggle').checked = state.includeAnswerKey;
}

function handlePrint() {
  const preview = document.getElementById('paper-preview');
  if (!preview.innerHTML.trim()) return;
  const win = window.open('', '_blank', 'width=1100,height=900');
  if (!win) {
    alert('팝업 차단을 해제한 뒤 다시 시도하세요.');
    return;
  }
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Print Exam</title><style>${buildPrintStyles()}</style></head><body>${preview.outerHTML}</body></html>`;
  win.document.write(doc);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function handleSaveHtml() {
  const preview = document.getElementById('paper-preview');
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Saved Exam</title><style>${buildPrintStyles()}</style></head><body>${preview.outerHTML}</body></html>`;
  const blob = new Blob([doc], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.payload?.meta?.bankLabel || 'exam-bank').replace(/\s+/g, '-').toLowerCase()}.html`;
  a.click();
}

function buildPrintStyles() {
  return `
    @page { size: A4; margin: 16mm; }
    body { font-family: Pretendard, Arial, sans-serif; color: #182033; margin: 0; }
    .paper-preview { padding: 0; width: 100%; min-height: auto; box-shadow: none; }
    .paper-preview.two-column .paper-body { column-count: 2; column-gap: 32px; column-rule: 1px solid #edf0f7; }
    .print-header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 14px; margin-bottom: 24px; }
    .print-title { font-size: 30px; font-weight: 900; color: #4f46e5; }
    .print-subtitle { margin-top: 8px; color: #667189; font-size: 14px; }
    .print-info { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 14px; font-size: 12px; color: #667189; }
    .paper-question { break-inside: avoid; margin-bottom: 16px; }
    .paper-q-top { display: flex; gap: 8px; align-items: baseline; font-size: 15px; font-weight: 700; line-height: 1.6; }
    .paper-qn { color: #4f46e5; font-weight: 900; }
    .paper-surface { display: inline-flex; margin-top: 8px; margin-bottom: 8px; padding: 4px 8px; border-radius: 999px; background: #f3f4f8; color: #667189; font-size: 11px; font-weight: 700; }
    .paper-section-text, .paper-fallback-note { white-space: pre-wrap; background: #fafbfe; border: 1px solid #edf0f7; border-radius: 12px; padding: 10px 12px; color: #667189; font-size: 13px; line-height: 1.55; margin-bottom: 10px; }
    .paper-image { width: min(100%, 220px); max-height: 180px; object-fit: contain; border-radius: 12px; border: 1px solid #e8ebf3; display: block; margin: 0 auto 10px; }
    .paper-prompt { white-space: pre-wrap; font-size: 14px; line-height: 1.65; margin-bottom: 10px; }
    .paper-choices { display: flex; gap: 10px 18px; flex-wrap: wrap; font-size: 13px; color: #364152; margin-left: 22px; }
    .paper-choice { min-width: 140px; }
    .paper-answer-line { display: inline-block; min-width: 150px; border-bottom: 1px solid #222; transform: translateY(-2px); }
    .answer-break { page-break-before: always; break-before: page; height: 28px; }
    .answer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 16px; font-size: 13px; }
    .answer-item { border-bottom: 1px dashed #d7dcea; padding-bottom: 6px; }
  `;
}

function renderSurfaceChip(question) {
  return '';
}

function renderPaperSurface(question) {
  return '';
}

function surfaceLabel(question) {
  return '';
}

function sample(items, count) {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned.slice(0, count);
}

function sampleBalanced(items, count) {
  const buckets = new Map();
  for (const item of sample(items, items.length)) {
    if (!buckets.has(item.examId)) buckets.set(item.examId, []);
    buckets.get(item.examId).push(item);
  }
  const result = [];
  const keys = [...buckets.keys()];
  while (result.length < count && keys.length) {
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const bucket = buckets.get(key) || [];
      if (!bucket.length) continue;
      result.push(bucket.shift());
      if (result.length >= count) break;
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      if (!(buckets.get(keys[index]) || []).length) keys.splice(index, 1);
    }
  }
  return result.slice(0, count);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

init().catch((error) => {
  const summary = document.getElementById('session-summary');
  if (summary) summary.textContent = `데이터 로드 실패: ${error.message}`;
});
