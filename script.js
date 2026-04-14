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

// Contact form submission
const contactForm = document.getElementById('contact-form');
const successMessage = document.getElementById('success-message');

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Show the success message
    successMessage.classList.remove('hidden');

    // Reset the form fields
    contactForm.reset();

    // Hide the success message after 3 seconds
    setTimeout(() => {
        successMessage.classList.add('hidden');
    }, 3000);
});