import test from "ava";
import {Wampus} from "../../../lib";
import {WebsocketTransport} from "../../../lib/core/transport/websocket";
import {JsonSerializer} from "../../../lib/core/serializer/json";
import {Operators} from "promise-stuff";
import _ = require("lodash");

test.afterEach(async t => {
	if (!t.context.session) return;
	let session = await Operators.timeout(t.context.session, 10, () => Promise.reject("")).catch(() => null);
	if (session) await session.close();
});

test("configure websocket transport", async t => {
	let session = t.context.session = Wampus.create({
		transport : {
			serializer : "json",
			type : "websocket",
			timeout : 1000,
			url : "ws://localhost:8080"
		},
		realm : "hi"
	});

	await t.notThrows(session);
});

test("verify session details", async t => {
	let session = await Wampus.create({
		transport : {
			serializer : "json",
			type : "websocket",
			timeout : 1000,
			url : "ws://localhost:8080"
		},
		realm : "hi"
	});

	t.true(_.isInteger(session.sessionId));
	t.true(session.isActive);

});

test("invalid transport type, throws", async t => {
	let session = Wampus.create({
		transport : {
			type : "?!"
		} as any,
		realm : "a"
	});
	await t.throws(session)
});

test("invalid serializer type, throws", async t => {
	let session = Wampus.create({
		transport : {
			type : "websocket",
			url : "ws://localhost:8080",
			serializer : "any"
		} as any,
		realm : "a"
	});
	await t.throws(session)
});

test("configure websocket transport, assign serializer", async t => {
	let session = t.context.session = Wampus.create({
		transport : {
			serializer : new JsonSerializer(),
			type : "websocket",
			timeout : 1000,
			url : "ws://localhost:8080"
		},
		realm : "hi"
	});

	await t.notThrows(session);
});

test("assign websocket transport directly", async t => {
	let session = t.context.session =Wampus.create({
		transport() {
			return WebsocketTransport.create({
				url : "ws://localhost:8080",
				timeout : 1000,
				serializer : new JsonSerializer(),
			})
		},
		realm : "hi"
	});

	await t.notThrows(session);
});

