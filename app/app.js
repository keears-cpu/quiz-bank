const DATA_URL = '../safe-question-bank.json';
const FALLBACK_DATA_URL = '../safe-question-bank.json';

const state = {
  payload: null,
  exams: [],
  questions: [],
  filteredExams: [],
  selectedExamIds: new Set(),
  examCountPlan: {},
  loadedExamIds: [],
  sessionQuestions: [],
  wrongQuestionKeys: [],
  currentView: 'preview',
  columnMode: 1,
  includeAnswerKey: true,
  printFocusMode: false,
  shuffleQuestions: true,
  examScope: 'general',
};

function storageKey(suffix) {
  const label = (state.payload?.meta?.bankLabel || 'exam-bank').toLowerCase().replace(/\s+/g, '-');
  return `question-bank:${label}:${suffix}`;
}

async function init() {
  // Prefer the report-ready safe-axis dataset; fall back to the full bank for legacy previews.
  try {
    state.payload = await fetchJson(DATA_URL);
  } catch (error) {
    try {
      state.payload = await fetchJson(FALLBACK_DATA_URL);
    } catch (fallbackError) {
      if (window.__QUESTION_BANK_DATA__ || window.QUESTION_BANK_DATA) {
        state.payload = window.__QUESTION_BANK_DATA__ || window.QUESTION_BANK_DATA;
      } else {
        throw fallbackError;
      }
    }
  }
  state.exams = orderExamsForDisplay(state.payload.exams || []);
  state.questions = state.payload.questions || [];
  document.getElementById('bank-label').textContent = state.payload.meta?.bankLabel || 'Exam Question Bank';
  fillCategoryFilter();
  fillExamKindFilter();
  restoreSessionState();
  pruneSessionStateToVisibleExams();
  state.filteredExams = getFilteredExams();
  bindControls();
  updateExamScopeTabs();
  renderExamList();
  renderOperatorWarning();
  updateViewMode();
  updateColumnButtons();
  updateAnswerKeyToggle();
  applyPrintFocusMode();
  renderPaperPreview();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
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
  const labels = { level: '레벨', midterm: '미드텀', final: '파이널', other: '기타' };
  const counts = state.exams.reduce((acc, exam) => {
    if (exam.examKind) acc[exam.examKind] = (acc[exam.examKind] || 0) + 1;
    return acc;
  }, {});
  const kinds = Object.keys(counts).sort();
  for (const kind of kinds) {
    const option = document.createElement('option');
    option.value = kind;
    option.textContent = `${labels[kind] || kind} (${counts[kind]})`;
    select.appendChild(option);
  }
}

function bindControls() {
  document.getElementById('category-filter').addEventListener('change', filterExams);
  document.getElementById('exam-kind-filter').addEventListener('change', filterExams);
  document.getElementById('exam-search').addEventListener('input', filterExams);
  document.getElementById('exam-scope-general').addEventListener('click', () => setExamScope('general'));
  document.getElementById('exam-scope-monster').addEventListener('click', () => setExamScope('monster'));
  document.getElementById('answer-key-toggle').addEventListener('change', (event) => {
    state.includeAnswerKey = event.target.checked;
    persistSessionState();
    renderPaperPreview();
  });
  document.getElementById('build-from-input').addEventListener('click', () => buildFromExamPlan());
  document.getElementById('shuffle-toggle').addEventListener('click', toggleShuffleMode);
  document.getElementById('select-all').addEventListener('click', () => {
    for (const exam of state.filteredExams) {
      state.examCountPlan[exam.id] = Math.min(10, Number(exam.questionCount || 10));
    }
    persistSessionState();
    renderExamList();
    renderOperatorWarning();
  });
  document.getElementById('clear-all').addEventListener('click', () => {
    for (const exam of state.filteredExams) {
      delete state.examCountPlan[exam.id];
    }
    persistSessionState();
    renderExamList();
    renderOperatorWarning();
  });
  document.getElementById('retry-wrong').addEventListener('click', buildWrongOnly);
  document.getElementById('grade-quiz').addEventListener('click', gradeQuiz);
  document.getElementById('show-preview').addEventListener('click', () => switchView('preview'));
  document.getElementById('show-solve').addEventListener('click', () => switchView('solve'));
  document.getElementById('show-original').addEventListener('click', () => switchView('original'));
  document.getElementById('column-one').addEventListener('click', () => setColumnMode(1));
  document.getElementById('column-two').addEventListener('click', () => setColumnMode(2));
  document.getElementById('print-paper').addEventListener('click', handlePrint);
  document.getElementById('save-html').addEventListener('click', handleSaveHtml);
  document.getElementById('focus-print').addEventListener('click', togglePrintFocusMode);
}

function restoreSessionState() {
  try {
    const selected = JSON.parse(localStorage.getItem(storageKey('selectedExams')) || '[]');
    const plan = JSON.parse(localStorage.getItem(storageKey('examCountPlan')) || '{}');
    const loaded = JSON.parse(localStorage.getItem(storageKey('loadedExams')) || '[]');
    const wrong = JSON.parse(localStorage.getItem(storageKey('wrongQuestions')) || '[]');
    const currentView = localStorage.getItem(storageKey('currentView')) || 'preview';
    const columnMode = Number(localStorage.getItem(storageKey('columnMode')) || '1');
    const includeAnswerKey = localStorage.getItem(storageKey('includeAnswerKey'));
    const printFocusMode = localStorage.getItem(storageKey('printFocusMode'));
  const shuffleQuestions = localStorage.getItem(storageKey('shuffleQuestions'));
  const examScope = localStorage.getItem(storageKey('examScope'));
    state.selectedExamIds = new Set(selected);
    state.examCountPlan = plan && typeof plan === 'object' ? plan : {};
    state.wrongQuestionKeys = Array.isArray(wrong) ? wrong : [];
    state.currentView = currentView;
    state.columnMode = columnMode === 2 ? 2 : 1;
    state.includeAnswerKey = includeAnswerKey === null ? true : includeAnswerKey === 'true';
    state.printFocusMode = printFocusMode === 'true';
    state.shuffleQuestions = shuffleQuestions === null ? true : shuffleQuestions === 'true';
    state.examScope = examScope === 'monster' ? 'monster' : 'general';
    updateShuffleButton();
    state.loadedExamIds = Array.isArray(loaded) ? loaded : [];
  } catch (error) {
    state.selectedExamIds = new Set();
    state.examCountPlan = {};
    state.loadedExamIds = [];
    state.wrongQuestionKeys = [];
  }
}

