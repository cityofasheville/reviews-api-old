const isOperationAllowed = require('./is_operation_allowed');
const getEmployeeInfo = require('../../common/get_employee_info');
const getSubordinates = require('./get_subordinates');

const cache = require('coa-web-cache');
const logger = require('../../common/logger');

const employee = (obj, args, context) => {
  const myId = context.session.user ? context.session.user.id : undefined;
  if (args.hasOwnProperty('id')) {
    return isOperationAllowed(args.id, context)
    .then(isAllowed => {
      if (isAllowed) {
        return getEmployeeInfo (args.id, null, cache)
        .then(r => r[0]);
      }
      throw new Error('Employee query not allowed');
    });
  } else if (myId !== undefined) {
    if (context.employee_id !== null) {
      return getEmployeeInfo(myId, false, cache)
      .then(r => r[0]);
    }
  }
  throw new Error('In employee query - employee_id not set');
}

const subordinates = (obj, args, context) => {
  const id = obj.id;
  return isOperationAllowed(id, context)
  .then(isAllowed => {
    if (isAllowed) {
      return getSubordinates(id, true, context, context.logger);
    }
    throw new Error('Employees query not allowed');
  });
}

module.exports = {
  employee,
  employees: subordinates,
};
