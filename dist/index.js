/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 747:
/***/ ((module) => {

module.exports = require("fs");;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {

// import the fs module, which allows us to do filesystem operations
// fs comes from nodejs, this is impossible with normal javascript
// running in a browser.
// You do not need to install this dependency, it is part of the
// standard library.
const fs = __nccwpck_require__(747);
// Function to read and parse a JSON
function readJSON(filename) {
    // read in the file
    const rawdata = fs.readFileSync(filename);
    // parse the JSON into a mapping
    const benchmarkJSON = JSON.parse(rawdata);
    // return it
    return benchmarkJSON;
}
// Create a markdown message from the two JSON.
function createMessage(benchmark, comparisonBenchmark) {
    let message = "## Result of Benchmark Tests\n";
    // Table Title
    message += "| Key | Current PR | Default Branch |\n";
    // Table Column Definitions
    message += "| :--- | :---: | :---: |\n";
    for (const key in benchmark) {
        // First Column: The key
        // Please note the ` instead of ". This is TypeScripts
        // format string. Everything in ${ } will be replaced.
        message += `| ${key}`;
        // Second column: the value with 2 digits
        const value = benchmark[key];
        message += `| ${value.toFixed(2)}`;
        // Third column: the comparison value.
        // If this does not work out (e.g. because the key is not defined),
        // just output nothing
        try {
            const oldValue = comparisonBenchmark[key];
            message += `| ${oldValue.toFixed(2)}`;
        }
        catch (error) {
            console.log("Can not read key", key, "from the comparison file.");
            message += "| ";
        }
        message += "| \n";
    }
    return message;
}
// read in the created JSON file
const benchmark = readJSON("benchmark.json");
// read it in again - you can also create a second file if you want
const comparisonBenchmark = readJSON("benchmark.json");
// Create the message
const message = createMessage(benchmark, comparisonBenchmark);
// Log it to the terminal
console.log(message);

})();

module.exports = __webpack_exports__;
/******/ })()
;