function persistSessionState() {
  localStorage.setItem(storageKey('selectedExams'), JSON.stringify([...state.selectedExamIds]));
  localStorage.setItem(storageKey('examCountPlan'), JSON.stringify(state.examCountPlan));
  localStorage.setItem(storageKey('loadedExams'), JSON.stringify(state.loadedExamIds));
  localStorage.setItem(storageKey('wrongQuestions'), JSON.stringify(state.wrongQuestionKeys));
  localStorage.setItem(storageKey('currentView'), state.currentView);
  localStorage.setItem(storageKey('columnMode'), String(state.columnMode));
  localStorage.setItem(storageKey('includeAnswerKey'), String(state.includeAnswerKey));
  localStorage.setItem(storageKey('printFocusMode'), String(state.printFocusMode));
  localStorage.setItem(storageKey('shuffleQuestions'), String(state.shuffleQuestions));
  localStorage.setItem(storageKey('examScope'), state.examScope);
}

function pruneSessionStateToVisibleExams() {
  const visibleIds = new Set(state.exams.map(exam => exam.id));
  state.selectedExamIds = new Set([...state.selectedExamIds].filter(examId => visibleIds.has(examId)));
  state.loadedExamIds = state.loadedExamIds.filter(examId => visibleIds.has(examId));
  state.examCountPlan = Object.fromEntries(
    Object.entries(state.examCountPlan).filter(([examId, count]) => visibleIds.has(examId) && Number(count) > 0)
  );
  if (state.sessionQuestions.length) {
    state.sessionQuestions = state.sessionQuestions.filter(question => visibleIds.has(question.examId));
  }
  persistSessionState();
}

function filterExams() {
  state.filteredExams = getFilteredExams();
  renderExamList();
}

function getFilteredExams() {
  const category = document.getElementById('category-filter').value;
  const examKind = document.getElementById('exam-kind-filter').value;
  const keyword = String(document.getElementById('exam-search').value || '').trim().toLowerCase();
  return state.exams.filter(exam => {
    const title = `${exam.title || ''} ${exam.series || ''} ${exam.id || ''}`.toLowerCase();
    const inMonsterScope = isMonsterPhonicsExam(exam);
    return (state.examScope === 'monster' ? inMonsterScope : !inMonsterScope)
      && (!category || exam.category === category)
      && (!examKind || exam.examKind === examKind)
      && (!keyword || title.includes(keyword));
  });
}

function setExamScope(scope) {
  state.examScope = scope === 'monster' ? 'monster' : 'general';
  persistSessionState();
  updateExamScopeTabs();
  filterExams();
}

function updateExamScopeTabs() {
  const general = document.getElementById('exam-scope-general');
  const monster = document.getElementById('exam-scope-monster');
  if (!general || !monster) return;
  const isMonster = state.examScope === 'monster';
  general.classList.toggle('active', !isMonster);
  monster.classList.toggle('active', isMonster);
  general.setAttribute('aria-selected', String(!isMonster));
  monster.setAttribute('aria-selected', String(isMonster));
}

function renderExamList() {
  const container = document.getElementById('exam-list');
  updateSelectedCount();
  container.innerHTML = '';
  for (const exam of state.filteredExams) {
    const card = document.createElement('div');
    card.className = 'exam-card exam-banner';
    const value = Number(state.examCountPlan[exam.id] || 0);
    const displayTitle = formatExamListTitle(exam);
    card.innerHTML = `
      <div class="exam-banner-row">
        <span class="exam-card-title">${escapeHtml(displayTitle)}</span>
      </div>
      <div class="exam-plan-row">
        <input type="number" min="0" max="${Number(exam.questionCount || 999)}" step="1" value="${value || ''}" data-exam-count="${escapeHtml(exam.id)}" placeholder="문항수">
        <button type="button" data-exam-action="generate" data-exam-id="${escapeHtml(exam.id)}">생성</button>
        <button type="button" data-exam-action="full" data-exam-id="${escapeHtml(exam.id)}">전체</button>
      </div>
    `;
    card.querySelector('[data-exam-count]').addEventListener('change', (event) => {
      const examId = event.target.getAttribute('data-exam-count');
      const count = Math.max(0, Number(event.target.value || 0));
      if (count > 0) state.examCountPlan[examId] = count;
      else delete state.examCountPlan[examId];
      persistSessionState();
      updateSelectedCount();
      renderOperatorWarning();
    });
    card.querySelector('[data-exam-action="generate"]').addEventListener('click', (event) => {
      const examId = event.target.getAttribute('data-exam-id');
      const count = Math.max(1, Number(card.querySelector('[data-exam-count]').value || state.examCountPlan[examId] || 10));
      state.examCountPlan[examId] = count;
      persistSessionState();
      buildFromExamPlan({ [examId]: count });
    });
    card.querySelector('[data-exam-action="full"]').addEventListener('click', (event) => {
      const examId = event.target.getAttribute('data-exam-id');
      loadSingleExamFull(examId);
    });
    container.appendChild(card);
  }
}

function updateSelectedCount() {
  const el = document.getElementById('selected-count');
  if (!el) return;
  const count = Object.values(state.examCountPlan).filter(value => Number(value) > 0).length;
  el.textContent = `입력 ${count}개`;
}

