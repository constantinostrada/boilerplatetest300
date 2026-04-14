// Basic JavaScript functionality
console.log('Hello from boilerplatetest300!');

// ── Dark mode toggle ──────────────────────────────────────────────────────────
(function initDarkMode() {
    const STORAGE_KEY = 'darkMode';
    const body = document.body;
    const toggleBtn = document.getElementById('dark-mode-toggle');
    const toggleIcon = toggleBtn.querySelector('.toggle-icon');
    const toggleLabel = toggleBtn.querySelector('.toggle-label');

    /** Apply or remove dark mode and keep the button state in sync. */
    function applyDarkMode(isDark) {
        body.classList.toggle('dark-mode', isDark);
        toggleBtn.setAttribute('aria-pressed', String(isDark));
        toggleIcon.textContent = isDark ? '☀️' : '🌙';
        toggleLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }

    /** Persist preference and update the UI. */
    function setDarkMode(isDark) {
        localStorage.setItem(STORAGE_KEY, isDark ? 'enabled' : 'disabled');
        applyDarkMode(isDark);
    }

    /** Read stored preference; fall back to the OS-level preference. */
    function loadPreference() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'enabled') return true;
        if (stored === 'disabled') return false;
        // No explicit preference yet — honour the OS setting.
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Initialise on page load.
    applyDarkMode(loadPreference());

    // Wire up the toggle button.
    toggleBtn.addEventListener('click', () => {
        setDarkMode(!body.classList.contains('dark-mode'));
    });

    // Keep in sync if the OS preference changes while the page is open
    // and the user hasn't yet made an explicit choice.
    window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (e) => {
            if (localStorage.getItem(STORAGE_KEY) === null) {
                applyDarkMode(e.matches);
            }
        });
})();

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