/*
    - get test to run
    - get candles
    - run indicator functions
    - test for signals
*/
import * as dotenv from "dotenv"
dotenv.config()

import { createTests } from "./createTests.js"
import { runPsarBollinger } from "./psarBollinger.js"

const helper = process.env.HELPER

let processing = false

const runTest = async () => {
	if (processing) return

	processing = true
	await runPsarBollinger()
	processing = false
}

if (helper === "false") await createTests()
await runTest()
setInterval(runTest, 5000)
