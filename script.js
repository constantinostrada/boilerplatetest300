// Counter application
;(() => {
  let count = 0
  const MAX_HISTORY = 20

  // ─── Element references ──────────────────────────────────────────────────────
  const counterValue = document.getElementById('counter-value')
  const counterDisplay = document.getElementById('counter-display')
  const stepInput = document.getElementById('step-input')
  const incrementBtn = document.getElementById('increment-btn')
  const decrementBtn = document.getElementById('decrement-btn')
  const resetBtn = document.getElementById('reset-btn')
  const stepIncreaseBtn = document.getElementById('step-increase')
  const stepDecreaseBtn = document.getElementById('step-decrease')
  const historyList = document.getElementById('history-list')
  const clearHistoryBtn = document.getElementById('clear-history-btn')

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function getStep() {
    const val = parseInt(stepInput.value, 10)
    return Number.isFinite(val) && val >= 1 ? val : 1
  }

  function updateDisplay() {
    counterValue.textContent = count.toLocaleString()

    // Color coding
    counterValue.classList.toggle('is-positive', count > 0)
    counterValue.classList.toggle('is-negative', count < 0)
    counterDisplay.classList.toggle('is-positive', count > 0)
    counterDisplay.classList.toggle('is-negative', count < 0)

    // Bump animation
    counterValue.classList.remove('bump')
    // Force reflow so the animation re-triggers
    void counterValue.offsetWidth
    counterValue.classList.add('bump')

    // Remove class after transition
    counterValue.addEventListener('transitionend', () => counterValue.classList.remove('bump'), { once: true })
  }

  function addHistoryEntry(action, value) {
    // Remove "no actions" placeholder
    const empty = historyList.querySelector('.history-empty')
    if (empty) empty.remove()

    const item = document.createElement('li')
    item.className = 'history-item'

    const actionSpan = document.createElement('span')
    actionSpan.className = `history-item__action ${action}`
    actionSpan.textContent = action.charAt(0).toUpperCase() + action.slice(1)

    const valueSpan = document.createElement('span')
    valueSpan.className = 'history-item__value'
    valueSpan.textContent = value.toLocaleString()

    item.appendChild(actionSpan)
    item.appendChild(valueSpan)

    // Prepend so the latest entry is at the top
    historyList.insertBefore(item, historyList.firstChild)

    // Keep history bounded
    const items = historyList.querySelectorAll('.history-item')
    if (items.length > MAX_HISTORY) {
      items[items.length - 1].remove()
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────
  function increment() {
    count += getStep()
    updateDisplay()
    addHistoryEntry('increment', count)
  }

  function decrement() {
    count -= getStep()
    updateDisplay()
    addHistoryEntry('decrement', count)
  }

  function reset() {
    count = 0
    updateDisplay()
    addHistoryEntry('reset', count)
  }

  // ─── Step input controls ─────────────────────────────────────────────────────
  function increaseStep() {
    const current = getStep()
    stepInput.value = current + 1
  }

  function decreaseStep() {
    const current = getStep()
    if (current > 1) stepInput.value = current - 1
  }

  function sanitiseStep() {
    const val = parseInt(stepInput.value, 10)
    stepInput.value = Number.isFinite(val) && val >= 1 ? val : 1
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Ignore when focus is on an input
    if (e.target.tagName === 'INPUT') return

    if (e.key === 'ArrowUp' || e.key === '+') increment()
    if (e.key === 'ArrowDown' || e.key === '-') decrement()
    if (e.key === 'r' || e.key === 'R') reset()
  })

  // ─── Event listeners ─────────────────────────────────────────────────────────
  incrementBtn.addEventListener('click', increment)
  decrementBtn.addEventListener('click', decrement)
  resetBtn.addEventListener('click', reset)
  stepIncreaseBtn.addEventListener('click', increaseStep)
  stepDecreaseBtn.addEventListener('click', decreaseStep)
  stepInput.addEventListener('change', sanitiseStep)
  stepInput.addEventListener('blur', sanitiseStep)

  clearHistoryBtn.addEventListener('click', () => {
    historyList.innerHTML = '<li class="history-empty">No actions yet</li>'
  })

  // ─── Init ─────────────────────────────────────────────────────────────────────
  updateDisplay()
})()