function normalizeExamTitle(title) {
  const value = String(title || '');
  const alreadyMonster = value.match(/^(레벨테스트|파이널테스트)\s*(\d+)$/);
  if (alreadyMonster) return `${alreadyMonster[1]}${alreadyMonster[2]}`;
  const monsterFinal = value.match(/phonics\s*monster\s*(\d+)\s*final\s*test/i);
  if (monsterFinal) {
    return `파이널테스트${monsterFinal[1]}`;
  }
  const monsterLevel = value.match(/phonics\s*monster\s*(\d+)\s*(midterm|unit|level)\s*test/i)
    || value.match(/book\s*(\d+)\s*unit\s*test/i);
  if (monsterLevel) {
    return `레벨테스트${monsterLevel[1]}`;
  }
  return value;
}

function formatExamListTitle(exam) {
  if (isPrimaryMonsterPhonicsExam(exam)) {
    return `Monster Phonics ${normalizeExamTitle(exam.title || '')}`;
  }
  const series = String(exam.series || '').trim();
  const title = String(exam.title || '').trim();
  if (series && title && title.toLowerCase() !== series.toLowerCase()) {
    return `${series} ${title}`;
  }
  return title || series || String(exam.id || '');
}

function orderExamsForDisplay(exams) {
  const collator = new Intl.Collator(['ko', 'en'], { numeric: true, sensitivity: 'base' });
  const rank = new Map();
  for (let level = 1; level <= 4; level += 1) {
    rank.set(`phonics-monster-level-test-${level}-unit-test-pdf`, (level - 1) * 2);
    rank.set(`phonics-phonics-monster-${level}-final-test-pdf`, (level - 1) * 2 + 1);
  }
  return [...exams].sort((a, b) => {
    const ar = rank.has(a.id) ? rank.get(a.id) : 999;
    const br = rank.has(b.id) ? rank.get(b.id) : 999;
    if (ar !== br) return ar - br;
    const category = collator.compare(String(a.category || ''), String(b.category || ''));
    if (category !== 0) return category;
    const series = collator.compare(String(a.series || ''), String(b.series || ''));
    if (series !== 0) return series;
    return collator.compare(String(a.title || ''), String(b.title || ''));
  });
}

function isPrimaryMonsterPhonicsExam(exam) {
  const id = String(exam?.id || '');
  return /^phonics-monster-level-test-[1-4]-unit-test-pdf$/.test(id)
    || /^phonics-phonics-monster-[1-4]-final-test-pdf$/.test(id);
}

function isMonsterPhonicsExam(exam) {
  const haystack = `${exam?.id || ''} ${exam?.title || ''} ${exam?.series || ''} ${exam?.category || ''}`.toLowerCase();
  return haystack.includes('monster') && haystack.includes('phonics');
}

function toggleShuffleMode() {
  state.shuffleQuestions = !state.shuffleQuestions;
  persistSessionState();
  updateShuffleButton();
}

function updateShuffleButton() {
  const button = document.getElementById('shuffle-toggle');
  if (!button) return;
  button.textContent = `문항 섞기: ${state.shuffleQuestions ? 'ON' : 'OFF'}`;
}

function togglePrintFocusMode() {
  state.printFocusMode = !state.printFocusMode;
  if (state.printFocusMode && state.currentView !== 'preview') {
    switchView('preview');
  }
  persistSessionState();
  applyPrintFocusMode();
}

function applyPrintFocusMode() {
  document.body.classList.toggle('print-focus-mode', state.printFocusMode);
  const btn = document.getElementById('focus-print');
  if (btn) {
    btn.classList.toggle('active', state.printFocusMode);
    btn.textContent = state.printFocusMode ? '집중모드 해제' : '출력 집중모드';
  }
}

function loadSelectedExams() {
  const selected = state.exams.filter(exam => state.selectedExamIds.has(exam.id));
  if (!selected.length) {
    alert('시험지를 하나 이상 선택하세요.');
    return;
  }
  state.loadedExamIds = selected.map(exam => exam.id);
  state.sessionQuestions = arrangeSessionQuestions(state.questions
    .filter(question => state.loadedExamIds.includes(question.examId))
    .sort((a, b) => {
      const examCmp = String(a.examTitle || '').localeCompare(String(b.examTitle || ''));
      if (examCmp !== 0) return examCmp;
      return Number(a.questionNumber || 0) - Number(b.questionNumber || 0);
    }));
  persistSessionState();
  switchView('original');
  renderSolveForm();
  renderPaperPreview();
}

function loadSingleExamFull(examId) {
  const selected = state.exams.find(exam => exam.id === examId);
  if (!selected) return;
  state.loadedExamIds = [selected.id];
  state.sessionQuestions = arrangeSessionQuestions(state.questions
    .filter(question => question.examId === selected.id)
    .sort((a, b) => Number(a.questionNumber || 0) - Number(b.questionNumber || 0)));
  persistSessionState();
  switchView('original');
  renderSolveForm();
  renderPaperPreview();
}

function buildFromExamPlan(singlePlan = null) {
  const plan = singlePlan || state.examCountPlan;
  const entries = Object.entries(plan).filter(([, count]) => Number(count) > 0);
  if (!entries.length) {
    alert('시험지별 문항 수를 입력하세요.');
    return;
  }
  state.loadedExamIds = entries.map(([examId]) => examId);
  const result = [];
  for (const [examId, count] of entries) {
    const bucket = state.questions.filter(question => question.examId === examId);
    const take = Math.min(Number(count), bucket.length);
    const picked = state.shuffleQuestions ? sample(bucket, take) : bucket.slice(0, take);
    result.push(...picked);
  }
  state.sessionQuestions = arrangeSessionQuestions(state.shuffleQuestions ? sample(result, result.length) : result);
  persistSessionState();
  renderOperatorWarning();
  renderSolveForm();
  switchView('preview');
  renderPaperPreview();
}

