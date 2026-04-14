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
})

// ── Contact form ──────────────────────────────────────────────────────────────

const contactForm = document.getElementById('contact-form')
const submitBtn = document.getElementById('submit-btn')
const formSuccess = document.getElementById('form-success')
const formError = document.getElementById('form-error')

/**
 * Validation rules for each field.
 * Each entry maps a field id to a list of { test, message } checks
 * that are evaluated in order — the first failure wins.
 */
const FIELD_RULES = {
    name: [{ test: (v) => v.trim().length > 0, message: 'Name is required.' }],
    email: [
        { test: (v) => v.trim().length > 0, message: 'Email is required.' },
        { test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), message: 'Please enter a valid email address.' },
    ],
    subject: [{ test: (v) => v.trim().length > 0, message: 'Subject is required.' }],
    message: [{ test: (v) => v.trim().length > 0, message: 'Message is required.' }],
}

/** Marks a field as invalid and displays its error message. */
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId)
    const errorEl = document.getElementById(`${fieldId}-error`)
    field.classList.add('is-invalid')
    errorEl.textContent = message
}

/** Clears the error state of a single field. */
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId)
    const errorEl = document.getElementById(`${fieldId}-error`)
    field.classList.remove('is-invalid')
    errorEl.textContent = ''
}

/**
 * Validates all fields defined in FIELD_RULES.
 * @returns {boolean} true when every field passes all its rules.
 */
function validateForm() {
    let isValid = true

    for (const [fieldId, rules] of Object.entries(FIELD_RULES)) {
        const value = document.getElementById(fieldId).value
        const failed = rules.find((rule) => !rule.test(value))

        if (failed) {
            showFieldError(fieldId, failed.message)
            isValid = false
        } else {
            clearFieldError(fieldId)
        }
    }

    return isValid
}

/** Clears field errors as the user corrects their input (real-time feedback). */
Object.keys(FIELD_RULES).forEach((fieldId) => {
    document.getElementById(fieldId).addEventListener('input', () => {
        clearFieldError(fieldId)
        formSuccess.hidden = true
        formError.hidden = true
    })
})

/** Simulates an async API call. Replace with a real fetch() when a backend exists. */
function submitFormData() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate a ~10 % chance of server error so the error path is reachable.
            if (Math.random() < 0.1) {
                reject(new Error('Server error'))
            } else {
                resolve({ ok: true })
            }
        }, 1200)
    })
}

contactForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    // Hide any previous feedback banners.
    formSuccess.hidden = true
    formError.hidden = true

    if (!validateForm()) return

    // Disable the button and show a processing label while the request is in-flight.
    submitBtn.disabled = true
    submitBtn.textContent = 'Sending…'

    try {
        await submitFormData({
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            subject: document.getElementById('subject').value.trim(),
            message: document.getElementById('message').value.trim(),
        })
        contactForm.reset()
        Object.keys(FIELD_RULES).forEach((id) => clearFieldError(id))
        formSuccess.hidden = false
    } catch (_err) {
        formError.hidden = false
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = 'Send Message'
    }
})