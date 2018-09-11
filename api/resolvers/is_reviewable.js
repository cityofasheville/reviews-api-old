

const isReviewable = (e) => {
  const val =  (
    e.active === 'A' && e.position !== null && e.position !== '' &&
    e.email !== null && e.email !== ''
  );
  return val;
};

const notReviewableReason = (e) => {
  let reason = null;
  if (!isReviewable(e)) {
    if (e.Active !== 'A') reason = 'Inactive';
    else if (e.Position === null || e.Position === '') reason = 'No listed position';
    else reason = 'Employee not registered for Employee Check-in';
  }
  return reason;
};

module.exports = {
  isReviewable,
  notReviewableReason
};
