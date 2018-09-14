const isOperationAllowed = require('./is_operation_allowed');
const getAugmentedEmployeeInfo = require('./get_augmented_employee_info');
const getDbConnection = require('../../common/db');
const logger = require('../../common/logger');

const employee = (obj, args, context) => {
  if (args.hasOwnProperty('id')) {
    return isOperationAllowed(args.id, context)
      .then((isAllowed) => {
        if (isAllowed) {
          return getAugmentedEmployeeInfo([args.id], context, false)
            .then(e => e[0]);
        }
        throw new Error('Employee query not allowed');
      });
  }
  if (context.session.employee_id !== undefined) {
    return getAugmentedEmployeeInfo([context.session.employee_id], context, false)
      .then(e => e[0]);
  }
  throw new Error('In employee query - employee_id not set');
};

const subordinates = (obj, args, context) => {
  const { id } = obj;
  return isOperationAllowed(id, context)
    .then((isAllowed) => {
      if (isAllowed) {
        const conn = getDbConnection('mds');
        const query = 'select empid, supid from internal.employees where supid = $1';
        return conn.query(query, [id])
          .then((result) => {
            const subordinateIds = result.rows.map(itm => itm.empid);
            return getAugmentedEmployeeInfo(subordinateIds, context, true);
          })
          .catch((err) => {
            logger.error(`Error getting employees ${err}`);
            return Promise.resolve({ error: `Error getting employees: ${err}` });
          });
      }
      throw new Error('Subordinates query not allowed');
    });
};

module.exports = {
  employee,
  employees: subordinates,
};
