# What is this for?

This is type-preserving CSV format designed to be compatible with existing csv files and tools. Unlike basic CSV, typed csv can distingush between the string "1" and the number 1, the empty string, NaN, null, etc.

# How does it work?

## Oversimplified

When reading CSV, the cell is interpreted as YAML (mostly*) This means `a` is a string, `true` is a boolean, `1` is a number, `'1'` is a string, `null` is null, and an empty cell is null. In order to be backwards compatible, anything that's invalid yaml, like `[10'` will become a string (e.g. "[10'")

When writing a CSV, use the `.typed.csv` extension to indicate these values are typed, then mostly perform the reverse of the read operation: yaml.stringify each value, then CSV write.

## Not Oversimplified

When reading, first the values are parsed with normal CSV escaping. That means `"""a"""` gets converted to `"a"` because the first quote starts a CSV quote, the next two are an escaped quote, then then letter a, then another escaped quote, then closing quote. The RESULTING string is then checked for some patterns that are outside the yaml spec: the ISO date pattern, `Nan`, `Infinity`, `-Infinity`, etc. These are not part of the yaml spec, but they are converted to their respective values instead of being treated like strings. If it doesn't match those patterns, then we try to parse as yaml. If we fail to parse as yaml, then its an as-is string. 

When writing, we always prefer the flow style. For strings that don't need quotes and dont have newlines, we don't quote them. Everything defaults to flow-style values rather than block-style. Strings that need quotes use single quotes.


# How do I use it?

I've made a JS implementation, and a partial python implementation. BUT if you want to port the code to, let's say Elixir, it a **very** straightforward. Grab an existing CSV and YAML processor, add the handful of quality-of-life-edgecases that are part of the spec, and you're done. 


Later this document will contain usage examples for the JS implementation here (under main/javascript), and the python implementation.
