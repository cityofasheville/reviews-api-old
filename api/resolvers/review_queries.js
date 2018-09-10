
const review = (obj, args, context) => {

}

const reviews = (obj, args, context) => {
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
