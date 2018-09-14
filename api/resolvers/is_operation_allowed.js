const getDbConnection = require('../../common/db');

const isOperationAllowed = (targetId, context) => {
  const conn = getDbConnection('mds');
  const myId = context.session.employee_id;
  if (myId === undefined) return Promise.resolve(false);
  if (context.session.superuser || myId === targetId) {
    return Promise.resolve(true);
  }
  const query = `
    select case WHEN count(empid) = 1 then true else false end as allowed from (
      WITH RECURSIVE subordinates AS (
        SELECT empid, employee, supid, 0 depth
        FROM internal.employees
        WHERE empid = $1
        UNION
        SELECT
        e.empid, e.employee, e.supid, s.depth + 1 depth
        FROM internal.employees e
        INNER JOIN subordinates s ON s.empid = e.supid
        WHERE depth < 10
      ) SELECT * FROM subordinates
    ) AS A where empid = $2
  `;
  return conn.query(query, [myId, targetId])
    .then((result) => {
      if (result.rows && result.rows.length > 0 && result.rows[0].allowed) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    });
};

module.exports = isOperationAllowed;
