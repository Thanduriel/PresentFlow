
import {Actor, StaticActor, Flow, createAAVs} from './actor.js'
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
	const sourcePos = Vec2(50, 768/2);

	const presentStack = [[Vec2(50,50), sourcePos.clone()],[Vec2(50,50), sourcePos.clone()]];
	let obstacles = [];
	
	obstacles.push(new StaticActor([Vec2(683, 92), Vec2(883, 92), Vec2(683, 292), Vec2(883, 292)], 1));
	obstacles.push(new StaticActor([Vec2(683, 92+384), Vec2(883, 92+384), Vec2(683, 292+384), Vec2(883, 292+384)], 1));
	
	const flow01 = new Flow(sourcePos, Vec2.add(sourcePos,Vec2(200, 0)), 20.0, {r:0,g:0.1,b:0.5}, 1.0);
	let flows = [flow01];

	return {actors : [], 
		obstacles : obstacles, 
		flows : flows, 
		presentStack : presentStack,
		placeableObstacles : 3};
}

export const MAP_02 = (gl, world) =>{
	const sourcePos = Vec2(50, 768/2);
	const uPos = Vec2(1366/2, 768/2);
	const uWidth = 72;
	const uLength = 290;
	const begin = uLength/2 - uWidth;
	const uLength_2 = uLength/2;

	const presentStack = [[Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), sourcePos.clone()]];
	let obstacles = [];
	
	obstacles.push(new StaticActor(createAAVs(Vec2(begin, uLength_2).add(uPos),
							  Vec2(uLength_2, -uLength_2).add(uPos)), 1));
	obstacles.push(new StaticActor(createAAVs(Vec2(-uLength_2, begin).add(uPos),
							  Vec2(begin, uLength_2).add(uPos)), 1));
	obstacles.push(new StaticActor(createAAVs(Vec2(-uLength_2, -begin).add(uPos),
							  Vec2(begin, -uLength_2).add(uPos)), 1));
	obstacles.push(new StaticActor(createAAVs(Vec2(-32, -32).add(uPos),
							  Vec2(32, 32).add(uPos)), 2));

	const flow01 = new Flow(sourcePos.clone(), Vec2.add(sourcePos,Vec2(200, 0)), 20.0, {r:0,g:0.5,b:0.4}, 1.0);
	const source2Pos = Vec2(1366-sourcePos.x, sourcePos.y);
	const flow02 = new Flow(source2Pos, Vec2.sub(source2Pos, Vec2(200,0)), 20.0, {r:0.7,g:0.3,b:0.4}, 1.0);
	let flows = [flow01, flow02];

	return {actors : [], 
		obstacles : obstacles, 
		flows : flows, 
		presentStack : presentStack,
		placeableObstacles : 4};
}

export const MAP_03 = (gl, world) =>{
}

export const MAPS = [MAP_01, MAP_02, MAP_03];
