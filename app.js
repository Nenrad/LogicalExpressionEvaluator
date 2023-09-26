// initialize object containing logic of application
var Logicker = Logicker || {};

// define token types
Logicker.token = {
  operator: "Operator",
  Identifier: "Identifier",
  Number: "Number",
};

let identifiers = [];

Logicker.lexer = function () {
  // initialize variables; index is global position within expression, other variables tbd
  let expression = "",
    length = 0,
    index = 0,
    marker = 0,
    T = Logicker.token;

  // define function for reading but not moving to next character; returns x00 if idx >= length; idx is a local index
  function peekNextChar() {
    let idx = index;
    return idx < length ? expression.charAt(idx) : "\x00";
  }

  // define function to read and move to next character
  function getNextChar() {
    idx = index;
    ch = "\x00";
    if (idx <= length) {
      index += 1;
      ch = expression.charAt(idx);
    }
    return ch;
  }

  // define function to detect white space; u0009 is the tab character; u00A0 is the no break space; returns true if white space is detected
  function isWhiteSpace(ch) {
    return ch === "\u0009" || ch == " " || ch == "\u00A0" || ch == "\u0000";
  }

  // define function to detect letters; returns true if letter character is detected
  function isLetter(ch) {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
  }

  // define function to detect digits; returns true if digit is detected
  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  // define function to detect operators; returns true if operator is detected
  function isOperator(ch) {
    return "∧∨⇒~()".indexOf(ch) >= 0;
  }

  // define function to create token given type and value; returns token
  function createToken(type, value) {
    return {
      type: type,
      value: value,
      start: marker,
      end: index - 1,
    };
  }

  // define function to skip white space; increments global index when whitespace is detected
  function skipSpaces() {
    let ch;
    while (index < length) {
      ch = peekNextChar();
      if (!isWhiteSpace(ch)) {
        break;
      }
      getNextChar();
    }
  }

  // define function to view next character and create corresponding token if operator is detected; returns token
  // this function increments global index if operator is detected
  function scanOperator() {
    let ch = peekNextChar();
    return isOperator(ch) ? createToken(T.operator, getNextChar()) : undefined;
  }

  // define function to detect identifiers; everything other than operators are identifiers
  function isIdentifier(ch) {
    return !isOperator(ch) && !isWhiteSpace(ch);
  }

  // define function to view next character and create corresponding token if identifier is detected; returns token
  // this function incremenents global index if identifier is detected
  function scanIdentifier() {
    let ch, id;

    ch = peekNextChar();
    if (!isIdentifier(ch)) {
      return undefined;
    }

    // strings together consecutive identifiers minus whitespace
    id = getNextChar();
    let i = 0;
    while (true) {
      i++;
      ch = peekNextChar();
      if (!isIdentifier(ch) || isWhiteSpace(ch)) {
        break;
      }
      id += getNextChar();
    }
    if (!identifiers.includes(id)) {
      identifiers.push(id);
    }
    return createToken(T.Identifier, id);
  }

  // resets expression, length, and global index to values for new expression
  function reset(str) {
    expression = str;
    length = str.length;
    index = 0;
    identifiers = [];
  }

  function next() {
    let token;
    skipSpaces();
    if (index >= length) {
      return undefined;
    }

    marker = index;

    token = scanOperator();
    if (typeof token !== "undefined") {
      return token;
    }

    token = scanIdentifier();
    if (typeof token !== "undefined") {
      return token;
    }

    return token;

    throw new SyntaxError("Unknown token from character " + peekNextChar());
  }

  function peek() {
    let token, idx;
    // stores curr index in variable
    idx = index;
    try {
      token = next();
      delete token.start;
      delete token.end;
    } catch (e) {
      token = undefined;
    }
    // resets index to original value
    index = idx;

    return token;
  }

  return {
    reset: reset,
    next: next,
    peek: peek,
    identifiers: identifiers,
  };
};

