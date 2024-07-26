export const ensureUniqueNames = (headers) => {
    const duplicateHeadersExist = (new Set(headers).size!== headers.length)
    if (!duplicateHeadersExist) {
        return headers
    }
    let incremental = []
    for (const each of headers) {
        if (incremental.includes(each)) {
            let startNumber = 1
            let nextAttempt = `${each}${startNumber}`
            while (incremental.includes(nextAttempt)) {
                startNumber+=1
                nextAttempt = `${each}${startNumber}`
            }
            incremental.push(nextAttempt)
        } else {
            incremental.push(each)
        }
    }
    return incremental
}

/**
 * Converts an array/iterable of objects into array-of-arrays (array of rows) with headers as the first row, and gives a consistent length to all rows
 *
 * If the input data is an array of objects, the function will detect the unique keys across all objects and use those as the column headers. If the input data is an array of arrays, they will simply be padded (mutated) as needed
 *
 * @param {[Object]} data - The input data to be converted to a CSV-like 2D array
 * @param {Array} [defaultHeaders=[]] - An optional array of default column headers. These will always be in the front, and newly discovered headers will be appended to the end
 * @returns {[Array]} - A 2D array representing the rows of data, with each row being an array of values.
 */
export const rowify = (data, { defaultHeaders=[] }={}) => {
    let rows = data
    const headers = [...defaultHeaders]
    rows = [headers]
    for (const eachRow of data) {
        if (eachRow instanceof Array) {
            rows.push(eachRow)
        } else {
            for (const eachKey of Object.keys(eachRow)) {
                if (!headers.includes(eachKey)) {
                    headers.push(eachKey)
                }
            }
            rows.push(
                headers.map(eachKey=>eachRow[eachKey])
            )
        }
    }
    // pad out rows as needed
    for (const eachRow of rows) {
        while (eachRow.length < headers.length) {
            eachRow.push(null)
        }
    }
    return rows
}