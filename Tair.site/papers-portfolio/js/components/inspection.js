/** A small, optional inspection shift. Fictional papers never change the owner's dossier. */
import { bus } from '../core/bus.js?v=reception-20261119';
import { el } from '../core/dom.js?v=reception-20261119';

import { createInspectionCases } from '../core/inspectionCases.js?v=reception-20261119';
import { getLanguage } from '../core/i18n.js?v=reception-20261119';
const words=(ru,en)=>getLanguage()==='en'?en:ru;

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
  let total=5;
  let visitors = createInspectionCases(total);
  let streak=0, best=0;
  try{best=Number(localStorage.getItem('inspector.training.best.v2'))||0;}catch{}
  const mode=el('div',{class:'inspection__modes'},
    el('button',{type:'button',class:'board-tool',dataset:{trainingMode:'3'}},words('Тренировка · 3 дела','Practice · 3 cases')),
    el('button',{type:'button',class:'board-tool',dataset:{trainingMode:'5'}},words('Смена · 5 дел','Shift · 5 cases')));
  section.querySelector('.inspection__header').append(mode);
  const record=el('p',{class:'inspection__record',dataset:{noTranslate:''}});
  section.querySelector('.inspection__header').append(record);
  function recordText(){record.textContent=words('Серия без ошибок: ','Correct streak: ')+streak+words(' · лучший результат: ',' · personal best: ')+best;}
  mode.addEventListener('click',event=>{const target=event.target.closest('[data-training-mode]');if(!target)return;total=Number(target.dataset.trainingMode);restart();});
  let index = 0;
  let score = 0;
  let decided = false;
  let finished = false;

  function updateDesk() {
    const completed = finished ? total : index + Number(decided);
    if (!finished) progress.textContent = `Посетитель ${index + 1} из ${total} · верных решений: ${score}`;
    scanner.querySelector('.scanner__status').textContent = completed
      ? `ПРОВЕРЕНО ${completed} ИЗ ${total} · ВЕРНО ${score}` : words(total+' посетителей · 2 документа',total+' visitors · 2 documents');
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
      field(name, 'name', 'ИМЯ', permit ? visitor.permitName : visitor.name),
      field(name, 'number', '№ ПАСПОРТА', permit ? visitor.permitNumber : visitor.number),
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
    next.textContent = index === total-1 ? words('ЗАВЕРШИТЬ СМЕНУ','FINISH SHIFT') : words('СЛЕДУЮЩИЙ ПОСЕТИТЕЛЬ','NEXT VISITOR');
    mode.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.trainingMode)===total)));
    recordText();
    updateDesk();
  }
  function restart(){visitors=createInspectionCases(total);index=0;score=0;streak=0;finished=false;renderVisitor();audio.play('paperFeed');}

  papers.addEventListener('click', event => {
    const target = event.target.closest('[data-compare]');
    if (!target || finished || decided) return;
    const key = target.dataset.compare;
    papers.querySelectorAll('[data-compare]').forEach(button => {
      const selected = button.dataset.compare === key;
      button.classList.toggle('is-compared', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const pair=[...papers.querySelectorAll('[data-compare]')].filter(b=>b.dataset.compare===key);
    if(pair.length===2)feedback.textContent=pair[0].querySelector('strong').textContent===pair[1].querySelector('strong').textContent
      ? words('Строки совпадают. Проверьте остальные данные.','These fields match. Check the remaining details.')
      : words('Обнаружено расхождение. Сверьте выделенные строки.','Discrepancy found. Compare the highlighted fields.');
    else feedback.textContent=words('Проверьте срок: разрешение должно действовать на 23.11.1982.','Check validity: the permit must cover 23 Nov 1982.');
    audio.play('compare');
  });

  actions.addEventListener('click', event => {
    const button = event.target.closest('[data-verdict]');
    if (!button || decided || finished) return;
    // Set the guard before audio/animation so repeated clicks cannot score twice.
    decided = true;
    const visitor = visitors[index];
    const allowed = button.dataset.verdict === 'approve';
    const correct = allowed === !visitor.problem;
    if (correct){score++;streak++;}else streak=0;
    if(streak>best){best=streak;try{localStorage.setItem('inspector.training.best.v2',String(best));}catch{}}
    recordText();
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
    const reasons={
      birth:words('Даты рождения в документах различаются.','The birth dates do not match.'),
      name:words('Имя в разрешении отличается от паспорта.','The permit name differs from the passport.'),
      number:words('Номер паспорта в разрешении неверный.','The passport number on the permit is incorrect.'),
      until:words('Срок разрешения истёк до 23.11.1982.','The permit expired before 23 Nov 1982.'),
    };
    feedback.textContent=(correct?words('ВЕРНО. ','CORRECT. '):words('ОШИБКА ИНСПЕКТОРА. ','INSPECTOR ERROR. '))+(reasons[visitor.problem]||words('Данные совпадают, разрешение действительно.','All details match and the permit is valid.'));
    next.hidden = false;
    updateDesk();
    audio.play(correct ? (allowed ? 'approve' : 'deny') : 'buzzer');
    feedback.focus({ preventScroll: true });
  });

  function finishShift() {
    finished = true;
    audio.play('shiftComplete');
    section.classList.remove('has-verdict');
    section.removeAttribute('data-result');
    dialog.querySelector('.inspection__rules').hidden = true;
    progress.textContent = 'Смена завершена · все посетители проверены';
    papers.replaceChildren(el('article', { class: 'inspection__report' },
      el('p', {}, 'ВЕДОМОСТЬ УЧЕБНОГО ПОСТА'),
      el('h3', {}, `${score} ИЗ ${total}`),
      el('p', {}, score === total ? 'Без единого нарушения. Отличная работа, инспектор.' : 'Ошибки разобраны. В следующей смене проверьте каждую строку.'),
    ));
    ink.hidden = true;
    actions.hidden = true;
    feedback.textContent = words('Смена закрыта. Новый набор документов будет отличаться.','Shift closed. The next set of papers will be different.');
    next.textContent = 'НОВАЯ УЧЕБНАЯ СМЕНА';
    next.hidden = false;
    updateDesk();
    bus.emit('receipt:print', {
      header: 'УЧЕБНАЯ СМЕНА ЗАКРЫТА', meta: `КПП № 1 · ВЕРНО ${score} ИЗ ${total}`,
      text: score === total ? 'Нарушений в работе инспектора не обнаружено. Допуск к следующей смене одобрен.' : 'Учебные ошибки учтены. Перед следующим решением сверьте данные и срок действия разрешения.',
    });
  }

  next.addEventListener('click', () => {
    if (finished || index < visitors.length - 1) audio.play('paperFeed');
    if (finished) {
      visitors = createInspectionCases(total);
      streak=0;
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
