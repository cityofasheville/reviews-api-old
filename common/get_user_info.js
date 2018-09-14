const getDbConnection = require('./db');
const getEmployeeInfo = require('./get_employee_info');
const baseUser = require('./base_user');

const getNonCityUser = (isLoggedIn, req, cache) => {
  let user = baseUser;
  if (isLoggedIn) {
    return cache.get(req.session.id)
      .then((cacheData) => {
        user = Object.assign({}, baseUser, { email: req.session.email });
        // user.email = req.session.email;
        cache.store(req.session.id, Object.assign({},
          cacheData, { user })); // Should wait to verify, but skip for now.
        return Promise.resolve(user);
      });
  }
  return Promise.resolve(user);
};

const getUserInfo = (isLoggedIn, enableEmployeeLogins, req, cache) => {
  const isGoogle = (req.session.loginProvider === 'Google');
  if (isLoggedIn && enableEmployeeLogins && isGoogle) {
    let user = {};
    return cache.get(req.session.id)
      .then((cacheData) => {
        if (cacheData !== undefined && cacheData.user !== undefined) {
          ({ user } = cacheData);
        }
        if (user.id === undefined) {
          const conn = getDbConnection('mds');
          const query = `select emp_id from amd.ad_info where email_city = '${req.session.email}'`;
          return conn.query(query)
            .then((res) => {
              // We could check that it's ashevillenc.gov first, actually.
              if (res.rows.length === 0) return getNonCityUser(isLoggedIn, req, cache);
              return getEmployeeInfo([res.rows[0].emp_id], cache, req.session.email)
                .then((u) => {
                  cache.store(req.session.id, Object.assign({},
                    cacheData, { user: u[0] })); // Should verify success, but skip for now.
                  return Promise.resolve(u[0]);
                });
            });
        }
        return Promise.resolve(user);
      });
  }
  return getNonCityUser(isLoggedIn, req, cache);
};

module.exports = getUserInfo;
