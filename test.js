import * as dotenv from "dotenv"
dotenv.config()

import { DateTime } from "luxon"
import { connect, database, disconnect } from "./mongo.js"

const { client, db } = database()

await connect(client)

const table = "kline_15ms"
const collection = db.collection(table)

const data = []
await client.connect()
const start = DateTime.now()
const btc = collection.find({ symbol: "BTCUSDT" })
const btcCount = await btc.count()
let x = 1
await btc.forEach(candle => {
	data.push(candle)
	console.log(x, "of", btcCount)
	x++
})

console.log(data.length)

const end = DateTime.now()

console.log(end.diff(start).toHuman())
await disconnect(client)
