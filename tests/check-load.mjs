// Load-check: amsterdam-undead.html moet zonder JS-fouten laden.
// Draai dit script na elke codewijziging, vóór de gerichte tests.
import { openAmsterdamUndead } from './helpers.mjs';

const { browser, errs } = await openAmsterdamUndead();
console.log('errors:', errs.length ? errs : 'geen');
await browser.close();
process.exit(errs.length > 0 ? 1 : 0);
