// Basic JavaScript functionality
console.log('Hello from boilerplatetest300!')

let count = 0
const counterValue = document.getElementById('counter-value')

function updateDisplay() {
  counterValue.textContent = count
  counterValue.classList.toggle('counter-value--positive', count > 0)
  counterValue.classList.toggle('counter-value--negative', count < 0)
}

document.getElementById('increment-btn').addEventListener('click', () => {
  count += 1
  updateDisplay()
})

document.getElementById('decrement-btn').addEventListener('click', () => {
  count -= 1
  updateDisplay()
})

document.getElementById('reset-btn').addEventListener('click', () => {
  count = 0
  updateDisplay()
})
