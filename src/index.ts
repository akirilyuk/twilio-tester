import twilio from "twilio";
import * as ngrok from "ngrok";
import express from "express";
import * as http from "http";
import * as dotenv from "dotenv";

import * as stringSimilarity from "string-similarity";
dotenv.config();
const port = 8000;

const VoiceResponse = twilio.twiml.VoiceResponse;

let url: string;

interface TesterOptions {
	twilioAccountId: string;
	twilioAuthToken: string;
	ngrokAuthToken: string;
}
class VoiceBotTester {
	twilioClient: {};
	ngrokAuth: string;
	constructor(options: TesterOptions) {
		this.twilioClient = twilio(
			options.twilioAccountId,
			options.twilioAuthToken
		);
		this.ngrokAuth = options.ngrokAuthToken;
	}

	createVoiceBotTest() {
		return new VoiceBotTest(this.ngrokAuth, this.twilioClient);
	}
}

class VoiceBotTest {
	server: any;
	twilioClient: {};
	consumerUtterance: string[];
	expectedBotResponses: string[];
	receivedBotResponses: string[];
	numberOfTurns: number;
	ngrokAuth: string;
	url: string;
	finishPromise: any;
	finishCallback: any;
	constructor(ngrokAuth: string, twilioClient: any) {
		this.ngrokAuth = ngrokAuth;
		this.twilioClient = twilioClient;
		this.server = null;
		this.consumerUtterance = [];
		this.receivedBotResponses = [];
		this.expectedBotResponses = [];
		this.numberOfTurns = 0;
		this.url = "";
	}

	async createServer() {
		const app = express();
		/**
		 * Disable not needed features
		 */
		app.set("etag", false).set("x-powered-by", false);
		app.use(express.urlencoded({ extended: false }));
		app.use(
			express.json({
				limit: process.env.HTTP_JSON_BODY_LIMIT
					? `${process.env.HTTP_JSON_BODY_LIMIT}kb`
					: "100kb"
			})
		);
		app.use(
			express.text({
				type: "text/plain",
				limit: process.env.HTTP_TEXT_BODY_LIMIT || "2MB"
			})
		);

		app.post("/gather-result", (req, res, next) => {
			const speechResult = req.body.SpeechResult;
			this.receivedBotResponses.push(speechResult);
			console.log("POST gather-result");

			console.log("expected: ", this.expectedBotResponses[this.numberOfTurns]);
			console.log("received: ", speechResult);

			console.log(
				"similarity:",
				stringSimilarity.compareTwoStrings(
					this.expectedBotResponses[this.numberOfTurns].toLowerCase(),
					speechResult.toLowerCase()
				)
			);

			this.numberOfTurns += 1;
			const twiml = new VoiceResponse();
			if (!this.consumerUtterance[this.numberOfTurns]) {
				// if we do not have any consumer input more to test, leave the call
				twiml.hangup();
				this.finishCallback();
				console.log("hangup");
			} else {
				console.log("continue");
				twiml.redirect(this.url + "/call-start");
			}
			res.type("text/xml");
			res.send(twiml.toString());
		});

		app.post("/call-start", (req, res) => {
			console.log("POST call-start");
			const twiml = new VoiceResponse();
			twiml.say(this.consumerUtterance[this.numberOfTurns]);
			console.log("consumer says", this.consumerUtterance[this.numberOfTurns]);
			twiml.pause({ length: 1 });
			twiml.gather({
				action: this.url + "/gather-result",
				input: "speech",
				timeout: 10,
				speechTimeout: "2"
			});
			res.type("text/xml");
			res.send(twiml.toString());
		});

		const server = http.createServer(app);

		return new Promise(resolve => {
			server.listen(port, () => {
				console.log("info", null, "API is listening.");
				resolve(server);
			});
		});
	}

	addConsumerUtterance(consumerSpeech: string) {
		this.consumerUtterance.push(consumerSpeech);
	}
	addExpectedBotResponse(botResponse: string) {
		this.expectedBotResponses.push(botResponse);
	}

	async executeTest(terminationNumber: string, sourceNumber: string) {
		this.url = await ngrok.connect({
			authtoken: this.ngrokAuth,
			addr: port
		});
		console.log("ngrok url", url);

		this.server = await this.createServer();
		this.finishPromise = new Promise(resolve => {
			this.finishCallback = resolve;
		});

		const call = await this.twilioClient.calls.create({
			to: terminationNumber,
			from: sourceNumber,
			method: "POST",
			url: this.url + "/call-start"
		});

		console.log("created call", call.sid);

		await this.finishPromise;

		console.log("call has finished, shutting down server");

		await new Promise(resolve => this.server.close(resolve));

		await ngrok.disconnect(this.url);

		console.log("cleanup completed!");
	}
}

const main = async () => {
	const accountSid = String(process.env.TWILLIO_ACCOUNT_ID);
	const authToken = String(process.env.TWILLIO_AUTH_TOKEN);
	const ngrokAuth = String(process.env.NGROK_AUTH_TOKEN);

	const sourceNumber: string = String(process.env.SOURCE_NUMBER);
	const terminationNumber: string = String(process.env.TERMINATION_NUMBER);

	const voiceBotTester = new VoiceBotTester({
		ngrokAuthToken: ngrokAuth,
		twilioAccountId: accountSid,
		twilioAuthToken: authToken
	});

	const voiceBotTest = voiceBotTester.createVoiceBotTest();

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
};

main();
