import {Wampus} from "../../lib";

export module RealSessions {
	export function session() {
		return Wampus.create({
			realm : "library",
			transport : {
				type : "websocket",
				url : "ws://localhost:8080",
				serializer : "json"
			}
		})
	}
}