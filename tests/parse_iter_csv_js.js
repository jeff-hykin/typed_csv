import { csvParseIter } from '../main/javascript/normal_csv.js'
import { FileSystem } from 'https://deno.land/x/quickr@0.6.70/main/file_system.js'

console.log([...csvParseIter(`a,b,c,f\n,a,"",a,"a","""a"""\n`)])