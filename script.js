// Basic JavaScript functionality
console.log('Hello from boilerplatetest300!');

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

// Submit button — set the counter to the entered value
function handleSubmit() {
    const input = document.getElementById('submit-input');
    const parsed = parseInt(input.value, 10);
    if (!isNaN(parsed)) {
        count = parsed;
        counterValue.textContent = count;
        input.value = '';
    }
}

document.getElementById('submit-btn').addEventListener('click', handleSubmit);

// Ctrl+Enter keyboard shortcut for the textarea
document.getElementById('submit-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
    }
});