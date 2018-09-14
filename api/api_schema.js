const schema = `
  # the schema allows the following query:
  type Employee {
    id: Int!
    active: Boolean!
    name: String!
    email: String
    position: String
    department: String
    division: String
    current_review: Int
    last_reviewed: String
    reviewable: Boolean
    not_reviewable_reason: String
    review_by: String
    supervisor_id: Int!
    supervisor_name: String
    supervisor_email: String
    employees: [Employee]
    reviews: [Review]
  }

  type Review {
    id: Int!
    status: String!
    status_date: String
    supervisor_id: Int!
    employee_id: Int!
    position: String
    previousReviewDate: String
    periodStart: String
    periodEnd: String
    reviewer_name: String
    employee_name: String
    questions: [Question]
    responses: [Response]
  }

  input ReviewInput {
    status: String!
    periodStart: String
    periodEnd: String!
    questions: [QuestionInput]!
    responses: [ResponseInput]!
  }

  type Question {
    id: Int!
    type: String!
    question: String!
    answer: String
    required: Boolean
  }

  input QuestionInput {
    id: Int!
    answer: String
  }

  type Response {
    question_id: Int
    review_id: Int!
    Response: String
  }

  input ResponseInput {
    question_id: Int
    Response: String
  }

  extend type Query {
    employee ( id: Int ): Employee
    review ( id: Int, employee_id: Int ): Review
  }

  extend type Mutation {
    updateReview (id: Int, review: ReviewInput!): Review
  }
`;

module.exports = schema;
