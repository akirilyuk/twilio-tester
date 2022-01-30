import * as dotenv from "dotenv";
import * as ngrok from "ngrok";
import { VoiceBotTest, VoiceBotTester } from "../src/index";
dotenv.config();

const accountSid = String(process.env.TWILLIO_ACCOUNT_ID);
const authToken = String(process.env.TWILLIO_AUTH_TOKEN);
const ngrokAuth = String(process.env.NGROK_AUTH_TOKEN);

const sourceNumber: string = String(process.env.SOURCE_NUMBER);
const terminationNumber: string = String(process.env.TERMINATION_NUMBER);

describe("test VG", () => {
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
	xit("should correctly be able to order a pizza", async () => {
		voiceBotTest = voiceBotTester.createVoiceBotTest();

		voiceBotTest.addConsumerUtterance("Hi!");
		voiceBotTest.addExpectedBotResponse(
			"Hi and welcome to Louis restaurant. What do you want to order pizza or spaghetti?"
		);

		voiceBotTest.addConsumerUtterance("I would like to order a Pizza!");
		voiceBotTest.addExpectedBotResponse(
			"What toppings do you like on your  pizza?"
		);

		voiceBotTest.addConsumerUtterance("Cheese, pineapple and ham!");
		voiceBotTest.addExpectedBotResponse("What size should be your pizza?");

		voiceBotTest.addConsumerUtterance("Big");
		voiceBotTest.addExpectedBotResponse(
			"Your have ordered a big pizza with cheese, pineapple and Ham."
		);

		await voiceBotTest.executeTest(terminationNumber, sourceNumber);
	}, 60000);
	it("should fail if we expect to order a spaghetti", async () => {
		voiceBotTest = voiceBotTester.createVoiceBotTest();

		voiceBotTest.addConsumerUtterance("Hi!");
		voiceBotTest.addExpectedBotResponse(
			"Hi and welcome to Louis restaurant. What do you want to order pizza or spaghetti?"
		);

		voiceBotTest.addConsumerUtterance("I would like to order spaghetti");
		voiceBotTest.addExpectedBotResponse(
			"What toppings do you like on your  pizza?"
		);

		voiceBotTest.addConsumerUtterance("Cheese, pineapple and ham!");
		voiceBotTest.addExpectedBotResponse("What size should be your pizza?");

		voiceBotTest.addConsumerUtterance("Big");
		voiceBotTest.addExpectedBotResponse(
			"Your have ordered a big pizza with cheese, pineapple and Ham."
		);

		await voiceBotTest.executeTest(terminationNumber, sourceNumber);
	}, 60000);
});
