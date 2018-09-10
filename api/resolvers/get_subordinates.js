const getDbConnection = require('../common/db');

const isReviewable = (e) => {
  return (
    e.active === 'A' && e.position !== null && e.position !== '' &&
    e.email !== null && e.email !== ''
  );
};

const notReviewableReason = (e) => {
  let reason = null;
  if (!isReviewable(e)) {
    if (e.Active !== 'A') reason = 'Inactive';
    else if (e.Position === null || e.Position === '') reason = 'No listed position';
    else reason = 'Employee not registered for Employee Check-in';
  }
  return reason;
};

const subordinateReviewStatusQuery = `
  SELECT employee_id,
  MAX( CASE WHEN status = 'Closed' THEN status_date ELSE null END) as last_reviewed,
  MAX( CASE WHEN status <> 'Closed' THEN checkin_id ELSE null END) as current_review
  FROM checkins.checkins 
  WHERE supervisor_id = $1 GROUP BY employee_id
`;

const getSubordinates = (id, asSupervisor, context, logger) => {
  // First get all the supervised employees
  const conn = getDbConnection('aws');
  return conn
  .query(subordinateReviewStatusQuery, [id])
  .then(res => {
    const ids = [];
    const rtmp = {};
    res.rows.forEach(r => {
      const lastRev = (r.last_reviewed === null) ? null : new Date(r.last_reviewed).toISOString();
      ids.push(r.employee_id);
      rtmp[r.employee_id] = {
        id: r.employee_id,
        current_review: r.current_review,
        last_reviewed: lastRev,
      };
    });
    // HERE
    return cacheGetEmployees(ids, context, logger)
    .then(eList => {
      return eList
      .filter(e => {
        return e.active === 'A';
      })
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
    });
  })
  .catch(err => {
    logger.error(`Error getting employees ${err}`);
    return Promise.resolve({ error: `Error getting employee: ${err}` });
  });
};
module.exports = getSubordinates;