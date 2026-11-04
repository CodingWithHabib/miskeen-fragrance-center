import {
  initializeFirebase,
  signInUser,
  signUpUser,
  resetUserPassword,
  signOutUser,
  onAuthChanged
} from './firebase.js';
import { showToast } from '../config.js';

let initialized = false;
let pendingAction = null;
let unsubscribe = null;

const $ = (id) => document.getElementById(id);

function setMessage(message = '', type = 'error') {
  const element = $('customer-auth-message');
  if (!element) return;
  element.textContent = message;
  element.className = `customer-auth-message ${message ? type : ''}`;
}

function setBusy(isBusy, label = 'Continue') {
  const button = $('customer-auth-submit');
  if (!button) return;
  button.disabled = isBusy;
  button.textContent = isBusy ? 'PLEASE WAIT…' : label;
}

function setMode(mode) {
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const title = $('customer-auth-title');
  const copy = $('customer-auth-copy');
  const submit = $('customer-auth-submit');
  const nameGroup = $('customer-auth-name-group');
  const passwordGroup = $('customer-auth-password-group');
  const confirmGroup = $('customer-auth-confirm-group');
  const switchText = $('customer-auth-switch');
  const resetLink = $('customer-auth-reset');

  if (title) title.textContent = isRegister ? 'Create your account' : isReset ? 'Reset your password' : 'Welcome back';
  if (copy) copy.textContent = isRegister
    ? 'Create an account to review fragrances and place orders.'
    : isReset ? 'Enter your email and we will send a password reset link.'
    : 'Sign in to continue with your customer account.';
  if (submit) submit.textContent = isRegister ? 'CREATE ACCOUNT' : isReset ? 'SEND RESET LINK' : 'SIGN IN';
  if (nameGroup) nameGroup.hidden = !isRegister;
  if (passwordGroup) passwordGroup.hidden = isReset;
  if (confirmGroup) confirmGroup.hidden = !isRegister;
  if (switchText) switchText.hidden = isReset;
  if (resetLink) {
    resetLink.hidden = isRegister;
    resetLink.textContent = isReset ? 'Back to sign in' : 'Forgot password?';
  }
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.authMode === mode);
  });
  $('customer-auth-mode').value = mode;
  setMessage('');
}

function openCustomerAuth(mode = 'login', action = null) {
  const modal = $('customer-auth-modal');
  if (!modal) return;
  if (typeof action === 'function') pendingAction = action;
  setMode(mode);
  modal.hidden = false;
  document.body.classList.add('auth-modal-open');
  $('customer-auth-email')?.focus();
}

function closeCustomerAuth() {
  const modal = $('customer-auth-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('auth-modal-open');
  setMessage('');
  pendingAction = null;
}

function updateCustomerUI(user) {
  window.firebaseCurrentUser = user;
  document.querySelectorAll('[data-customer-guest]').forEach(element => {
    element.hidden = Boolean(user);
  });
  document.querySelectorAll('[data-customer-authenticated]').forEach(element => {
    element.hidden = !user;
  });
  document.querySelectorAll('[data-customer-name]').forEach(element => {
    element.textContent = user?.displayName || user?.email?.split('@')[0] || 'Account';
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  const mode = $('customer-auth-mode')?.value || 'login';
  const email = $('customer-auth-email')?.value.trim() || '';
  const password = $('customer-auth-password')?.value || '';
  const name = $('customer-auth-name')?.value.trim() || '';
  const confirmation = $('customer-auth-confirm')?.value || '';

  setMessage('');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setMessage('Please enter a valid email address.');
    return;
  }
  if (mode === 'reset') {
    setBusy(true);
    const result = await resetUserPassword(email);
    setBusy(false, 'SEND RESET LINK');
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    setMessage('Password reset link sent. Check your email.', 'success');
    return;
  }
  if (password.length < 6) {
    setMessage('Password must be at least 6 characters.');
    return;
  }
  if (mode === 'register' && name.length < 2) {
    setMessage('Please enter your name.');
    return;
  }
  if (mode === 'register' && password !== confirmation) {
    setMessage('Passwords do not match.');
    return;
  }

  setBusy(true);
  const result = mode === 'register'
    ? await signUpUser(email, password, name)
    : await signInUser(email, password);
  setBusy(false, mode === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN');
  if (!result.success) {
    setMessage(result.error);
    return;
  }

  showToast(mode === 'register' ? 'Account created successfully.' : 'Welcome back.', 'success');
  const action = pendingAction;
  pendingAction = null;
  closeCustomerAuth();
  if (typeof action === 'function') action(result.user);
}

async function initializeCustomerAuth() {
  if (initialized) return;
  initialized = true;
  await initializeFirebase();
  const form = $('customer-auth-form');
  form?.addEventListener('submit', handleSubmit);
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.authMode));
  });
  $('customer-auth-close')?.addEventListener('click', closeCustomerAuth);
  $('customer-auth-reset')?.addEventListener('click', () => {
    const mode = $('customer-auth-mode')?.value;
    setMode(mode === 'reset' ? 'login' : 'reset');
  });
  $('customer-auth-signout')?.addEventListener('click', async () => {
    const result = await signOutUser();
    if (!result.success) showToast(result.error, 'error');
  });
  $('customer-auth-modal')?.addEventListener('click', event => {
    if (event.target.id === 'customer-auth-modal') closeCustomerAuth();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('customer-auth-modal')?.hidden) closeCustomerAuth();
  });
  unsubscribe = onAuthChanged(updateCustomerUI);
  setMode('login');
}

function requireCustomerAuth(action) {
  const user = window.firebaseCurrentUser;
  if (user) {
    if (typeof action === 'function') action(user);
    return true;
  }
  openCustomerAuth('login', action);
  return false;
}

window.customerAuth = {
  open: openCustomerAuth,
  close: closeCustomerAuth,
  require: requireCustomerAuth,
  signOut: signOutUser
};

export { initializeCustomerAuth, openCustomerAuth, closeCustomerAuth, requireCustomerAuth };
