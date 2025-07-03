//RETURNS A CORRECT DATE FORMAT
export const correctDateFormat = (date) => {
    return `TO_CHAR(${date}, 'Month DD, YYYY') AS formated_${date}`;
};



