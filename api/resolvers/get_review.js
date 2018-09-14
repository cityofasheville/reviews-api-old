const getDbConnection = require('../../common/db');
const getEmployeeInfo = require('../../common/get_employee_info');
const logger = require('../../common/logger');

const getReview = (id, context) => {
  const conn = getDbConnection('aws');
  const cQuery = 'SELECT * FROM checkins.checkins WHERE checkin_id = $1 ';
  return conn.query(cQuery, [id])
    .then((res) => {
      const r = res.rows[0];
      const lastRevQuery = `
        SELECT MAX(period_end) AS previous_date
        FROM checkins.checkins
        WHERE employee_id = ${r.employee_id} AND period_end < '${r.period_end.toISOString()}'
      `;
      return conn.query(lastRevQuery)
        .then((lRes) => {
          let previousReviewDate = null;
          if (lRes.rows[0].previous_date !== null) {
            previousReviewDate = lRes.rows[0].previous_date.toISOString();
          }
          const review = {
            id: r.checkin_id,
            status: r.status,
            status_date: r.status_date,
            employee_id: r.employee_id,
            supervisor_id: r.supervisor_id,
            position: r.position,
            periodStart: null, // Currently not in use
            periodEnd: r.period_end.toISOString(),
            previousReviewDate,
            employee_name: null,
            employee_email: null,
            reviewer_name: null,
            reviewer_email: null,
            questions: [],
            responses: [],
          };
          return getEmployeeInfo([r.employee_id, r.supervisor_id], context.cache)
            .then((eList) => {
              eList.forEach((itm) => {
                if (itm.id === r.employee_id) {
                  review.employee_name = itm.name;
                  review.employee_email = itm.email;
                } else if (itm.id === r.supervisor_id) {
                  review.reviewer_name = itm.name;
                  review.reviewer_email = itm.email;
                }
              });
              const qQuery = `SELECT
                  Q.question_id, Q.qt_type, q.qt_question, Q.answer, Q.required,
                  R.response
                FROM checkins.questions AS Q LEFT OUTER JOIN
                checkins.responses AS R ON R.question_id = Q.question_id
                WHERE Q.checkin_id = ${review.id}
                ORDER BY Q.qt_order ASC
              `;
              return conn.query(qQuery)
                .then((qres) => {
                  qres.rows.forEach((qr) => {
                    review.questions.push({
                      id: qr.question_id,
                      type: qr.qt_type,
                      question: qr.qt_question,
                      answer: qr.answer,
                      require: qr.required,
                    });
                    review.responses.push({
                      question_id: qr.question_id,
                      review_id: review.id,
                      Response: qr.response,
                    });
                  });
                  return Promise.resolve(review);
                });
            });
        });
    })
    .catch((error) => {
      logger.error(error);
      throw new Error(`Error getting check-in: ${error}`);
    });
};

module.exports = getReview;
