const logger = require('../../common/logger');
const getDbConnection = require('../../common/db');
const getEmployeeInfo = require('../../common/get_employee_info');
const getReview = require('./get_review');
const notify = require('./notify');

const validateStatusTransition = (review, inRev, trueSupervisorId, context) => {
  const r = {
    doSave: false,
    status: review.status,
    transition: null,
    toId: null,
    errorString: null,
  };
  const { status } = review;
  // if (inRev.hasOwnProperty('status')) {
  if (Object.prototype.hasOwnProperty.call(inRev, 'status')) {
    const newStatus = inRev.status;
    if (status !== newStatus) {
      r.doSave = true;
      if (!(newStatus === 'Open' || newStatus === 'Ready'
          || newStatus === 'Acknowledged' || newStatus === 'Closed')) {
        r.error = true;
        r.errorString = `Invalid status ${newStatus}`;
      }
      if (status === 'Open') {
        if (newStatus !== 'Ready') {
          r.errorString = `Invalid status transition from ${status} to ${newStatus}`;
        }
        if (context.employee_id !== trueSupervisorId) {
          r.errorString = 'Only supervisor may modify check-in in Open status';
        }
      } else if (status === 'Ready') {
        if (newStatus !== 'Open' && newStatus !== 'Acknowledged') {
          r.errorString = `Invalid status transition from ${status} to ${newStatus}`;
        }
        if (context.employee_id !== review.employee_id) {
          r.errorString = 'Only employee may modify check-in in Ready status';
        }
      } else if (status === 'Acknowledged') {
        if (newStatus !== 'Open' && newStatus !== 'Closed') {
          r.errorString = `Invalid status transition from ${status} to ${newStatus}`;
        }
        if (context.employee_id !== trueSupervisorId) {
          r.errorString = 'Only supervisor may modify check-in in Acknowledged status';
        }
      } else if (status === 'Closed') {
        r.errorString = 'Status transition from Closed status is not allowed';
      }

      if (status === 'Open') {
        r.transition = 'Ready';
        r.toId = review.employee_id;
      } else if (status === 'Ready') {
        if (newStatus === 'Open') r.transition = 'Reopen';
        else r.transition = 'Acknowledged';
        r.toId = review.supervisor_id;
      } else if (status === 'Acknowledged') {
        if (newStatus === 'Closed') r.transition = 'Closed';
        else r.transition = 'ReopenBySup';
        r.toId = review.employee_id;
      }
      // Update to the new status
      r.status = newStatus;
    }
  }
  return r;
};

const updateReview = (root, args, context) => {
  const conn = getDbConnection('aws');
  const reviewInput = args.review;
  const checkinId = args.id;
  let review;
  let supervisorId;
  let periodEnd;
  let status;
  let employeeInfo;
  let transition;
  let toId;
  let supervisorChangeFlag;
  let toEmail = null;

  // Set initial values from stored review.
  return conn.query('SELECT * from checkins.checkins WHERE checkin_id = $1', [checkinId])
    .then((result) => {
      [review] = result.rows;
      supervisorId = review.supervisor_id;
      periodEnd = review.period_end;
      ({ status } = review);
      // If the user is neither employee or supervisor, there may be a supervisor change.
      if (context.employee_id !== review.employee_id
          && context.employee_id !== review.supervisor_id) {
        supervisorChangeFlag = true;
      }
      return getEmployeeInfo([review.employee_id], context.cache);
    })
    // Load employee information
    .then((e) => {
      [employeeInfo] = e;
      let doSave = false;
      supervisorId = review.supervisor_id;

      if (supervisorChangeFlag) {
        // Supervisor has changed or we have unauthorized save
        if (context.employee_id === employeeInfo.supervisor_id) {
          // Reset the supervisor in the review, there has been a change.
          logger.warn(`Changing the supervisor of this review to current user ${context.email}`);
          supervisorId = employeeInfo.supervisor_id;
        } else {
          logger.error(`Only the supervisor or employee can modify a check-in, ${context.email}`);
          throw new Error(`Only the supervisor or employee can modify a check-in, ${context.email}`);
        }
      }

      // Check that the status transition is OK.
      if (Object.prototype.hasOwnProperty.call(reviewInput, 'status')) {
        const t = validateStatusTransition(review, reviewInput, supervisorId, context);
        if (t.errorString !== null) {
          logger.error(`Check-in update error for user ${context.email}: ${t.errorString}`);
          throw new Error(t.errorString);
        }
        ({ status } = t);
        ({ doSave } = t);
        ({ transition } = t);
        ({ toId } = t);
      }

      if (Object.prototype.hasOwnProperty.call(reviewInput, 'periodEnd')) {
        // Need to validate
        doSave = true;
        ({ periodEnd } = reviewInput);
      }

      if (!doSave) return Promise.resolve({ error: false });

      // Now set up and run the updates
      const queries = [];

      // Questions
      if (reviewInput.questions !== null && reviewInput.questions.length > 0) {
        reviewInput.questions.forEach((q) => {
          const update = 'UPDATE checkins.questions SET answer = $1 WHERE question_id = $2;';
          queries.push(conn.query(update, [q.answer, q.id]));
        });
      }

      // Responses
      if (reviewInput.responses !== null && reviewInput.responses.length > 0) {
        reviewInput.responses.forEach((r) => {
          if (r.question_id === null) {
            const update = `UPDATE checkins.responses SET response = $1
                            HERE checkin_id = $2;`;
            queries.push(conn.query(update, [r.Response, checkinId]));
          } else {
            const update = `UPDATE checkins.responses SET response = $1 
                            WHERE (checkin_id = $2 AND question_id = $3);`;
            queries.push(conn.query(update, [r.Response, checkinId, r.question_id]));
          }
        });
      }

      // Review
      const update = `UPDATE checkins.checkins SET status = $1, period_start = null, 
                      period_end = '${periodEnd}', supervisor_id = $2
                      WHERE checkin_id = $3;`;
      queries.push(conn.query(update, [status, supervisorId, checkinId]));
      return Promise.all(queries);
    })
    // Load the updated review
    .then(() => getReview(review.checkin_id, context))
    .then((updatedReview) => {
      if (transition === null) return Promise.resolve(updatedReview);
      // We have a status transition - trigger a notification.
      toEmail = (toId === employeeInfo.id) ? employeeInfo.email : employeeInfo.supervisor_email;
      return notify(transition, context.email, toEmail)
        .then(() => Promise.resolve(updatedReview));
    })
    .catch((err) => {
      logger.error(`Error updating check-in: ${err}`);
      throw new Error(`Error at check-in update end: ${err}`);
    });
};

module.exports = {
  updateReview,
};
