(function () {
  'use strict';

  var dialog = document.getElementById('lightbox');
  if (dialog && typeof dialog.showModal === 'function') {
    var img = dialog.querySelector('.lb-img');
    var caption = dialog.querySelector('.lb-caption');
    var close = dialog.querySelector('.lb-close');

    Array.prototype.forEach.call(document.querySelectorAll('.zoomable'), function (button) {
      button.addEventListener('click', function () {
        img.src = button.dataset.zoom || button.querySelector('img').src;
        img.alt = button.querySelector('img').alt || '';
        caption.textContent = button.dataset.caption || '';
        dialog.showModal();
      });
    });

    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', function () {
      img.removeAttribute('src');
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (button) {
    button.addEventListener('click', function () {
      var target = document.querySelector(button.dataset.copy);
      if (!target || !navigator.clipboard) return;
      navigator.clipboard.writeText(target.textContent).then(function () {
        var old = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(function () { button.textContent = old; }, 1200);
      });
    });
  });
})();
