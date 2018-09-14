const logger = require('../../common/logger');
const getDbConnection = require('../../common/db');
const getEmployeeInfo = require('../../common/get_employee_info');
const { isReviewable, notReviewableReason } = require('./is_reviewable');

const employeesReviewStatusQuery = `
SELECT employee_id,
MAX( CASE WHEN status = 'Closed' THEN status_date ELSE null END) as last_reviewed,
MAX( CASE WHEN status <> 'Closed' THEN checkin_id ELSE null END) as current_review
FROM checkins.checkins 
WHERE employee_id = ANY($1) GROUP BY employee_id
`;

const getAugmentedEmployeeInfo = (employeeIds, context, activeOnly) => {
  const conn = getDbConnection('aws');

  return conn.query(employeesReviewStatusQuery, [employeeIds])
    .then((res) => {
      const rtmp = {};
      res.rows.forEach((r) => {
        const lastRev = (r.last_reviewed === null) ? null : new Date(r.last_reviewed).toISOString();
        rtmp[r.employee_id] = {
          id: r.employee_id,
          current_review: r.current_review,
          last_reviewed: lastRev,
        };
      });

      return getEmployeeInfo(employeeIds, context.cache)
        .then((eList) => {
          const final = eList
            .filter(e => (activeOnly ? e.active === 'A' : true))
            .map((e) => {
              const me = Object.assign({}, e, rtmp[e.id], {
                reviewable: isReviewable(e),
                not_reviewable_reason: notReviewableReason(e),
                review_by: null,
                employees: [],
                reviews: null,
              });
              return me;
            });
          return final;
        });
    })
    .catch((err) => {
      logger.error(`Error getting employees ${err}`);
      return Promise.resolve({ error: `Error getting employee: ${err}` });
    });
};

module.exports = getAugmentedEmployeeInfo;
