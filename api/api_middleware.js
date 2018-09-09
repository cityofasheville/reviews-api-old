const parseurl = require('parseurl');
const getDbConnection = require('../common/db');
const cache = require('coa-web-cache');
const logger = require('../common/logger');

const middlewares = [
  // The following code just exercises the session and login
  // modules - it can be deleted in a production app.
  function (req, res, next) {
    if (!req.session) {
      req.session = {};
    }
  
    if (!req.session.views) {
      req.session.views = {};
    }
    const pathname = parseurl(req).pathname;
    req.session.views[pathname] = (req.session.views[pathname] || 0) + 1;
    console.log(`The email here is ${req.session.email}`);
    cache.get(req.session.id)
    .then(sessionId => {
      console.log(`View count is ${JSON.stringify(req.session.views)} for ${sessionId}`);
      next();
    });
  },
  function (req, res, next) { // Get superuser status
    if (req.session && req.session.id) {
      cache.get(req.session.id)
      .then(cacheData => {
        if (cacheData && cacheData.user && cacheData.user.id) {
          const conn = getDbConnection('aws');
          req.session.superuser = false;
          return conn
          .query(`SELECT * FROM checkins.superusers WHERE employee_id = ${cacheData.user.id} limit 1`)
          .then(result => {
            if (result.rows.length === 1) {
              req.session.superuser = result.rows[0].is_superuser !== 0;
              if (req.session.superuser) logger.warn(`Superuser login by ${cacheData.user.email}'`);
            }
            next();
          });
        } else {
          next();
        }
      });
    }
  },
];

module.exports = middlewares;
