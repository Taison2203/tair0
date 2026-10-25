/** A small, optional inspection shift. Fictional papers never change the owner's dossier. */
import { bus } from '../core/bus.js';
import { el } from '../core/dom.js';

const VISITORS = [
  {
    name: 'Лидия Корина', number: 'AK-18064', birth: '14.05.1957',
    permitBirth: '14.05.1951', until: '30.11.1982', problem: 'birth',
    explanation: 'Даты рождения расходятся: в паспорте 14.05.1957, в разрешении — 14.05.1951. Въезд нужно отклонить.',
  },
  {
    name: 'Марк Ветров', number: 'AK-30218', birth: '02.09.1954',
    permitBirth: '02.09.1954', until: '12.12.1982', problem: null,
    explanation: 'Имя, номер и дата рождения совпадают. Разрешение действует до 12.12.1982. Посетителя можно пропустить.',
  },
  {
    name: 'Егор Белов', number: 'AK-54102', birth: '19.02.1960',
    permitBirth: '19.02.1960', until: '21.11.1982', problem: 'until',
    explanation: 'Разрешение истекло 21.11.1982, а на посту уже 23.11.1982. Въезд нужно отклонить.',
  },
];

function shuffledVisitors() {
  const visitors = [...VISITORS];
  for (let i = visitors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [visitors[i], visitors[j]] = [visitors[j], visitors[i]];
  }
  return visitors;
}

