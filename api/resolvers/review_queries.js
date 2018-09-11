const logger = require('../../common/logger');
const getDbConnection = require('../../common/db');
const getEmployeeInfo = require('../../common/get_employee_info');
const getAugmentedEmployeeInfo = require('./get_augmented_employee_info');
const isOperationAllowed = require('./is_operation_allowed');
const getReview = require('./get_review');

const createCurrentReview = (emp, context, logger) => {
  const templateId = 3;
  const t1 = new Date();
  const t1s = `${t1.getFullYear()}-${t1.getMonth() + 1}-${t1.getDate()}`;
  const cInsert = `
    INSERT INTO checkins.checkins
      (template_id, template_name, template_desc, status, status_date, supervisor_id, 
      employee_id, division_id, position, period_start, period_end)
    SELECT template_id, name, description, 'Open', '${t1s}', ${emp.supervisor_id}, ${emp.id},
           '${emp.division_id}', '${emp.position}', null, '${t1s}'
    FROM checkins.review_templates WHERE template_id = ${templateId};
    SELECT currval('checkins.checkins_id_seq') AS checkin_id;
  `;
  const conn = getDbConnection('aws');
  return conn.query(cInsert)
  .then(results => {
    const checkinId = results[1].rows[0].checkin_id;
    console.log(`Created checkin with id ${checkinId}`);
    const qInsert = `
      INSERT INTO checkins.questions
        (template_id, checkin_id, question_template_id, qt_order, qt_type, qt_question, required)
      SELECT ${templateId}, ${checkinId},
             question_template_id, question_order, question_type, question_text, required
      FROM checkins.question_templates
      WHERE template_id = ${templateId};
    `;
    return conn.query(qInsert)
    .then(() => {
      const rInsert = `
        INSERT INTO checkins.responses
          (checkin_id, question_id)
        SELECT ${checkinId}, question_id
        FROM checkins.questions
        WHERE checkin_id = ${checkinId}
      `;
      return conn.query(rInsert)
      .then(() => {
        return getReview(checkinId, context, logger);
      });
    });
  })
  .catch(error => {
    console.log(error);
    throw new Error(`Error creating new checkin: ${error}`);
  });
};

const review = (obj, args, context) => {
  console.log('In review');
  if (args.hasOwnProperty('id') && args.id !== -1) {
    return getReview(args.id, context, logger)
    .then(reviewOut => {
      if (context.employee_id === reviewOut.employee_id) {
        return reviewOut;
      }
      return isOperationAllowed(reviewOut.supervisor_id, context)
      .then(isAllowed => {
        if (isAllowed) {
          return reviewOut;
        }
        throw new Error('Check-in query not allowed');
      });
    })
    .catch(err => {
      logger.error(`Error doing check-in query by ${context.session.email}: ${err}`);
    });
  }

  // Get based on the employee ID
  let employeeId = context.session.employee_id;
  let verifyAllowed = Promise.resolve(true);
  if (args.hasOwnProperty('employee_id')) {
    if (args.employeeId !== employeeId) {
      employeeId = args.employee_id;
      verifyAllowed = operationIsAllowed(employeeId, context);
    }
  }
  return verifyAllowed.then(isAllowed => {
    if (isAllowed) {
      return getAugmentedEmployeeInfo([employeeId], context, false)
      .then(emps => {
        console.log(emps);
        const emp = emps[0];
        const currentReview = emp.current_review;
        if (currentReview === null || currentReview === 0) {
         return createCurrentReview(emp, context, logger);
        }
        return getReview(currentReview, context, logger)
        .catch(err => {
          logger.error(`Error retrieving check-in for ${context.email}: ${err}`);
          throw new Error(err);
        });
      });
    }
    logger.error(`Check-in query not allowed for user ${context.email}`);
    throw new Error(`Check-in query not allowed for user ${context.email}`);
  });
}

const getEmployeeCheckins = (id, context, logger) => {
  const cQuery = `
    SELECT checkin_id, status, status_date, supervisor_id, position, period_start, period_end
    FROM checkins.checkins
    WHERE employee_id = $1
    ORDER BY checkin_id DESC;
  `;
  const conn = getDbConnection('aws');
  return conn.query(cQuery, [id])
  .then(res => {
    const reviews = res.rows;
    const eMap = {};
    eMap[id] = {};
    reviews.forEach(r => { eMap[r.supervisor_id] = {}; });
    return getEmployeeInfo(Object.keys(eMap), context.cache)
    .then(employees => {
      employees.forEach(e => {
        eMap[e.id] = e;
      });
      return reviews.map(r => {
        const e = eMap[id];
        const s = eMap[r.supervisor_id];
        const checkin = {
          id: r.checkin_id,
          status: r.status,
          status_date: new Date(r.status_date).toISOString(),
          supervisor_id: r.supervisor_id, //
          employee_id: id,
          position: r.position,
          periodStart: null, // Currently not in use
          periodEnd: new Date(r.period_end).toISOString(),
          reviewer_name: s.name,
          employee_name: e.name,
          questions: null,
          responses: null,
        };
        return checkin;
      });
    });
  })
  .catch(error => {
    console.log(error);
    throw new Error(`Error in getEmployeeCheckins: ${error}`);
  });
};

const reviews = (obj, args, context) => {
  console.log('In reviews ' + obj.id);
  const id = obj.id;
  return isOperationAllowed(id, context)
  .then(isAllowed => {
    if (isAllowed) {
      return getEmployeeCheckins(id, context);
    }
    logger.error(`Check-ins query not allowed for user ${context.email}`);
    throw new Error('Check-ins query not allowed');
  });

  return [];
}

const questions = (obj, args, context) => {
  if (obj.questions === null) throw new Error('Recursive review questions fetch not implemented');
  return obj.questions;
};

const responses = (obj, args, context) => {
  if (obj.responses === null) throw new Error('Recursive review responses fetch not implemented');
  return obj.responses;
};

module.exports = {
  review,
  reviews,
  questions,
  responses,
};
