const { merge } = require('lodash');
const coaWebLogin = require('coa-web-login');
const { version } = require('./package.json');
const apiResolvers = require('./api').resolvers;

const resolverMap = {
  Query: {
    version(obj, args, context) { // eslint-disable-line no-unused-vars
      return version;
    },
    user(obj, args, context) {
      return context.cache.get(context.session.id)
        .then((cData) => {
          if (cData && cData.user) {
            const u = cData.user;
            return Promise.resolve({
              id: u.id,
              name: u.name,
              email: u.email,
              position: u.position,
              department: u.department,
              division: u.division,
              supervisor_id: u.supervisor_id,
              supervisor: u.supervisor,
              supervisor_email: u.supervisor_email,
            });
          }
          return Promise.resolve({
            id: null,
            name: null,
            email: null,
            position: null,
            department: null,
            division: null,
            supervisor_id: null,
            supervisor: null,
            supervisor_email: null,
          });
        });
    },
  },
  Mutation: {
    test(obj, args, context) { // eslint-disable-line no-unused-vars
      return 'You have successfully called the test mutation';
    },
  },
};

const loginResolvers = coaWebLogin.graphql.resolvers;

module.exports = merge(
  resolverMap,
  apiResolvers,
  loginResolvers,
);
