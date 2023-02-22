import { Double, Int32 } from "bson"
import { nanoid } from "nanoid"
import { connect, database, disconnect } from "./mongo.js"

const createTests = async () => {
	const { client, db } = database()

	await connect(client)
	const testsCount = await db.collection("tests").countDocuments()

	if (testsCount > 0) {
		console.log("Tests found in db")
		await disconnect(client)
		return
	}

	console.log("No tests found. Continuing to create tests")

	const instruments = []
	const intervals = [1, 3, 5, 15, 60]
	const instrumentsCollection = db.collection("instruments")
	const instrumentCursor = instrumentsCollection
		.find({
			quoteAsset: "USDT",
			status: "TRADING",
			download: true,
		})
		.sort({ symbol: 1 })

	await instrumentCursor.forEach(instrument => instruments.push(instrument))

	if (!instruments.length) {
		await disconnect(client)
		return
	}

	const tests = []
	instruments.forEach(instrument => {
		intervals.forEach(interval => {
			for (
				let psar_increment = 0.1;
				psar_increment < 0.31;
				psar_increment += 0.1
			) {
				for (let psar_max = 0.4; psar_max < 0.6; psar_max += 0.1) {
					for (
						let bollinger_period = 2;
						bollinger_period < 20;
						bollinger_period += 2
					) {
						for (
							let bollinger_deviation = 0.5;
							bollinger_deviation < 1.25;
							bollinger_deviation += 0.5
						) {
							const testSettings = {
								symbol: instrument.symbol,
								completed: false,
								interval,
								psar_increment,
								psar_max,
								bollinger_period,
								bollinger_deviation: new Double(
									bollinger_deviation
								),
								testId: nanoid(),
							}
							console.log(
								`created test for ${instrument.symbol} ${interval}`
							)
							tests.push(testSettings)
						}
					}
				}
			}
		})
	})

	const testsCollection = db.collection("tests")
	const insertTests = await testsCollection.insertMany(tests)
	console.log(`${insertTests.insertedCount} tests uploaded to db`)
	await disconnect(client)
}

export { createTests }
