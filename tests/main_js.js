import { typeResolve, typeEscape } from '../main/javascript/main.js'
import { FileSystem } from 'https://deno.land/x/quickr@0.6.70/main/file_system.js'

const path =  `${FileSystem.thisFolder}/../test_inputs/observations.typed.csv`
const fileContent = await FileSystem.read(path)

const result = await asyncParse(fileContent)
console.log(JSON.stringify(result,0,4))