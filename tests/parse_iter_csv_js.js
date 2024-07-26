import { iterCsvParse } from '../main/javascript/main.js'
import { FileSystem } from 'https://deno.land/x/quickr@0.6.70/main/file_system.js'

console.log([...iterCsvParse(`a,b,c,f\n,a,"",a,"a","""a"""\n`)])