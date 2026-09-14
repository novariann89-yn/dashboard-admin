import { hashPin } from "../src/lib/pin";

const pin = process.argv[2];

if (!pin) {
  console.error("Usage: npm run hash-pin -- <pin>");
  process.exit(1);
}

console.log(hashPin(pin));