Logicker.parser = function () {
  let lexer = new Logicker.lexer();
  let T = Logicker.token;

  // define function to match token to operation; returns true if token matches operation
  function matchOp(token, op) {
    return (
      typeof token !== "undefined" &&
      token.type === T.operator &&
      token.value === op
    );
  }

  // define function to parse expression or argument list within parentheses
  function parseArgumentList() {
    let token,
      expr,
      args = [];

    while (true) {
      expr = parseExpression();
      if (typeof expr === "undefined") {
        break;
      }
      args.push(expr);
      token = lexer.peek();
      if (!matchOp(token, ",")) {
        break;
      }
      lexer.next();
    }
    return args;
  }

  function parseFunctionCall(name) {
    let token,
      args = [];

    token = lexer.next();
    if (!matchOp(token, "(")) {
      throw new SyntaxError('Expecting ( in a function call"' + name + '"');
    }

    token = lexer.peek();
    if (!matchOp(token, ")")) {
      args = parseArgumentList();
    }

    token = lexer.next();
    if (!matchOp(token, ")")) {
      throw new SyntaxError('Expecting ) in a function call "' + name + '"');
    }

    return {
      FunctionCall: {
        name: name,
        args: args,
      },
    };
  }

  function parsePrimary() {
    let token, expr;

    token = lexer.peek();

    if (typeof token === "undefined") {
      throw new SyntaxError("Unexpected termination of expression");
    }

    if (token.type === T.Identifier) {
      token = lexer.next();
      return {
        Identifier: token.value,
      };
    }

    if (matchOp(token, "(")) {
      lexer.next();
      expr = parseAssignment();
      token = lexer.next();
      if (!matchOp(token, ")")) {
        throw new SyntaxError("Expecting )");
      }
      return {
        Expression: expr,
      };
    }

    throw new SyntaxError("Parse error, cannot process token " + token.value);
  }

  function parseUnary() {
    let token, expr;

    // peek next token for condition
    token = lexer.peek();
    if (matchOp(token, "~")) {
      // condition met; increment token
      token = lexer.next();
      // recursion to handle successive negations (~~~...)
      expr = parseUnary();
      return {
        Unary: {
          operator: token.value,
          expression: expr,
        },
      };
    }

    return parsePrimary();
  }

  function parseBinary() {
    let expr, token;

    // check for negations first
    expr = parseUnary();
    // peek next token for condition
    token = lexer.peek();
    while (matchOp(token, "⇒") || matchOp(token, "∧") || matchOp(token, "∨")) {
      // condition met; increment token
      token = lexer.next();
      expr = {
        Binary: {
          operator: token.value,
          left: expr,
          right: parseUnary(),
        },
      };
      // peek next token for condition
      token = lexer.peek();
    }
    return expr;
  }

  function parseAssignment() {
    let token, expr;

    expr = parseBinary();

    if (typeof expr !== "undefined" && expr.Identifier) {
      token = lexer.peek();
      if (matchOp(token, "=")) {
        lexer.next();
        return {
          Assignment: {
            name: expr,
            value: parseAssignment(),
          },
        };
      }
      return expr;
    }

    return expr;
  }

  function parseExpression() {
    return parseAssignment();
  }

  function parse(expression) {
    let expr, token;

    lexer.reset(expression);
    expr = parseExpression();

    token = lexer.next();
    if (typeof token !== "undefined") {
      throw new SyntaxError("Unexpected token " + token.value);
    }

    return {
      Expression: expr,
    };
  }

  return {
    parse: parse,
  };
};

Logicker.Evaluator = function (ctx) {
  let lexer = new Logicker.lexer(),
    parser = new Logicker.parser(),
    variables;

  function logicalAnd(p, q) {
    console.log("left: " + p);
    console.log("right: " + q);
    return p && q;
  }

  function logicalOr(p, q) {
    return p || q;
  }

  function logicalXor(p, q) {
    return (p || q) && !(p && q);
  }

  function logicalNot(p) {
    return !p;
  }

  function conditional(p, q) {
    return !p || q;
  }

  function biconditional(p, q) {
    return (!p || q) && (!q || p);
  }

  function exec(node, combination) {
    let left, right, expr;

    function assignValue(identifier) {
      return combination[identifiers.indexOf(identifier)];
    }

    if (node.hasOwnProperty("Expression")) {
      return exec(node.Expression, combination);
    }

    if (node.hasOwnProperty("Identifier")) {
      return assignValue(node.Identifier);
    }

    if (node.hasOwnProperty("Binary")) {
      node = node.Binary;
      left = exec(node.left, combination);
      right = exec(node.right, combination);

      switch (node.operator) {
        case "⇒":
          return conditional(left, right);
        case "∨":
          return logicalOr(left, right);
        case "∧":
          return logicalAnd(left, right);
        default:
          throw new SyntaxError("Unknown operator " + node.operator);
      }
    }

    if (node.hasOwnProperty("Unary")) {
      node = node.Unary;
      expr = exec(node.expression, combination);
      switch (node.operator) {
        case "~":
          return logicalNot(expr);
        default:
          throw new SyntaxError("Unknown operator " + node.operator);
      }
    }

    throw new SyntaxError("Unknown syntax node");
  }

  /* 
function to generate truth value combinations in a 2D array given an array of variables. 
i.e. for variables p and q, it returns [[true, true], [true, false], [false, true], [false, false]]
*/
  function truthCombinations(variables) {
    let numOfVariables = variables.length;
    let numOfCombinations = 2 ** numOfVariables;

    // initialize arrray of proper size
    let combinations = Array.from({ length: numOfCombinations }).map(() =>
      Array.from({ length: numOfVariables }).fill(0)
    );

    numOfEachValue = numOfCombinations;
    for (let i = 1; i <= numOfVariables; i++) {
      numOfEachValue = numOfEachValue / 2;
      assigningValue = true;
      for (let j = 1; j <= combinations.length; j++) {
        combinations[j - 1][i - 1] = assigningValue;
        assigningValue =
          j % numOfEachValue == 0 ? !assigningValue : assigningValue;
      }
    }
    return combinations;
  }

  function appendEachRow(arr1, arr2) {
    return arr1.map((el, index) => {
      return [...el, arr2[index]];
    });
  }

  function evaluate(expr) {
    let tree = parser.parse(expr);
    let combinations = truthCombinations(identifiers);
    let truthValues = combinations.map((combination) => {
      return exec(tree, combination);
    });
    headers = [...identifiers, expr];
    let truthTable = [headers, ...appendEachRow(combinations, truthValues)];
    return truthTable;
  }

  return {
    evaluate: evaluate,
  };
};
