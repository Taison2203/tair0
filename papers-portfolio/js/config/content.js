// Данные портфолио и стабильные значения формы. Перевод интерфейса: english.js / core/i18n.js.
// Пустое значение ('' / []) = «данных нет»: интерфейс показывает читаемую отметку «ЗАСЕКРЕЧЕНО».
export const CONTENT = {
  owner: { givenName: 'Таир', surname: '' },                 // TODO(user): фамилия
  tabs: [
    { key: 'passport', label: 'ПАСПОРТ', blurb: 'Личные данные кандидата. Предъявите документ.' },
    { key: 'pass',     label: 'ДОПУСК',  blurb: 'Рабочий допуск: подтверждённые компетенции.' },
    { key: 'cases',    label: 'ДЕЛА',    blurb: 'Личные дела: реализованные проекты.' },
    { key: 'contact',  label: 'СВЯЗЬ',   blurb: 'Личное обращение. Заполните бланк и поставьте печать.' },
    { key: 'gallery',  label: 'ГАЛЕРЕЯ', blurb: 'Фотоархив инспектора. Восемь кадров из личного дела.' },
  ],
  cover: { l1: 'ПОРТФОЛИО', l2: 'ИНСПЕКТОРА', sub: 'СПРАВОЧНИК ДЛЯ РЕКРУТЕРОВ' },
  passport: {
    birthYear: 1964,
    heightCm: 185,
    issueYear: 1982,
    citizenship: 'Арстотцка',
    documentCity: 'Павлтон',
    city: 'Павлтон',
    major: 'Информационные системы',
    photo: 'assets/img/inspector.png',
    pixelArt: true,
    stampTexts: ['ПРОВЕРЕНО', 'СВЕРЕНО', 'ОТДЕЛ ИС'],
  },
  workPass: [
    { key: 'networks',  title: 'Сети',          items: ['Cisco Packet Tracer', 'Inter-VLAN', 'STP', 'EtherChannel'] },
    { key: 'databases', title: 'Базы данных',   items: ['3НФ', 'ER-моделирование', 'IDEF1X'] },
    { key: 'hardware',  title: 'Оборудование',  items: ['Arduino', 'ESP32', 'RFID RC522'] },
    { key: 'analytics', title: 'Аналитика',     items: ['UML-диаграммы', 'SDLC'] },
  ],
  cases: [
    { no: '0001', title: 'Автоматический лазерный уничтожитель насекомых', tags: ['ESP32'],  summary: '', links: [] },
    { no: '0002', title: 'Разработка искусственного интеллекта',           tags: [],         summary: '', links: [] },
    { no: '0003', title: 'Игровые механики Roblox',                         tags: ['Roblox'], summary: '', links: [] },
  ],
  contact: { email: '', telegram: '@tair0_bot', endpoint: '/api/contact', purposes: ['Стажировка', 'Проект', 'Вопрос', 'Отзыв'] },
  receipts: {
    penalty:   'НАРУШЕНИЕ ПОРЯДКА: выдано предупреждение',
    duplicate: 'ОТКАЗАНО: Несанкционированное копирование для соседа по парте запрещено',
  },
  ezic: { secret: 'THE ORDER REMEMBERS WRITE TO ME', key: 'EZIC' },
  footer: 'Фанатское портфолио по мотивам Papers, Please. Не связано с создателями игры.',
};
