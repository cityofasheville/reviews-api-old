const { updateReview } = require('./resolvers/review_mutations');
const { employee, employees } = require('./resolvers/employee_queries');
const { review, reviews, questions, responses } = require('./resolvers/review_queries');

const resolvers = {
  Mutation: {
    updateReview,
  },
  Query: {
    employee,
    review,
  },
  Employee: {
    employees,
    reviews,
  },
  Review: {
    questions,
    responses,
  },
};

module.exports = resolvers;
