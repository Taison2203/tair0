const id = location.search.slice(1);
const photo = document.querySelector('img');
const status = document.querySelector('[role=status]');
function unavailable() {
  status.textContent = 'Не удалось открыть фотографию. Проверьте ссылку или попробуйте позже.';
}
if (/^[a-f0-9]{32}$/.test(id)) {
  photo.onload = () => {
    photo.hidden = false;
    status.hidden = true;
  };
  photo.onerror = unavailable;
  photo.src = 'https://tair-portfolio-api.q5yhpcm78q.chatgpt.site/api/board/files/' + id;
} else {
  unavailable();
}