function buildWrongOnly() {
  if (!state.wrongQuestionKeys.length) {
    alert('오답 문항이 없습니다.');
    return;
  }
  const wrongSet = new Set(state.wrongQuestionKeys);
  const pool = state.questions.filter(question => wrongSet.has(question.questionKey));
  state.loadedExamIds = [...new Set(pool.map(question => question.examId))];
  state.sessionQuestions = arrangeSessionQuestions(state.shuffleQuestions ? sample(pool, pool.length) : pool);
  persistSessionState();
  renderOperatorWarning();
  renderSolveForm();
  switchView('preview');
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

  const withImage = state.sessionQuestions.filter(question => question.requiresImageReference && question.questionImage).length;
  const pageReference = state.sessionQuestions.filter(question => question.surfaceMode === 'page_reference').length;
  const textOnly = state.sessionQuestions.filter(question => question.surfaceMode === 'text_only').length;
  summary.textContent = `${state.sessionQuestions.length}문항 세션 준비 완료 · 문항이미지 ${withImage} · 원본참조 ${pageReference} · 텍스트형 ${textOnly}`;
  meta.textContent = [...new Set(state.sessionQuestions.map(question => normalizeExamTitle(question.examTitle)))].join(' / ');

  const shownAudioUrls = new Set();
  for (let index = 0; index < state.sessionQuestions.length; index += 1) {
    const question = state.sessionQuestions[index];
    const group = getQuestionGroup(question);
    if (group) {
      const groupItems = [];
      let cursor = index;
      while (cursor < state.sessionQuestions.length) {
        const candidate = state.sessionQuestions[cursor];
        const candidateGroup = getQuestionGroup(candidate);
        if (!candidateGroup || candidateGroup.key !== group.key) break;
        groupItems.push({ question: candidate, index: cursor });
        cursor += 1;
      }
      if (groupItems.length > 1) {
        form.appendChild(renderSolveQuestionGroup(groupItems, shownAudioUrls));
        index = cursor - 1;
        continue;
      }
    }
    const article = document.createElement('article');
    article.className = `question-card ${isMonsterExam(question) ? 'monster-pdf-card' : ''}`;
    const audioHtml = renderGroupedAudioPlayer(question, shownAudioUrls);
    const visualHtml = renderQuestionVisual(question);
    const sectionHtml = group ? '' : renderTextBlock(question.sectionMaterialText, 'section-text');
    const promptQuestion = group?.bankFromPrompt ? withoutPromptWordBank(question) : question;
    article.innerHTML = `
      ${group ? renderQuestionGroupHeader(question, 'solve') : ''}
      ${renderSurfaceChip(question)}
      ${audioHtml}
      ${sectionHtml}
      ${visualHtml}
      ${renderNumberedPrompt(promptQuestion, index)}
      ${renderAnswerInput(question, index)}
      <div class="result" id="result-${index}" hidden></div>
    `;
    form.appendChild(article);
  }
}

function renderNumberedPrompt(question, index, className = 'question-text') {
  const promptHtml = renderQuestionPromptForSolve(question, className);
  if (!promptHtml) return '';
  return `
    <div class="numbered-question-prompt">
      <span class="question-number-large">${escapeHtml(question.questionNumber || index + 1)}.</span>
      ${promptHtml}
    </div>
  `;
}

function renderSolveQuestionGroup(groupItems, shownAudioUrls) {
  const article = document.createElement('article');
  const first = groupItems[0].question;
  article.className = 'question-card question-set-card';
  const audioHtml = groupItems.map(item => renderGroupedAudioPlayer(item.question, shownAudioUrls)).filter(Boolean).join('');
  article.innerHTML = `
    ${renderQuestionGroupHeader(first, 'solve')}
    ${audioHtml}
    <div class="subquestion-list">
      ${groupItems.map(({ question, index }) => {
        const promptQuestion = getQuestionGroup(question)?.bankFromPrompt ? withoutPromptWordBank(question) : question;
        return `
          <div class="subquestion-item">
            ${renderSurfaceChip(question)}
            ${renderQuestionVisual(question)}
            <div class="subquestion-prompt">
              <span class="subquestion-number">${escapeHtml(question.questionNumber || index + 1)}.</span>
              ${renderQuestionPromptForSolve(promptQuestion, 'question-text subquestion-text')}
            </div>
            ${renderAnswerInput(question, index)}
            <div class="result" id="result-${index}" hidden></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  return article;
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

  const selectedTitles = [...new Set(state.sessionQuestions.map(question => normalizeExamTitle(question.examTitle)))];
  meta.textContent = `${selectedTitles.join(' / ')} · ${state.columnMode}열 · ${state.includeAnswerKey ? '정답지 포함' : '정답지 제외'}`;
  preview.innerHTML = buildPaperHtml();
}

function renderFullExamPreview() {
  const container = document.getElementById('full-exam-preview');
  const meta = document.getElementById('original-meta');
  const loadedExams = state.exams.filter(exam => state.loadedExamIds.includes(exam.id));
  if (!loadedExams.length) {
    container.hidden = true;
    container.innerHTML = '';
    if (meta) meta.textContent = '선택 시험지를 불러오면 원본 PDF를 여기서 확인할 수 있습니다.';
    return;
  }
  if (meta) meta.textContent = `${loadedExams.length}개 원본 시험지`;

  container.hidden = false;
  container.innerHTML = `
    <div class="full-exam-header">
      <div>
        <h3>선택 시험지 확인</h3>
      </div>
    </div>
    <div class="full-exam-grid">
      ${loadedExams.map(renderFullExamCard).join('')}
    </div>
  `;
}

