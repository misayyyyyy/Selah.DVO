document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  const input = document.getElementById(button.dataset.passwordToggle);
  if (!input) return;

  const openEye = button.querySelector('.password-eye-open');
  const closedEye = button.querySelector('.password-eye-closed');

  button.addEventListener('click', () => {
    const showPassword = input.type === 'password';
    input.type = showPassword ? 'text' : 'password';
    button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(showPassword));
    if (openEye) openEye.hidden = showPassword;
    if (closedEye) closedEye.hidden = !showPassword;
    input.focus({ preventScroll: true });
  });
});
