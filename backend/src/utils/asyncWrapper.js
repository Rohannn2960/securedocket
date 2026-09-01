/**
 * Higher-order function to catch unhandled Promise rejections in Express controllers
 * Replaces boilerplate try/catch blocks
 */
function asyncWrapper(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncWrapper;