function renderFullExamCard(exam) {
  const pages = exam.imageReferences || [];
  return `
    <article class="full-exam-card">
      <div class="full-exam-card-top">
        <strong>${escapeHtml(normalizeExamTitle(exam.title))}</strong>
        <span>${pages.length} page${pages.length === 1 ? '' : 's'}</span>
      </div>
      <section class="original-exam">
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

function renderLoadedExamQuestion(item, index) {
  const question = item.question;
  const sectionTitle = item.showSectionTitle ? escapeHtml(question.sectionTitle || '') : '';
  const sectionText = item.showSectionText ? renderTextBlock(item.sectionText, 'paper-section-text') : '';
  const prompt = renderQuestionPrompt(item.question, 'paper-prompt', item.promptLines);
  const visual = renderPrintableVisual(question);
  const choices = renderPrintableChoices(question);
  const answerLine = shouldRenderExtraAnswerLine(question) ? `<div class="paper-prompt"><span class="paper-answer-line"></span></div>` : '';
  return `
    <section class="paper-question compact">
      <div class="paper-q-top"><span class="paper-qn">${index + 1}.</span><span>${sectionTitle}</span></div>
      ${sectionText}
      ${visual}
      ${prompt}
      ${choices}
      ${answerLine}
    </section>
  `;
}

function prepareQuestionsForDisplay(questions) {
  const prepared = [];
  let previous = null;
  for (const question of questions) {
    const lines = getQuestionPromptLines(question);
    const head = (lines[0] || '').trim();
    const tail = lines.slice(1);
    const sectionTitle = String(question.sectionTitle || '').trim();
    const sectionText = String(question.sectionMaterialText || '').trim();
    const groupKey = `${sectionTitle}|||${sectionText}|||${head}`;
    const hasWordBankHead = looksLikeWordBankLine(head);
    const repeatedInGroup = previous && previous.groupKey === groupKey;
    const normalizedLines = repeatedInGroup && hasWordBankHead ? tail : lines;
    const mergedSectionText = hasWordBankHead && !repeatedInGroup
      ? [sectionText, head].filter(Boolean).join('\n')
      : sectionText;
    prepared.push({
      question: {
        ...question,
        promptLinesRaw: normalizedLines,
      },
      sectionText: mergedSectionText,
      promptLines: normalizedLines,
      showSectionTitle: !previous || previous.sectionTitle !== sectionTitle,
      showSectionText: !previous || previous.groupKey !== groupKey || hasWordBankHead,
      groupKey,
      sectionTitle,
    });
    previous = { groupKey, sectionTitle };
  }
  return prepared;
}

function looksLikeWordBankLine(text) {
  const line = String(text || '').trim();
  if (!line) return false;
  if (/[?.!]/.test(line)) return false;
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return false;
  const alphaOnly = tokens.filter(token => /^[a-zA-Z-]+$/.test(token));
  return alphaOnly.length >= 5;
}

function buildPaperHtml() {
  const selectedTitles = [...new Set(state.sessionQuestions.map(question => normalizeExamTitle(question.examTitle)))];
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

  let previousGroupKey = '';
  const bodyQuestions = state.sessionQuestions.map((question, index) => {
    const group = getQuestionGroup(question);
    const showGroupHeader = group && group.key !== previousGroupKey;
    previousGroupKey = group ? group.key : '';
    return renderPrintableQuestion(question, index, { group, showGroupHeader });
  }).join('');

  const body = `<div class="paper-body">${bodyQuestions}</div>`;

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

function renderPrintableQuestion(question, index, display = {}) {
  const group = display.group || null;
  const sectionText = group ? '' : renderTextBlock(question.sectionMaterialText, 'paper-section-text');
  const visual = renderPrintableVisual(question);
  const choices = renderPrintableChoices(question);
  const answerLine = shouldRenderExtraAnswerLine(question) ? `<div class="paper-prompt"><span class="paper-answer-line"></span></div>` : '';
  const promptQuestion = group?.bankFromPrompt ? withoutPromptWordBank(question) : question;
  return `
    <section class="paper-question">
      ${display.showGroupHeader ? renderQuestionGroupHeader(question, 'paper') : ''}
      <div class="paper-q-top"><span class="paper-qn">${index + 1}.</span><span>${group ? '' : escapeHtml(question.sectionTitle || '')}</span></div>
      ${renderPaperSurface(question)}
      ${sectionText}
      ${visual}
      ${renderQuestionPrompt(promptQuestion, 'paper-prompt')}
      ${choices}
      ${answerLine}
    </section>
  `;
}

function getQuestionGroup(question) {
  const sectionTitle = String(question.sectionTitle || '').trim();
  const sectionText = String(question.sectionMaterialText || '').trim();
  const promptHead = String(getQuestionPromptLines(question)[0] || '').trim();
  const bankText = looksLikeWordBankLine(sectionText) ? sectionText : (looksLikeWordBankLine(promptHead) ? promptHead : '');
  if (!sectionTitle || !bankText) return null;
  return {
    key: `${question.examId}|||${sectionTitle}|||${bankText}`,
    sectionTitle,
    sectionText: bankText,
    bankFromPrompt: bankText === promptHead && bankText !== sectionText,
  };
}

function withoutPromptWordBank(question) {
  const lines = getQuestionPromptLines(question);
  return {
    ...question,
    promptLinesRaw: lines.slice(1),
  };
}

function arrangeSessionQuestions(questions) {
  const buckets = new Map();
  const sequence = [];
  questions.forEach((question, originalIndex) => {
    const group = getQuestionGroup(question);
    if (!group) {
      sequence.push({ type: 'single', originalIndex, question });
      return;
    }
    if (!buckets.has(group.key)) {
      buckets.set(group.key, []);
      sequence.push({ type: 'group', originalIndex, key: group.key });
    }
    buckets.get(group.key).push({ question, originalIndex });
  });
  return sequence.flatMap((item) => {
    if (item.type === 'single') return [item.question];
    return buckets.get(item.key)
      .slice()
      .sort((a, b) => {
        const qn = Number(a.question.questionNumber || 0) - Number(b.question.questionNumber || 0);
        return qn || a.originalIndex - b.originalIndex;
      })
      .map(entry => entry.question);
  });
}

function renderQuestionGroupHeader(question, mode) {
  const group = getQuestionGroup(question);
  if (!group) return '';
  const className = mode === 'paper' ? 'paper-question-group-header' : 'question-group-header';
  return `
    <div class="${className}">
      <div class="group-section-title">${escapeHtml(group.sectionTitle)}</div>
      ${renderWordBank(group.sectionText)}
    </div>
  `;
}

function renderWordBank(text) {
  const tokens = String(text || '').split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';
  return `<div class="word-bank">${tokens.map(token => `<span class="word-bank-chip">${escapeHtml(token)}</span>`).join('')}</div>`;
}

function renderPrintableVisual(question) {
  if (question.surfaceMode === 'page_reference' && question.pageImage) {
    return renderPageReference(question, 'paper');
  }
  if (question.requiresImageReference && question.questionImage && shouldRenderQuestionImage(question)) {
    const isAi = /-ai\.(png|jpg|jpeg|webp)$/i.test(String(question.questionImage || ''));
    const isLevelCrop = isMonsterLevelCrop(question);
    const frameClass = ['paper-image-frame', isAi ? 'ai' : '', isLevelCrop ? 'level-crop' : ''].filter(Boolean).join(' ');
    return `<div class="${frameClass}"><img class="paper-image" src="../${escapeAttr(question.questionImage)}" alt="문항 이미지"></div>`;
  }
  return '';
}

function getQuestionPromptLines(question) {
  const rawLines = Array.isArray(question.promptLinesRaw) ? question.promptLinesRaw : [];
  const cleaned = rawLines.map(line => String(line || '')).filter(line => line.length);
  if (cleaned.length) return cleaned;
  const raw = String(question.promptRaw || question.promptDisplay || '').split(/\n/);
  return raw.map(line => String(line || '')).filter(line => line.length);
}

function formatRichText(value) {
  return escapeHtml(String(value || '')).replace(/(_{2,}|‗{2,}|＿{2,})/g, (token) => {
    const width = Math.max(token.length, 3);
    return `<span class="blank-line" style="width:${width}ch"></span>`;
  });
}

function renderTextBlock(text, className) {
  if (!text) return '';
  let lines = String(text).split(/\n/).filter(line => line.length);
  const compactSingles = lines.filter(line => /^[A-Za-z]$/.test(String(line).trim()));
  if (compactSingles.length >= 5 && compactSingles.length >= Math.ceil(lines.length * 0.7)) {
    lines = [compactSingles.join(' ')];
  }
  if (!lines.length) return '';
  return `<div class="${className} text-block">${lines.map(line => `<div class="text-line">${formatRichText(line)}</div>`).join('')}</div>`;
}

function renderQuestionPrompt(question, className, overrideLines = null) {
  const lines = Array.isArray(overrideLines) ? overrideLines : getQuestionPromptLines(question);
  if (!lines.length) return '';
  return `<div class="${className} text-block">${lines.map(line => `<div class="text-line">${formatRichText(line)}</div>`).join('')}</div>`;
}

function renderQuestionPromptForSolve(question, className) {
  const lines = getQuestionPromptLines(question);
  const fallbackLines = lines.length ? lines : [String(question.sectionTitle || '').trim()].filter(Boolean);
  if (!fallbackLines.length) return '';
  return `<div class="${className} text-block">${fallbackLines.map(line => `<div class="text-line">${formatRichText(line)}</div>`).join('')}</div>`;
}

function shouldRenderExtraAnswerLine(question) {
  return question.answerType === 'short_text' && !question.hasBlank && !question.hasUnderline;
}

function renderPrintableChoices(question) {
  if (!String(question.answerType || '').startsWith('multiple_choice') || !(question.choiceOptions || []).length) {
    return '';
  }
  return `<div class="paper-choices">${question.choiceOptions.map((choice, index) => `<div class="paper-choice"><strong>${escapeHtml(choiceLabel(index, question, choice))}.</strong> ${escapeHtml(choiceText(choice))}</div>`).join('')}</div>`;
}

function renderQuestionVisual(question) {
  if (question.surfaceMode === 'page_reference' && question.pageImage) {
    return renderPageReference(question, 'solve');
  }
  if (question.requiresImageReference && question.questionImage && shouldRenderQuestionImage(question)) {
    const isAi = /-ai\.(png|jpg|jpeg|webp)$/i.test(String(question.questionImage || ''));
    const isLevelCrop = isMonsterLevelCrop(question);
    const frameClass = ['question-image-frame', isAi ? 'ai' : '', isLevelCrop ? 'level-crop' : ''].filter(Boolean).join(' ');
    return `<div class="${frameClass}"><img class="question-image" src="../${escapeAttr(question.questionImage)}" alt="문항 이미지"></div>`;
  }
  return '';
}

function renderPageReference(question, mode) {
  const region = normalizeRegion(question.pageQuestionRegion);
  const unitLabel = question.unitNumber ? `Unit ${escapeHtml(question.unitNumber)}` : '';
  const qLabel = question.unitQuestionNumber ? `${escapeHtml(question.unitQuestionNumber)}번` : `${escapeHtml(question.questionNumber)}번`;
  return `
    <figure class="page-reference ${mode === 'paper' ? 'paper-page-reference' : ''}">
      <div class="page-reference-canvas">
        <img src="../${escapeAttr(question.pageImage)}" alt="${escapeAttr(normalizeExamTitle(question.examTitle))} 원본 페이지">
        <span class="page-question-highlight" style="left:${region.x}%;top:${region.y}%;width:${region.w}%;height:${region.h}%"></span>
      </div>
      <figcaption>${unitLabel}${unitLabel ? ' · ' : ''}${qLabel}</figcaption>
    </figure>
  `;
}

function normalizeRegion(region) {
  const fallback = { x: 6, y: 16, w: 88, h: 16 };
  if (!region || typeof region !== 'object') return fallback;
  const x = Number(region.x);
  const y = Number(region.y);
  const w = Number(region.w);
  const h = Number(region.h);
  const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 1 ? 100 : 1;
  return {
    x: clampPercent(x * scale, fallback.x),
    y: clampPercent(y * scale, fallback.y),
    w: clampPercent(w * scale, fallback.w),
    h: clampPercent(h * scale, fallback.h),
  };
}

function clampPercent(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

function renderMonsterPdfBackground(question) {
  const exam = state.exams.find(item => item.id === question.examId);
  const pages = Array.isArray(exam?.imageReferences) ? exam.imageReferences : [];
  if (!pages.length) return '';
  const qn = Math.max(1, Number(question.questionNumber || 1));
  const pageIndex = resolveMonsterPageIndex(question.examId, qn, pages.length);
  const pagePath = pages[pageIndex];
  return `
    <div class="monster-pdf-bg-wrap">
      <img class="monster-pdf-bg" src="../${escapeAttr(pagePath)}" alt="원본 문제지 배경">
    </div>
  `;
}

function resolveMonsterPageIndex(examId, questionNumber, pageCount) {
  const id = String(examId || '');
  const maps = {
    'phonics-phonics-monster-1-final-test-pdf': [
      [1, 6, 0], [7, 12, 1], [13, 18, 2], [19, 25, 3],
    ],
    'phonics-phonics-monster-2-final-test-pdf': [
      [1, 5, 0], [6, 10, 1], [11, 15, 2], [16, 20, 3],
    ],
    'phonics-phonics-monster-3-final-test-pdf': [
      [1, 5, 0], [6, 10, 1], [11, 15, 2], [16, 20, 3],
    ],
    'phonics-phonics-monster-4-final-test-pdf': [
      [1, 6, 0], [7, 12, 1], [13, 18, 2], [19, 25, 3],
    ],
  };
  const table = maps[id];
  if (table) {
    for (const [start, end, idx] of table) {
      if (questionNumber >= start && questionNumber <= end) {
        return Math.max(0, Math.min(pageCount - 1, idx));
      }
    }
  }
  const fallbackPerPage = Math.max(1, Math.ceil(25 / Math.max(1, pageCount)));
  return Math.max(0, Math.min(pageCount - 1, Math.floor((questionNumber - 1) / fallbackPerPage)));
}

function shouldRenderQuestionImage(question) {
  const imagePath = String(question.questionImage || '');
  if (!imagePath) return false;
  const isMonster = /monster/i.test(String(question.examTitle || '')) || /monster/i.test(String(question.examId || ''));
  if (!isMonster) return true;
  // Hide low-quality bulk placeholders that repeat across many items.
  if (imagePath.includes('/custom-images/monster-clean/')) return true;
  if (imagePath.includes('/custom-images/')) return true;
  if (/-ai\.(png|jpg|jpeg|webp)$/i.test(imagePath)) return true;
  return false;
}

function isMonsterUnit1Style(question) {
  const examId = String(question.examId || '').toLowerCase();
  const title = String(question.examTitle || '').toLowerCase();
  return examId.includes('monster-1') || (title.includes('monster') && title.includes('1'));
}

function isMonsterExam(question) {
  const examId = String(question.examId || '').toLowerCase();
  const title = String(question.examTitle || '').toLowerCase();
  return examId.includes('monster') || title.includes('monster');
}

function isMonsterLevelCrop(question) {
  return String(question.uiMode || '') === 'page_crop_choice'
    || String(question.examId || '').includes('phonics-monster-level-test');
}

function getMonsterAudioLink(question) {
  if (question.audioUrl) return question.audioUrl;
  const exam = state.exams.find(item => item.id === question.examId);
  if (exam?.audioUrl) return exam.audioUrl;
  if (!isMonsterUnit1Style(question)) return '';
  const source = String(question.sourceFile || '').toLowerCase();
  const title = String(question.examTitle || '').toLowerCase();
  const isLevelLike = source.includes('unit test') || title.includes('unit test') || title.includes('midterm') || title.includes('level test');
  if (!isLevelLike) return '';
  return 'http://m.site.naver.com/0kYhF';
}

function renderAudioLink(question, index) {
  const audioLink = getMonsterAudioLink(question);
  if (!audioLink) return '';
  if (!shouldShowInlineAudio(question)) return '';
  return `
    <div class="inline-audio-player">
      <audio controls preload="none" src="${escapeAttr(audioLink)}"></audio>
    </div>
  `;
}

function renderGroupedAudioPlayer(question, shownAudioUrls) {
  const audioLink = getMonsterAudioLink(question);
  if (!audioLink || !shouldShowInlineAudio(question)) return '';
  if (shownAudioUrls.has(audioLink)) return '';
  shownAudioUrls.add(audioLink);
  const unitLabel = question.unitNumber ? `Unit ${escapeHtml(question.unitNumber)} 듣기` : '듣기';
  return `
    <div class="unit-audio-player">
      <div class="unit-audio-label">${unitLabel}</div>
      <audio controls preload="none" src="${escapeAttr(audioLink)}"></audio>
    </div>
  `;
}

function shouldShowInlineAudio(question) {
  if (!isMonsterExam(question)) return false;
  if (Number(question.unitQuestionNumber || 0) > 3) return false;
  return /listen/i.test(String(question.sectionTitle || question.promptDisplay || ''));
}

function renderAnswerInput(question, index) {
  const name = `q-${index}`;
  const group = getQuestionGroup(question);
  if (question.answerType === 'short_text' && group?.sectionText && question.hasBlank) {
    const options = wordBankOptions(group.sectionText);
    if (options.length >= 2) {
      return `
        <div class="word-bank-answer-row">
          ${options.map(option => `
            <label class="word-bank-answer-chip">
              <input type="radio" name="${name}" value="${escapeAttr(option)}">
              <span>${escapeHtml(option)}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
  }
  if ((question.answerType || '').startsWith('multiple_choice') && (question.choiceOptions || []).length) {
    if (question.uiMode === 'page_overlay_choice' || question.uiMode === 'page_crop_choice' || question.surfaceMode === 'page_reference') {
      return `
        <div class="page-choice-row">
          ${question.choiceOptions.map((choice, choiceIndex) => `
            <label class="page-choice-item">
              <input type="${question.answerType.includes('multi') ? 'checkbox' : 'radio'}" name="${name}" value="${escapeAttr(choiceValue(choice, choiceIndex, question))}">
              <span>${choiceIndex + 1}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
    if (isMonsterExam(question) && question.choiceOptions.length <= 4) {
      return `
        <div class="monster-choice-row">
          ${question.choiceOptions.map((choice, choiceIndex) => `
            <label class="monster-choice-item">
              <input type="${question.answerType.includes('multi') ? 'checkbox' : 'radio'}" name="${name}" value="${escapeAttr(choiceValue(choice, choiceIndex, question))}">
              <span>(${escapeHtml(choiceLabel(choiceIndex, question, choice))}) ${escapeHtml(choiceText(choice))}</span>
            </label>
          `).join('')}
        </div>
      `;
    }
    return `
      <div class="choice-list">
        ${question.choiceOptions.map((choice, choiceIndex) => `
          <label class="choice-item">
            <input type="${question.answerType.includes('multi') ? 'checkbox' : 'radio'}" name="${name}" value="${escapeAttr(choiceValue(choice, choiceIndex, question))}">
            <span class="choice-label">${escapeHtml(choiceLabel(choiceIndex, question, choice))}.</span>
            <span>${escapeHtml(choiceText(choice))}</span>
          </label>
        `).join('')}
      </div>
    `;
  }
  return `<input class="short-answer" type="text" name="${name}" placeholder="정답 입력">`;
}

function wordBankOptions(text) {
  return String(text || '')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
}

function choiceText(choice) {
  if (choice && typeof choice === 'object') {
    return String(choice.text ?? choice.value ?? choice.label ?? '');
  }
  return String(choice ?? '');
}

function choiceLabel(index, question, choice = null) {
  if (choice && typeof choice === 'object' && choice.label) {
    return String(choice.label);
  }
  if (String(question.answerType || '').includes('latin')) {
    return String.fromCharCode(97 + index);
  }
  return String(index + 1);
}

function choiceValue(choice, index, question) {
  if (String(question.answerType || '').includes('latin')) {
    return choiceLabel(index, question, choice);
  }
  return choiceText(choice);
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
  const selectedInputs = [...form.querySelectorAll(`[name="${name}"]:checked`)];
  if (selectedInputs.length) {
    return selectedInputs.map(input => input.value).join(', ');
  }
  if ((question.answerType || '').startsWith('multiple_choice') && (question.choiceOptions || []).length) {
    return '';
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
  const planIds = new Set(Object.entries(state.examCountPlan).filter(([, count]) => Number(count) > 0).map(([examId]) => examId));
  const selected = state.exams.filter(exam => planIds.has(exam.id));
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
  document.getElementById('original-view').classList.toggle('hidden', state.currentView !== 'original');
  document.getElementById('show-preview').classList.toggle('active', state.currentView === 'preview');
  document.getElementById('show-solve').classList.toggle('active', state.currentView === 'solve');
  document.getElementById('show-original').classList.toggle('active', state.currentView === 'original');
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
    .paper-question-group-header { break-inside: avoid; border: 1px solid #d7def0; border-radius: 12px; background: #f6f8ff; padding: 10px 12px; margin: 0 0 10px; }
    .group-section-title { font-size: 15px; line-height: 1.35; font-weight: 900; color: #182033; margin-bottom: 8px; }
    .word-bank { display: flex; flex-wrap: wrap; gap: 6px; }
    .word-bank-chip { display: inline-flex; align-items: center; justify-content: center; min-height: 24px; padding: 3px 9px; border: 1px solid #c7d0e4; border-radius: 8px; background: #fff; color: #24314e; font-size: 12px; font-weight: 900; line-height: 1.2; }
    .paper-surface { display: inline-flex; margin-top: 8px; margin-bottom: 8px; padding: 4px 8px; border-radius: 999px; background: #f3f4f8; color: #667189; font-size: 11px; font-weight: 700; }
    .paper-section-text, .paper-fallback-note { white-space: normal; background: #fafbfe; border: 1px solid #edf0f7; border-radius: 12px; padding: 10px 12px; color: #667189; font-size: 13px; line-height: 1.55; margin-bottom: 10px; }
    .paper-image-frame { width: auto; max-width: 100%; border: 0; border-radius: 0; background: transparent; margin: 0 0 10px; overflow: visible; }
    .paper-image-frame.ai { border: 1px solid #e8ebf3; border-radius: 12px; background: #f6f7fb; padding: 6px; width: fit-content; }
    .paper-image { width: auto; height: auto; max-width: min(100%, 340px); max-height: 220px; object-fit: contain; object-position: left top; border: 1px solid #e8ebf3; border-radius: 10px; display: block; background: #fff; }
    .paper-prompt { white-space: normal; font-size: 14px; line-height: 1.65; margin-bottom: 10px; }
    .text-block { display: grid; gap: 2px; }
    .text-line { min-height: 1.2em; }
    .blank-line { display: inline-block; border-bottom: 1.6px solid #222; height: 0.95em; vertical-align: -0.08em; margin: 0 0.06em; }
    .paper-choices { display: grid; gap: 5px; font-size: 13px; color: #364152; margin-left: 22px; margin-bottom: 10px; }
    .paper-choice { padding: 0; border: 0; border-radius: 0; background: transparent; font-weight: 700; line-height: 1.45; }
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
