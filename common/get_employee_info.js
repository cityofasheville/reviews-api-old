const getDbConnection = require('./db');
const baseUser = require('./base_user');

const getEmployeeInfo = (employeeIds, cache, email = null) => {
  let user = baseUser;
  const conn = getDbConnection('mds');
  let employeeIdsLookup = Promise.resolve(employeeIds);
  if (employeeIds === null || employeeIds.length === 0) {
    // We could check that it's ashevillenc.gov first, actually.
    const query = `select emp_id from amd.ad_info where email_city = '${email}'`;
    employeeIdsLookup = conn.query(query)
      .then((res) => {
        if (res && res.rows && res.rows.length > 0) {
          return Promise.resolve([res.rows[0].empid]);
        }
        throw new Error(`Unable to find employee record for ${email}`);
      });
  }

  const userMap = {};

  return employeeIdsLookup
    .then((empIds) => {
      const needLookup = [];
      const cacheKeys = empIds.map(id => `employee-${id}`);
      return cache.mget(cacheKeys)
        .then((cachedUsers) => {
          cachedUsers.forEach((u, j) => {
            if (u !== undefined) userMap[u.id] = u;
            else {
              needLookup.push(empIds[j]);
            }
          });
          const query = 'select empid, active, position, employee, emp_email, supid, supervisor, '
          + 'deptid, department, divid, division, hire_date, '
          + 'sup_email from internal.employees where empid = ANY($1)';
          return conn.query(query, [needLookup])
            .then((data) => {
              if (data.rows && data.rows.length > 0) {
                data.rows.forEach((e) => {
                  user = Object.assign({}, baseUser, {
                    id: e.empid,
                    active: e.active,
                    name: e.employee,
                    email: e.emp_email,
                    position: e.position,
                    department_id: e.deptid,
                    department: e.department,
                    division_id: e.divid,
                    division: e.division,
                    supervisor_id: e.supid,
                    supervisor_name: e.supervisor,
                    supervisor_email: e.sup_email,
                    hire_date: e.hire_date,
                  });
                  cache.store(`employee-${user.id}`, user); // Should wait to verify, but skip for now.
                  userMap[user.id] = user;
                });
              }
              return Promise.resolve(Object.keys(userMap).map(eid => userMap[eid]));
            })
            .catch((error) => {
              console.log(`Error: ${error}`); // eslint-disable-line no-console
              return Promise.resolve(user);
            });
        });
    });
};

module.exports = getEmployeeInfo;
