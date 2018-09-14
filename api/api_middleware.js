const cache = require('coa-web-cache');
const getDbConnection = require('../common/db');
const logger = require('../common/logger');

const middlewares = [
  function checkSuperuser(req, res, next) { // Get superuser status
    if (req.session && req.session.id) {
      cache.get(req.session.id)
        .then((cacheData) => {
          if (cacheData && cacheData.user && cacheData.user.id) {
            const conn = getDbConnection('aws');
            req.session.superuser = false;
            return conn
              .query(`SELECT * FROM checkins.superusers WHERE employee_id = ${cacheData.user.id} limit 1`)
              .then((result) => {
                if (result.rows.length === 1) {
                  req.session.superuser = result.rows[0].is_superuser !== 0;
                  if (req.session.superuser) logger.warn(`Superuser login by ${cacheData.user.email}'`);
                }
                next();
              });
          }
          next();
          return null;
        });
    }
  },
];

module.exports = middlewares;
