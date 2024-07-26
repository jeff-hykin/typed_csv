// import * as csv from "csv/dist/esm/index.js"
import * as yaml from "https://deno.land/std@0.168.0/encoding/yaml.ts"
import { isSyncIterable } from "https://deno.land/x/good@1.7.1.1/flattened/is_sync_iterable.js"
import { iter } from "https://deno.land/x/good@1.7.1.1/flattened/iter.js"
import { stop } from "https://deno.land/x/good@1.7.1.1/flattened/stop_symbol.js"
import { next } from "https://deno.land/x/good@1.7.1.1/flattened/next.js"
import { lazyConcat } from "https://deno.land/x/good@1.7.1.1/flattened/lazy_concat.js"
import { regex } from "https://deno.land/x/good@1.7.1.1/flattened/regex.js"
import { zip } from "https://deno.land/x/good@1.7.1.1/flattened/zip.js"
import { toRepresentation } from "https://deno.land/x/good@1.7.1.1/flattened/to_representation.js"

import { ensureUniqueNames, rowify } from "./helpers.js"
import { csvParseIter } from "./normal_csv.js"

export const toTypedCsv = Symbol()

// small helpers
const w3schoolsIsoDateRegex = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/
const extraIsoDateRegex = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d)/
const simpleDateRegex = /^\d{4}-\d{1,2}-\d{1,2}($| |\t)/
const matchesIso8601Date = (string)=>string.match(w3schoolsIsoDateRegex) || string.match(extraIsoDateRegex)
const matchesReservedPattern = (string)=>{
    return (
        // to allow computed items / equations
        string.startsWith("=") ||
        // to allow regex (yeah yeah i know i know)
        (string.startsWith("/") && string.match(/\/([igmusyv]*)$/)) ||
        // default comment symbol
        string.startsWith(/#/) ||
        // to allow durations and times in the future
        string.match(/^\d+:/) ||
        // to allow dates (no times) either YYYY-MM-DD and DD/MM/YYYY (probably only want to support YYYY-MM-DD, but will reserve both)
        string.match(simpleDateRegex) || string.match(/^\d{1,2}\/\d{1,2}\/\d{1,2}($| |\t)/) ||
        // ISO date
        matchesIso8601Date(string)
    )
}

/**
 * Resolves a value from a CSV cell to a typed JavaScript value.
 * 
 * This function handles various types of values that may appear in a CSV cell,
 * including empty strings, NaN, Infinity, regular expressions, and dates.
 * It uses the YAML parser to handle more complex values like objects and arrays.
 * 
 * @param {string} each - The CSV cell value to be resolved.
 * @returns {any} - The resolved JavaScript value.
 */
export const parseCell = (each)=>{
    const trimmed = each.trim()
    if (trimmed.length == 0) {
        return null
    }
    // nan
    if (trimmed.match(/^\.?nan$/i)) {
        return NaN
    }
    // infinity
    if (trimmed.match(/^-?\.?(inf|infinity)$/i)) {
        if (trimmed.startsWith('-')) {
            return -Infinity
        } else {
            return Infinity
        }
    }
    // regex
    if (trimmed.startsWith("/")) {
        let flags
        if (flags = trimmed.match(/\/([igmusyv]*)$/)) {
            return new RegExp(trimmed.slice(1,-flags[0].length), flags[1])
        }
    }
    // date
    if (each.match(simpleDateRegex) || matchesIso8601Date(each)) {
        return new Date(each)
    }
    // NOTE: durations and times-of-day are not supported in the JS implmentation
    
    // everything else (numbers, boolean, strings, lists, mappings)
    try {
        return yaml.parse(each)
    } catch (error) {
        // failure to parse means its a string literal
        return each
    }
}



/**
 * Escapes a value for inclusion in a CSV cell, handling various data types.
 * 
 * This function ensures that the CSV cell value is properly formatted for the
 * given data type. It handles cases like undefined, null, empty strings,
 * dates, BigInts, and regular expressions, converting them to appropriate
 * string representations. It also uses the YAML library to properly format
 * complex data types like objects and arrays.
 * 
 * @param {any} each - The value to be escaped for the CSV cell.
 * @param {object} [options] - Optional configuration options.
 * @param {boolean} [options.nullAsEmpty=false] - If true, null values are
 * represented as empty strings instead of the string "null".
 * @param {object} [options.yamlOptions] - Additional options to pass to the
 * YAML library when formatting complex data types.
 * @returns {string} - The escaped CSV cell value.
 */
export const stringifyCell = (each, options={})=>{
    // undefined become empty cell
    if (each == undefined) {
        return ""
    }
    // null becomes null (having it convert to empty string is valid, just not the default)
    if (each == null) {
        if (options.nullAsEmpty) {
            return ""
        } else {
            return "null"
        }
    }
    // empty strings contain quotes
    if (each === "") {
        return '""'
    }
    if (each instanceof Date) {
        return each.toISOString()
    }
    if (each instanceof BigInt) {
        return each.toString()
    }
    if (each instanceof RegExp) {
        return each.toString()
    }
    // custom converter
    if (each[toTypedCsv] instanceof Function) {
        return each[toTypedCsv](options)
    }
    // remaining non-strings just get yamlified
    if (typeof each != "string") {
        let newString = yaml.stringify(each, { collectionStyle: 'flow', ...options.yamlOptions })
        // remove trailing newline (which is always a save operation)
        if (newString[newString.length-1] == "\n") {
            newString = newString.slice(0,-1)
        }
        return newString
    }
    // 
    // strings
    // 
    // we must determine if the string needs quotes 
    // if its a string that wouldn't be quoted by yaml, but should be reserved for special things (like date), then quote it manually
    if (matchesReservedPattern(each)) {
        return JSON.stringify(each)
    }
    // otherwise rely on yaml to quote it correctly or make it a block-string
    const asString = yaml.stringify(each)
    if ((asString.startsWith('"') || asString.startsWith("'")) && asString.endsWith("\n")) {
        return asString.slice(0,-1)
    } else {
        each = `${each}`
        // some of these will convert to `[Object object]`
        // however the check below still will handle it correctly
        // even if the object somehow converts to something that is the same 
        // length as `[Object object]`.length+1
        if (each.length+1 == asString.length && asString.endsWith("\n") && !each.endsWith("\n")) {
            return asString.slice(0,-1)
        }
        return asString
    }
}

/**
 * Converts an iterable of data into a typed CSV string
 *
 * @param {Iterable} data - The data to be converted to a CSV string. Must be a synchronous iterable (e.g. array, set, generator).
 * @param {Object} [options] - Options (duh)
 * @param {Array} [options.headers=[]] - An array of header values to use for the CSV output.
 * @param {string} [options.delimiter=","] - The delimiter to use between values in the CSV output.
 * @returns {string} - The CSV string representation of the input data.
 */
export const stringify = (data, { headers=[], delimiter=",", ...options }={}) => {
    if (!isSyncIterable(data)) {
        if (data instanceof Object) {
            const autoHeaders = Object.keys(data)
            if (autoHeaders.length === 0) {
                return ensureUniqueNames(headers).map(each=>csvEscapeCell(String(each))).join(delimiter)+"\n"
            } else {
                headers = autoHeaders.concat(headers)
            }
            const objectValues = Object.values(data)
            for (const [key, value] of Object.entries(data)) {
                if (!isSyncIterable(value)) {
                    throw new Error(`data must be an synchnous iterable (array, set, generator, etc), or an object (Dataframe) of synchnous iterables. Instead I got a data frame where the ${JSON.stringify(key)} key was ${toRepresentation(data)}`)
                }
            }
            data = lazyConcat(headers, zip(...Object.values(data)))
        } else {
            throw new Error(`data must be an synchnous iterable (array, set, generator, etc), or an object (Dataframe) of synchnous iterables. Instead I got: ${toRepresentation(data)}`)
        }
    }
    const iterable = iter(data)
    const first = next(iterable)
    if (first == stop) {
        // early end
        return ensureUniqueNames(headers).map(each=>csvEscapeCell(String(each))).join(delimiter)+"\n"
    }
    const assumeAllAreObjects = (!isSyncIterable(first) && first instanceof Object)
    if (assumeAllAreObjects) {
        var [ headers, ...data ] = rowify(
            lazyConcat([first], data),
            {
                defaultHeaders:headers
            },
        )
    }
    return [...iterGenerateCsv(data, { headers, delimiter, ...options })].join("")
}

function* iterGenerateCsv(data, { headers=[], delimiter=",", ...options }={}) {
    if (!isSyncIterable(data)) {
        throw new Error(`data must be an synchnous iterable (array, set, generator, etc), instead I got: ${toRepresentation(data)}`)
    }
    // require having a header, and they must be strings
    yield ensureUniqueNames(headers).map(each=>csvEscapeCell(String(each))).join(delimiter)+"\n"
    for (const row of data) {
        yield [...row].map(each=>csvEscapeCell(stringifyCell(each, options))).join(delimiter)+"\n"
    }
}


// WIP: custom iterator-based CSV parser 
// export const parse = (iterable, { delimiter=",", commentSymbol="#", ...options }={}) => {
//     if (typeof iterable === "string") {
//         iterable = iterable.split("\n")
//     }
//     const iterable = iter(iterable)
//     const headers = next(iterable)
//     const commentPattern = new RegExp(regex`^${commentSymbol}`.source)
//     let accumulator = ""
//     for (const row of iterable) {
//         if (each.match(commentPattern)) {
//             continue
//         }
//         let remaining = row
//         let rowAsStringList = []
//         while (remaining.length > 0) {
//             const simpleMatch = row.match(regex`^([^${delimiter}\n\r]+)`)
//             if (simpleMatch) {
//                 remaining = remaining.slice(simpleMatch[0].length)
//                 rowAsList.push(simpleMatch[1])
//                 continue
//             }
//             const quotedMatch = remaining.match(/^[\t\n]*"/)
//             if (quotedMatch) {
//                 remaining = remaining.slice(quotedMatch[0].length)
//                 remaining.match(/^([^"]|"")*"/)
//             }
//         }
//         const row = each.split(delimiter)
//         yield row
// 
//     }
//     const rows = csv.parse(csvString, { delimiter })
//     for (const eachRow of rows) {
//         let index = -1
//         for (const each of eachRow) {
//             index++
//             try {
//                 eachRow[index] = parseCell(each)
//             } catch (error) {
//                 eachRow[index] = each
//             }
//         }
//     }
//     return rows
// }

