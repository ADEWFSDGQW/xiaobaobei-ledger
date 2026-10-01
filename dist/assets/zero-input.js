// Clear zero values on focus so users can type without deleting the default.
(function () {
  function eligible(input) {
    return input instanceof HTMLInputElement && input.type === 'number'
      && !input.disabled && !input.readOnly
      && (input.closest('#app') || input.closest('.role-gold-dialog'));
  }
  document.addEventListener('focus', function (event) {
    const input = event.target;
    if (!eligible(input) || !/^[-+]?0(?:\.0+)?$/.test(input.value.trim())) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
  document.addEventListener('blur', function (event) {
    const input = event.target;
    if (!eligible(input) || input.value.trim() !== '' || input.validity.badInput) return;
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
})();
