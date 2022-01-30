import * as dotenv from "dotenv";
import * as ngrok from "ngrok";
import { VoiceBotTest, VoiceBotTester } from "../src/index";
dotenv.config();

const accountSid = String(process.env.TWILLIO_ACCOUNT_ID);
const authToken = String(process.env.TWILLIO_AUTH_TOKEN);
const ngrokAuth = String(process.env.NGROK_AUTH_TOKEN);

const sourceNumber: string = String(process.env.SOURCE_NUMBER);
const terminationNumber: string = String(process.env.TERMINATION_NUMBER);

describe("test pizza bot", () => {
	let voiceBotTester: VoiceBotTester;
	let voiceBotTest: VoiceBotTest;
	beforeAll(async () => {
		await ngrok.kill();
		voiceBotTester = new VoiceBotTester({
			ngrokAuthToken: ngrokAuth,
			twilioAccountId: accountSid,
			twilioAuthToken: authToken
		});
	});
	afterEach(async () => {
		if (voiceBotTest) {
			await voiceBotTest.cleanup();
		}
	}, 200000);
	it("should correctly be able to order a pizza", async () => {
		voiceBotTest = voiceBotTester.createVoiceBotTest();

		voiceBotTest.addConsumerUtterance("Hi!");
		voiceBotTest.addExpectedResponse(
			"Hi and welcome to Louis restaurant. What do you want to order pizza or spaghetti?"
		);

		voiceBotTest.addConsumerUtterance("I would like to order a Pizza!");
		voiceBotTest.addExpectedResponse(
			"What toppings do you like on your  pizza?"
		);

		voiceBotTest.addConsumerUtterance("Cheese, pineapple and ham!");
		voiceBotTest.addExpectedResponse("What size should be your pizza?");

		voiceBotTest.addConsumerUtterance("Big");
		voiceBotTest.addExpectedResponse(
			"Your have ordered a big pizza with cheese, pineapple and Ham."
		);

		await voiceBotTest.executeTest(terminationNumber, sourceNumber);
	}, 120000);
	it("should fail if we order spaghetti", async () => {
		voiceBotTest = voiceBotTester.createVoiceBotTest();

		voiceBotTest.addConsumerUtterance("Hi!");
		voiceBotTest.addExpectedResponse(
			"Hi and welcome to Louis restaurant. What do you want to order pizza or spaghetti?"
		);

		voiceBotTest.addConsumerUtterance("I would like to order spaghetti");
		voiceBotTest.addExpectedResponse(
			"What toppings do you like on your  pizza?"
		);

		voiceBotTest.addConsumerUtterance("Cheese, pineapple and ham!");
		voiceBotTest.addExpectedResponse("What size should be your pizza?");

		voiceBotTest.addConsumerUtterance("Big");
		voiceBotTest.addExpectedResponse(
			"Your have ordered a big pizza with cheese, pineapple and Ham."
		);
		try {
			await voiceBotTest.executeTest(terminationNumber, sourceNumber);
			throw new Error("should-fail");
		} catch (err) {
			expect(err.message).not.toEqual("should-fail");
		}
	}, 120000);
});
