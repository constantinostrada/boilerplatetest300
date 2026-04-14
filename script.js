// Basic JavaScript functionality
console.log('Hello from boilerplatetest300!')

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let count = 0

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const counterValueEl = document.getElementById('counter-value')
const incrementBtn = document.getElementById('increment-btn')
const decrementBtn = document.getElementById('decrement-btn')
const multiplyBtn = document.getElementById('multiply-btn')

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * Writes the current counter value to the DOM.
 * Single owner of all counter display updates.
 */
function updateDisplay() {
  counterValueEl.textContent = count
}

// ---------------------------------------------------------------------------
// Operations — pure arithmetic, no DOM side-effects
// ---------------------------------------------------------------------------

/** Adds 200 to the counter. */
function increment() {
  count += 200
}

/** Subtracts 200 from the counter. */
function decrement() {
  count -= 200
}

/** Multiplies the counter by 10. */
function multiply() {
  count *= 10
}

// ---------------------------------------------------------------------------
// Event binding — sole owner of wiring DOM elements to operations
// ---------------------------------------------------------------------------

/**
 * Attaches click listeners to each counter button.
 * Each listener delegates arithmetic to an operation function,
 * then syncs the display through updateDisplay().
 */
function bindEvents() {
  incrementBtn.addEventListener('click', () => {
    increment()
    updateDisplay()
  })

  decrementBtn.addEventListener('click', () => {
    decrement()
    updateDisplay()
  })

  multiplyBtn.addEventListener('click', () => {
    multiply()
    updateDisplay()
  })
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Initialises the counter: renders the initial state and wires up events.
 */
function init() {
  updateDisplay()
  bindEvents()
}

init()
