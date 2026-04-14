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

document.getElementById('multiply33-btn').addEventListener('click', () => {
    count *= 33;
    counterValue.textContent = count;
});