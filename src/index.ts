import twilio, { Twilio } from "twilio";
import * as ngrok from "ngrok";
import express from "express";
import * as http from "http";
import * as dotenv from "dotenv";

import * as stringSimilarity from "string-similarity";
const port = 8001;

const VoiceResponse = twilio.twiml.VoiceResponse;

export interface TesterOptions {
	twilioAccountId: string;
	twilioAuthToken: string;
	ngrokAuthToken: string;
}
export class VoiceBotTester {
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

export class VoiceBotTest {
	server: any;
	twilioClient: twilio.Twilio;
	consumerUtterance: string[];
	expectedBotResponses: string[];
	receivedBotResponses: string[];
	numberOfTurns: number;
	ngrokAuth: string;
	url: string;
	finishPromise: any;
	finishCallback: any;
	call: any;
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
			console.log("POST /gather-result");
			const speechResult = req.body.SpeechResult;
			this.receivedBotResponses.push(speechResult);

			const similarity = stringSimilarity.compareTwoStrings(
				this.expectedBotResponses[this.numberOfTurns].toLowerCase(),
				speechResult.toLowerCase()
			);
			console.log(this.numberOfTurns, "bot response:", speechResult);
			console.log(this.numberOfTurns, "similarity:", similarity);

			try {
				expect(similarity).toBeGreaterThan(0.7);
			} catch (err) {
				console.error(
					this.numberOfTurns,
					"Received wrong bot response!",
					err.message
				);
				console.log(
					"expected: ",
					this.expectedBotResponses[this.numberOfTurns]
				);
				console.log("received: ", speechResult);

				try {
					// to be able to better understand the erro we wil
					// compare the sentectens and this will trhow a better info
					expect(speechResult).toEqual(
						this.expectedBotResponses[this.numberOfTurns]
					);
				} catch (humanError) {
					// we need to finish the CB otherwise we are blocked
					this.finishCallback(humanError);

					//stop execution here
					return;
				}
			}
			this.numberOfTurns += 1;
			const twiml = new VoiceResponse();
			if (!this.consumerUtterance[this.numberOfTurns]) {
				// if we do not have any consumer input more to test, leave the call
				twiml.hangup();
				this.finishCallback();
				console.log(
					this.numberOfTurns - 1,
					"hangup call, no more consumer input"
				);
			} else {
				console.log(this.numberOfTurns - 1, "continue call");
				twiml.redirect(this.url + "/call-start");
			}

			res.type("text/xml");
			res.send(twiml.toString());
			console.log("POST /gather-result finished", twiml.toString());
		});

		app.post("/call-start", (req, res) => {
			console.log("POST /call-start");
			const twiml = new VoiceResponse();
			twiml.say(this.consumerUtterance[this.numberOfTurns]);
			console.log(
				this.numberOfTurns,
				"consumer says:",
				this.consumerUtterance[this.numberOfTurns]
			);
			//twiml.pause({ length: 1 });
			twiml.gather({
				action: this.url + "/gather-result",
				//@ts-ignore
				input: "speech",
				timeout: 10,
				speechTimeout: "2"
			});
			res.type("text/xml");
			res.send(twiml.toString());
			console.log("POST /call-start finished", twiml.toString());
		});

		const server = http.createServer(app);

		return new Promise(resolve => {
			server.listen(port, () => {
				console.log("API is listening at port: ", port);
				resolve(server);
			});
		});
	}

	addConsumerUtterance(consumerSpeech: string) {
		this.consumerUtterance.push(consumerSpeech);
	}
	addExpectedResponse(botResponse: string): void {
		this.expectedBotResponses.push(botResponse);
	}

	async executeTest(terminationNumber: string, sourceNumber: string) {
		this.url = await ngrok.connect({
			authtoken: this.ngrokAuth,
			addr: port
		});
		console.log("ngrok url", this.url);

		this.server = await this.createServer();
		this.finishPromise = new Promise((resolve, reject) => {
			this.finishCallback = (err: any) => {
				if (err) {
					reject(err);
				} else {
					resolve({});
				}
			};
		});

		this.call = await this.twilioClient.calls.create({
			to: terminationNumber,
			from: sourceNumber,
			method: "POST",
			url: this.url + "/call-start"
		});

		console.log("created call", this.call.sid);

		await this.finishPromise;
	}

	async cleanup() {
		if (this.call) {
			try {
				await this.twilioClient
					.calls(this.call.sid)
					.update({ twiml: "<Response><Hangup/></Response>" });
			} catch (err) {
				console.log("could not hagup twilio call", err.message);
			}
		}
		console.log("call has finished, shutting down server");

		await new Promise(resolve => this.server.close(resolve));

		await ngrok.disconnect(this.url);
		await ngrok.kill();

		console.log("cleanup completed!");
	}
}
