// Overrides the importInstance method of utils.js so that it no longer relies
// on chrome and simply returns any constructor that is passed to it.

function importInstance(constructor) {
  return constructor();
}
