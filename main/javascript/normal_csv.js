import { isSyncIterable } from "https://deno.land/x/good@1.7.1.1/flattened/is_sync_iterable.js"
import { iter } from "https://deno.land/x/good@1.7.1.1/flattened/iter.js"
import { stop } from "https://deno.land/x/good@1.7.1.1/flattened/stop_symbol.js"
import { next } from "https://deno.land/x/good@1.7.1.1/flattened/next.js"
import { lazyConcat } from "https://deno.land/x/good@1.7.1.1/flattened/lazy_concat.js"
import { regex } from "https://deno.land/x/good@1.7.1.1/flattened/regex.js"
import { zip } from "https://deno.land/x/good@1.7.1.1/flattened/zip.js"
import { toRepresentation } from "https://deno.land/x/good@1.7.1.1/flattened/to_representation.js"

/**
 * Escapes a string value for use in a CSV cell.
 *
 * If the string contains the CSV delimiter, newline, carriage return, or double quotes, it will be enclosed in double quotes and any existing double quotes will be escaped by doubling them.
 * Otherwise, the string will be returned as-is.
 *
 * @param {string} stringData - The string value to escape.
 * @param {string} [delimiter=","] - The CSV delimiter character.
 * @returns {string} The escaped string value.
 */
export const csvEscapeCell = (stringData, delimiter=",")=>{
    if (stringData.includes(delimiter) || stringData.includes("\n") || stringData.includes("\r") || stringData.includes("\"")) {
        return `"${stringData.replace(/"/g, '""')}"`
    } else {
        return stringData
    }
}

export function* csvParseIter(csvString, { delimiter=",", warnings=true, commentSymbol="", ...options }={}) {
    let row = []
    if (typeof csvString != "string") {
        throw Error(`Can't parse typeof ${typeof csvString}`)
    }
    if (typeof delimiter != "string" || delimiter.length !== 1) {
        throw Error(`Delimiter must be a single character, instead got ${delimiter}`)
    }
    if (delimiter == "\n" || delimiter == "\r" || delimiter == '"') {
        throw Error(`Delimiter must not be a newline or quote character`)
    }
    if (csvString.trim().length != 0) {
        let lineIndex = 0
        const commentPattern = commentSymbol ? regex`^(${commentSymbol??""}).*(\r\n|\n|\r|$)` : null
        const simplePattern = regex`^([^"${delimiter}\n\r]*)(${delimiter}|\r\n|\n|\r|$)`
        const quotePattern = regex`^[ \t]*"((?:[^"]|"")*)"[ \t]*(${delimiter}|\r\n|\n|\r|$)`
        const borkedQuotePattern = regex`^([^${delimiter}\n\r]*)(${delimiter}|\r\n|\n|\r|$)`
        let startingAtNewline = true
        while (csvString.length > 0) {
            let isComment
            let isQuote
            let match
            if (commentPattern && (match = csvString.match(commentPattern))) {
                isComment = true
            } else if (match = csvString.match(simplePattern)) {
                isQuote = false
            } else if (match = csvString.match(quotePattern)) {
                isQuote = true
            } else if (match = csvString.match(borkedQuotePattern)) {
                isQuote = false
                if (warnings) {
                    console.warn(`Line ${lineIndex+1} has a quote but isnt a quoted entry (broken quote). Parsing as-if not quoted, Use {warnings: false} option to disable this warning`)
                }
            }
            
            csvString = csvString.slice(match[0].length)
            if (!isComment) {
                const stringContent = isQuote ? match[1].replace(/""/g, '"') : match[1]
                row.push(stringContent)
            }
            startingAtNewline = !match[0].endsWith(",")
            if (startingAtNewline) {
                lineIndex += 1
                yield row
                row = []
            }
        }
    }
}