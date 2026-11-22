const id = location.search.slice(1);
const photo = document.querySelector('img');
const status = document.querySelector('[role=status]');
document.querySelector('#return').addEventListener('click', (event) => {
  event.preventDefault();
  if (history.length > 1) {
    history.back();
    return;
  }
  window.close();
  // A directly shared link may be opened in a tab that cannot be closed by script.
  setTimeout(() => location.assign('/'), 150);
});
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
