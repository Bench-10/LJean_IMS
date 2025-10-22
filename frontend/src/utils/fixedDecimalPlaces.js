
//THIS RETURNS VALUE WITH ONLY TWO DECIMAL PLACES
export default function toTwoDecimals(num) {

  if (num === null || num === undefined || num === '') return '';

  const n = Number(num);

  if (isNaN(n)) return '';


  return parseFloat(n.toFixed(2));

};
