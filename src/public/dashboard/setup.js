// Setup page close button
(() => {
  const button = document.getElementById('closeSetup');
  if (button) {
    button.addEventListener('click', (e) => {
      e.target.closest('#setupPage').remove();
    });
  }
})();
