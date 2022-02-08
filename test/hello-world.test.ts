import * as dotenv from "dotenv";
import * as ngrok from "ngrok";
import { VoiceBotTest, VoiceBotTester } from "../src/index";
dotenv.config();

const accountSid = String(process.env.TWILLIO_ACCOUNT_ID);
const authToken = String(process.env.TWILLIO_AUTH_TOKEN);
const ngrokAuth = String(process.env.NGROK_AUTH_TOKEN);

const sourceNumber: string = String(process.env.SOURCE_NUMBER);
const terminationNumber: string = String(process.env.TERMINATION_NUMBER);

describe("test hello world app", () => {
	let voiceBotTester: VoiceBotTester;
	let voiceBotTest: VoiceBotTest;
	beforeAll(async () => {
		await ngrok.kill();
		voiceBotTester = new VoiceBotTester({
			ngrokAuthToken: ngrokAuth,
			twilioAccountId: accountSid,
			twilioAuthToken: authToken
		});
		voiceBotTest = voiceBotTester.createVoiceBotTest();
	});
	afterEach(async () => {
		if (voiceBotTest) {
			await voiceBotTest.cleanup();
		}
	}, 200000);
	it.only("Should echo Hello World", async () => {
		voiceBotTest.addConsumerUtterance("Hi!");
		voiceBotTest.addExpectedResponse(
			"Jon Bones is the C PAP designs with the needs of Communication service providers in mind. This is an example of Simple Text to Speech, but there is so much more you can do try."
		);

		await voiceBotTest.executeTest(terminationNumber, sourceNumber);
	}, 120000);
});
