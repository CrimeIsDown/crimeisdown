import { helper } from '@ember/component/helper';

export function json(params /*, hash*/) {
  return JSON.stringify(params[0], null, 2);
}

export default helper(json);
