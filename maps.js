
import {Actor, StaticActor, Flow} from './actor.js'
let Vec2 = planck.Vec2;

export const MAP_TEST = (gl, world) => {
	const presentStack = [[Vec2(50,50), Vec2(500,210)],[Vec2(50,50), Vec2(500,210)],[Vec2(50,50), Vec2(500,210)]];
	const present = new Actor(gl, world, new Vec2(50,50), new Vec2(500,210), 0);
	var actors = [present];
	const obstacle1 = new StaticActor([Vec2(256, 256), Vec2(512, 256), Vec2(256, 512), Vec2(512,512)], 1);
	const obstacle2 = new StaticActor([Vec2(600, 256), Vec2(800, 256), Vec2(600, 512), Vec2(800,512)], 1);
	var obstacles = [obstacle1, obstacle2];
	const flow01 = new Flow(Vec2(556, 256), Vec2(556, 512), 10.0, {r:0,g:0,b:0.5}, 1.0);
	let flows = [flow01];

	return {actors : actors, 
		obstacles : obstacles, 
		flows : flows, 
		presentStack : presentStack};
}

export const MAP_01 = (gl, world) =>{

}

export const MAP_02 = (gl, world) =>{
}

export const MAP_03 = (gl, world) =>{
}

export const MAPS = [MAP_01, MAP_02, MAP_03];
