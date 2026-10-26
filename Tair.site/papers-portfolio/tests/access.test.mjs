import test from 'node:test';
import assert from 'node:assert/strict';
import {translateUI} from '../js/core/i18n.js';
import {ENGLISH} from '../js/config/english.js';
import {CONTENT} from '../js/config/content.js';
import {isCaptureShortcut} from '../js/components/captureProtection.js';

test('localises dynamic handbook and training copy, preserving identifiers',()=>{
  for(const [ru,en] of [
    ['Просмотрено 4 из 5 разделов','Viewed 4 of 5 sections'],
    ['Посетитель 2 из 3 · верных решений: 1','Visitor 2 of 3 · correct decisions: 1'],
    ['ПРОВЕРЕНО 3 ИЗ 3 · ВЕРНО 2','CHECKED 3 OF 3 · CORRECT 2'],
    ['Открыть фото 02: За столом','Open photo 02: At the table'],
    ['Бланк № AB-2203 передан Таиру.','Form no. AB-2203 has been sent to Tair.'],
    ['ФАМИЛИЯ:','SURNAME:'],['185 СМ','185 CM'],['@tair0_bot','@tair0_bot'],
  ]) {assert.equal(translateUI(ru,'en'),en);assert.equal(translateUI(ru,'ru'),ru);}
});
test('English copy has no untranslated Cyrillic and does not change API purpose values',()=>{
  for(const [key,value] of Object.entries(ENGLISH)) {
    assert.ok(value.length>0,key);
    assert.doesNotMatch(value,/[А-Яа-яЁё]/,key);
  }
  const expected=['Стажировка','Проект','Вопрос','Отзыв'];
  assert.deepEqual(CONTENT.contact.purposes,expected);
  assert.deepEqual(CONTENT.contact.purposes.map(value=>translateUI(value)),['Internship','Project','Question','Feedback']);
  assert.deepEqual(CONTENT.contact.purposes,expected);
});
test('recognises exposed capture shortcuts across keyboard layouts',()=>{
  for(const event of [
    {key:'PrintScreen'},{code:'PrintScreen'},
    {key:'#',code:'Digit3',metaKey:true,shiftKey:true},
    {key:'$',code:'Digit4',metaKey:true,shiftKey:true},
    {key:'ы',code:'KeyS',metaKey:true,shiftKey:true},
    {key:'S',ctrlKey:true,shiftKey:true},
  ])assert.equal(isCaptureShortcut(event),true,JSON.stringify(event));
  for(const event of [{key:'s'},{key:'S',shiftKey:true},{key:'c',ctrlKey:true},{key:'F5'},{key:'Tab'}])assert.equal(isCaptureShortcut(event),false,JSON.stringify(event));
});
