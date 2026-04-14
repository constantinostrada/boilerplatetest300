// Basic JavaScript functionality
console.log('Hello from boilerplatetest300!')

// ── Dark mode toggle ──────────────────────────────────────────────────────────
const THEME_KEY = 'theme'
const DARK = 'dark'
const LIGHT = 'light'

const themeToggle = document.getElementById('theme-toggle')
const themeLabel = themeToggle.querySelector('.theme-toggle__label')

function isDark() {
  return document.documentElement.getAttribute('data-theme') === DARK
}

function applyTheme(theme) {
  if (theme === DARK) {
    document.documentElement.setAttribute('data-theme', DARK)
    themeLabel.textContent = 'Light mode'
    themeToggle.setAttribute('aria-pressed', 'true')
  } else {
    document.documentElement.removeAttribute('data-theme')
    themeLabel.textContent = 'Dark mode'
    themeToggle.setAttribute('aria-pressed', 'false')
  }
}

function toggleTheme() {
  const next = isDark() ? LIGHT : DARK
  localStorage.setItem(THEME_KEY, next)
  applyTheme(next)
}

// Sync label/aria with the theme already applied by the inline script
applyTheme(localStorage.getItem(THEME_KEY) === DARK ? DARK : LIGHT)

themeToggle.addEventListener('click', toggleTheme);

let count = 0;
const counterValue = document.getElementById('counter-value');

document.getElementById('increment-btn').addEventListener('click', () => {
    count += 200;
    counterValue.textContent = count;
});

document.getElementById('decrement-btn').addEventListener('click', () => {
    count -= 200;
    counterValue.textContent = count;
});

document.getElementById('multiply-btn').addEventListener('click', () => {
    count *= 10;
    counterValue.textContent = count;
});