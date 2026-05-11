function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function checkCode(input, expected) {
  return String(input).trim() === String(expected).trim();
}

module.exports = { generateCode, checkCode };
