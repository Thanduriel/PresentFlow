
import {Actor, StaticActor, Flow} from './actor.js'
let Vec2 = planck.Vec2;

export const MAP_01 = (gl, world) => {
	const present = new Actor(gl, world, new Vec2(50,50), new Vec2(500,210), 0);
	var actors = [present];
	const obstacle1 = new StaticActor([Vec2(256, 256), Vec2(512, 256), Vec2(256, 512), Vec2(512,512)]);
	const obstacle2 = new StaticActor([Vec2(600, 256), Vec2(800, 256), Vec2(600, 512), Vec2(800,512)]);
	var obstacles = [obstacle1, obstacle2];
	const flow01 = new Flow(Vec2(556, 256), Vec2(556, 512), 10.0, {r:0,g:0,b:0.5}, 1.0);
	let flows = [flow01];

	return {actors : actors, obstacles : obstacles, flows : flows};
}