export function initInspection(audio) {
  const dialog = document.querySelector('#doc-inspection');
  if (!dialog) return;
  const section = dialog.querySelector('.inspection');
  const papers = dialog.querySelector('[data-inspection-papers]');
  const progress = dialog.querySelector('[data-inspection-progress]');
  const feedback = dialog.querySelector('[data-inspection-feedback]');
  const ink = dialog.querySelector('[data-inspection-ink]');
  const actions = dialog.querySelector('[data-inspection-actions]');
  const next = dialog.querySelector('[data-inspection-next]');
  const scanner = document.querySelector('.scanner');
  let visitors = shuffledVisitors();
  let index = 0;
  let score = 0;
  let decided = false;
  let finished = false;

  function updateDesk() {
    const completed = finished ? 3 : index + Number(decided);
    if (!finished) progress.textContent = `Посетитель ${index + 1} из 3 · верных решений: ${score}`;
    scanner.querySelector('.scanner__status').textContent = completed
      ? `ПРОВЕРЕНО ${completed} ИЗ 3 · ВЕРНО ${score}` : '3 ПОСЕТИТЕЛЯ · 2 ДОКУМЕНТА';
    scanner.querySelector('.scanner__code').textContent = finished ? 'ПОСМОТРЕТЬ ИТОГ СМЕНЫ' : completed ? 'ПРОДОЛЖИТЬ СМЕНУ' : 'НАЙТИ РАСХОЖДЕНИЯ';
    scanner.classList.toggle('is-verified', finished);
  }

  function field(documentName, key, label, value) {
    return el('button', {
      type: 'button', class: 'inspection__field', dataset: { compare: key },
      ariaPressed: 'false', ariaLabel: `${documentName}. ${label}: ${value}. Сравнить`,
    }, el('span', {}, label), el('strong', {}, value));
  }

  function paper(visitor, permit) {
    const name = permit ? 'Разрешение' : 'Паспорт';
    return el('article', { class: 'inspection__paper' + (permit ? ' inspection__paper--permit' : '') },
      el('p', { class: 'inspection__authority' }, permit ? 'МИНИСТЕРСТВО ВЪЕЗДА' : 'РЕСПУБЛИКА АРСТОТЦКА'),
      el('h3', {}, permit ? 'РАЗРЕШЕНИЕ НА ВЪЕЗД' : 'ПАСПОРТ'),
      field(name, 'name', 'ИМЯ', visitor.name),
      field(name, 'number', '№ ПАСПОРТА', visitor.number),
      field(name, 'birth', 'ДАТА РОЖДЕНИЯ', permit ? visitor.permitBirth : visitor.birth),
      field(name, permit ? 'until' : 'country', permit ? 'ДЕЙСТВУЕТ ДО' : 'ГРАЖДАНСТВО', permit ? visitor.until : 'Арстотцка'),
      el('p', { class: 'inspection__serial' }, permit ? 'БЛАНК В-82 · ВРЕМЕННЫЙ ВЪЕЗД' : 'М.В.Д. · ЛИЧНОСТЬ ВЛАДЕЛЬЦА'),
    );
  }

  function renderVisitor() {
    decided = false;
    section.classList.remove('has-verdict');
    section.removeAttribute('data-result');
    dialog.querySelector('.inspection__rules').hidden = false;
    ink.hidden = true;
    papers.replaceChildren(paper(visitors[index], false), paper(visitors[index], true));
    feedback.textContent = 'Документы на столе. Ваше решение?';
    actions.hidden = false;
    actions.querySelectorAll('button').forEach(button => { button.disabled = false; });
    next.hidden = true;
    next.textContent = index === 2 ? 'ЗАВЕРШИТЬ СМЕНУ →' : 'СЛЕДУЮЩИЙ ПОСЕТИТЕЛЬ →';
    updateDesk();
  }

  papers.addEventListener('click', event => {
    const target = event.target.closest('[data-compare]');
    if (!target || finished) return;
    const key = target.dataset.compare;
    papers.querySelectorAll('[data-compare]').forEach(button => {
      const selected = button.dataset.compare === key;
      button.classList.toggle('is-compared', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    audio.play('tick', { gain: .4 });
  });

  actions.addEventListener('click', event => {
    const button = event.target.closest('[data-verdict]');
    if (!button || decided || finished) return;
    // Set the guard before audio/animation so repeated clicks cannot score twice.
    decided = true;
    const visitor = visitors[index];
    const allowed = button.dataset.verdict === 'approve';
    const correct = allowed === !visitor.problem;
    if (correct) score++;
    actions.querySelectorAll('button').forEach(control => { control.disabled = true; });
    actions.hidden = true;
    ink.textContent = allowed ? 'ВЪЕЗД ОДОБРЕН' : 'ВЪЕЗД ЗАПРЕЩЁН';
    ink.dataset.verdict = button.dataset.verdict;
    ink.hidden = false;
    section.dataset.result = correct ? 'correct' : 'wrong';
    section.classList.add('has-verdict');
    papers.querySelectorAll('[data-compare]').forEach(control => {
      control.classList.toggle('is-discrepancy', control.dataset.compare === visitor.problem);
    });
    feedback.textContent = (correct ? 'ВЕРНО. ' : 'ОШИБКА ИНСПЕКТОРА. ') + visitor.explanation;
    next.hidden = false;
    updateDesk();
    audio.play(correct ? 'approve' : 'stamp');
    feedback.focus({ preventScroll: true });
  });

  function finishShift() {
    finished = true;
    section.classList.remove('has-verdict');
    section.removeAttribute('data-result');
    dialog.querySelector('.inspection__rules').hidden = true;
    progress.textContent = 'Смена завершена · все посетители проверены';
    papers.replaceChildren(el('article', { class: 'inspection__report' },
      el('p', {}, 'ВЕДОМОСТЬ УЧЕБНОГО ПОСТА'),
      el('h3', {}, `${score} ИЗ 3`),
      el('p', {}, score === 3 ? 'Без единого нарушения. Отличная работа, инспектор.' : 'Ошибки разобраны. В следующей смене проверьте каждую строку.'),
    ));
    ink.hidden = true;
    actions.hidden = true;
    feedback.textContent = 'Министерство благодарит за внимательность. Чай за свой счёт.';
    next.textContent = 'НОВАЯ УЧЕБНАЯ СМЕНА';
    next.hidden = false;
    updateDesk();
    bus.emit('receipt:print', {
      header: 'УЧЕБНАЯ СМЕНА ЗАКРЫТА', meta: `КПП № 1 · ВЕРНО ${score} ИЗ 3`,
      text: score === 3 ? 'Нарушений в работе инспектора не обнаружено. Допуск к следующей смене одобрен.' : 'Учебные ошибки учтены. Перед следующим решением сверьте данные и срок действия разрешения.',
    });
  }

  next.addEventListener('click', () => {
    audio.play('paper', { gain: .6 });
    if (finished) {
      visitors = shuffledVisitors();
      index = 0;
      score = 0;
      finished = false;
      renderVisitor();
    } else if (index === visitors.length - 1) {
      finishShift();
    } else {
      index++;
      renderVisitor();
    }
    section.scrollTop = 0;
    (papers.querySelector('button') || next).focus({ preventScroll: true });
  });

  function open() {
    if (document.body.dataset.phase === 'shift') bus.emit('doc:open', { key: 'inspection' });
  }
  scanner?.addEventListener('click', open);
  document.querySelector('[data-verify-passport]')?.addEventListener('click', open);
  renderVisitor();
}
