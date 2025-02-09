var clc = require("cli-color");
const { env } = require("process");

function log(message, level) {
  if (env.NODE_ENV === "development") {
    switch (level) {
      case "info":
        console.log(clc.green.bold(message));
        break;
      case "warn":
          console.log(clc.yellow.bold(message));
          break;
      case "error":
        console.log(clc.red.bold(message) + "\n\n");
        break;
      default:
        console.log(message);
    }
  } else {
    console.log(message)
  }
}

module.exports = { log };