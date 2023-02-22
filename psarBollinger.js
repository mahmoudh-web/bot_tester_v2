import * as dotenv from "dotenv"
dotenv.config()

import * as indicators from "./indicators.js"
import { addIndicatorData } from "./lib/addIndicatorData.js"
import { database } from "./mongo.js"
import { buyAmount, sellAmount } from "./lib/trade.js"
import { Double } from "bson"

const { client, db } = database()

const runPsarBollinger = async () => {
	await client.connect()

	// get test to run
	const testCollection = db.collection("tests")
	const test = await testCollection.findOne({
		completed: false,
		// interval: 60,
	})
	if (!test) {
		await client.close()
		return
	}

	console.log(`Running test for ${test.symbol} - ${test.interval}`)

	// update test in db to show that it is being run
	await testCollection.updateOne(
		{ _id: test._id },
		{ $set: { completed: true } }
	)

	// get candles
	const candlesCollection = db.collection(
		test.interval === 60 ? "kline_1hs" : `kline_${test.interval}ms`
	)

	const count = await candlesCollection.countDocuments({
		symbol: test.symbol,
		startTimeISO: { $gte: new Date("Sat, 01 Jan 2022 00:00:00 GMT") },
	})

	if (count === 0) {
		console.log("No candle data")
		return
	}

	const candles = []
	const candleData = candlesCollection
		.find({
			symbol: test.symbol,
			startTimeISO: { $gte: new Date("Sat, 01 Jan 2022 00:00:00 GMT") },
		})
		.sort({ startTime: 1 })

	let x = 1
	await candleData.forEach(candle => {
		console.log(
			`Retrieved candle ${x.toLocaleString(
				"en-GB"
			)} of ${count.toLocaleString("en-GB")}`
		)
		x++
		candles.push({
			start: candle.startTime,
			open: candle.open,
			high: candle.high,
			low: candle.low,
			close: candle.close,
			volume: candle.volume,
			startISO: candle.startTimeISO,
			symbol: candle.symbol,
		})
	})

	// apply indicators
	const PSAR = indicators.psar(candles, {
		increment: test.psar_increment,
		max: test.psar_max,
	})

	const bollinger = indicators.bollinger(candles, {
		period: test.bollinger_period,
		deviation: test.bollinger_deviation,
	})

	const data = addIndicatorData(
		candles,
		// { name: "macd_line", data: macd.macdLine },
		// { name: "macd_signal", data: macd.macdSignal },
		// { name: "macd_histogram", data: macd.histogram },
		{ name: "psar", data: PSAR },
		{ name: "bollinger_lower", data: bollinger.lower },
		{ name: "bollinger_middle", data: bollinger.middle },
		{ name: "bollinger_upper", data: bollinger.upper }
	)

	// test candles
	let openTrade = false

	let usdt = 100
	let token = 0

	let buys = 0
	let sells = 0
	let losing = 0

	data.forEach(candle => {
		if (openTrade) {
			const sellSignal = sell(candle)
			if (sellSignal) {
				console.log(
					`SELL: ${candle.startISO}, Price: ${
						candle.open
					}, Profit: ${sellAmount(candle.open, token).toFixed(2)}`
				)
				usdt += sellAmount(candle.open, token)
				if (sellAmount(candle.open, token) <= 10) losing++
				token = 0
				sells++
				printBalance(usdt, token)
				openTrade = false
			}
		} else {
			const buySignal = buy(candle)
			if (buySignal) {
				console.log(`BUY: ${candle.startISO}, Price: ${candle.open}`)
				usdt -= 10
				token += buyAmount(candle.open, 10)
				buys++
				printBalance(usdt, token)
				openTrade = true
			}
		}
	})
	console.log(`Buys: ${buys}, Sells: ${sells}, Losing: ${losing}`)

	await writeResults(
		test.symbol,
		test.interval,
		test.testId,
		buys,
		sells,
		losing,
		usdt,
		token
	)
	await client.close()
}

function buy(candle) {
	if (candle.open < candle.bollinger_lower && candle.psar < candle.low)
		return true
	return false
}

function sell(candle) {
	if (candle.open > candle.bollinger_upper && candle.psar > candle.high)
		return true
	return false
}

function printBalance(usdt, token) {
	console.log(`USDT Balance: ${usdt.toFixed(2)}, Token Balance: ${token}`)
}

async function writeResults(
	symbol,
	interval,
	testId,
	buys,
	sells,
	losing,
	usdt_balance,
	token_balance
) {
	const resultsCollection = db.collection("results")
	await resultsCollection.insertOne({
		symbol,
		interval,
		testId,
		buys,
		sells,
		losing,
		usdt_balance: new Double(usdt_balance.toFixed(2)),
		token_balance,
		win_rate: new Double((((buys - losing) / buys) * 100).toFixed(2)),
		lose_rate: new Double(((losing / buys) * 100).toFixed(2)),
		profit: new Double((usdt_balance - 100).toFixed(2)),
	})

	console.log("Stored results")
}

export { runPsarBollinger }
