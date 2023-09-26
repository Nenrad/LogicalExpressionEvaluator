/*global Logicker:true */
var evaluator, lexer, evalId;

function parse() {
  if (evalId) {
    window.clearTimeout(evalId);
  }
  function deleteChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  evalId = window.setTimeout(function () {
    var el, expr;

    el = document.getElementById("result");
    expr = document.getElementById("code").value;

    deleteChildren(el);
    // try {

    if (typeof evaluator === "undefined") {
      evaluator = new Logicker.Evaluator();
    }
    let table = evaluator.evaluate(expr);

    for (let row of table) {
      let rowEl = document.createElement("tr");
      el.appendChild(rowEl);
      for (let rowEntry of row) {
        let dataEl = document.createElement("td");
        if (typeof rowEntry === "boolean") {
          rowEntry = rowEntry === true ? "true" : "false";
        }
        dataEl.innerText = rowEntry;
        rowEl.appendChild(dataEl);
      }
    }
    // } catch (e) {
    //   // el.textContent = "Error: " + e.toString();
    //   console.log("problem");
    // }
    evalId = undefined;
  }, 345);
}
