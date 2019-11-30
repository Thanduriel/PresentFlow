
import {Actor, StaticActor, Flow, createAAVs, createRegularPolygonVs} from './actor.js'
import {config} from './context.js'
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

// record: 2
export const MAP_01 = (gl, world) =>{
	const sourcePos = Vec2(50, 768/2);

	const presentStack = [[Vec2(50,50), sourcePos.clone()],[Vec2(50,50), sourcePos.clone()]];
	let obstacles = [];
	
	obstacles.push(new StaticActor([Vec2(683, 92), Vec2(883, 92), Vec2(883, 292), Vec2(683, 292)], 1));
	obstacles.push(new StaticActor([Vec2(683, 92+384), Vec2(883, 92+384), Vec2(883, 292+384), Vec2(683, 292+384)], 1));
	
	const flow01 = new Flow(sourcePos, Vec2.add(sourcePos,Vec2(200, 0)), 20.0, {r:0,g:0.1,b:0.5}, 1.0);
	let flows = [flow01];

	return {actors : [], 
		obstacles : obstacles, 
		flows : flows, 
		presentStack : presentStack,
		placeableObstacles : 3};
}

// record: 3
export const MAP_02 = (gl, world) =>{
	const center = Vec2(1366/2, 768/2);
	const fortressPos = Vec2(1366/2, 768/2);
	const numTriangles = 8;

	let obstacles = [];
	
	obstacles.push(new StaticActor(createRegularPolygonVs(5, 128, fortressPos), 6));
	const vertices = createRegularPolygonVs(numTriangles, 180, fortressPos);
	for(let i = 0; i < numTriangles-1; ++i){
		const v = vertices[i];
		let dir = Vec2.sub(v, fortressPos);
		dir.normalize();
		const dirOrth = Vec2(-dir.y, dir.x);
		obstacles.push(new StaticActor([v.clone().addMul(100, dir),
										v.clone().addMul(-50, dirOrth),
										v.clone().addMul(50, dirOrth)],0));
	}
	
	const pos0 = Vec2(50,50);
	const pos1 = Vec2(1366-50,50);
	const pos2 = Vec2(1366-50,768-50);

	const presentStack = [[Vec2(50,50), pos2.clone()],
		[Vec2(50,50), pos0.clone()],
		[Vec2(50,50), pos1.clone()],
		[Vec2(50,50), pos2.clone()],
		[Vec2(50,50), pos0.clone()],
		[Vec2(50,50), pos1.clone()],
		[Vec2(50,50), pos2.clone()]];

	let dir = Vec2.sub(center, pos0);
	dir.normalize();
	const flow01 = new Flow(pos0, dir.mul(100).add(pos0), 20.0, {r:0.4,g:0.0,b:0.0}, 1.0);
	dir = Vec2.sub(center, pos1);
	dir.normalize();
	const flow02 = new Flow(pos1, dir.mul(100).add(pos1), 20.0, {r:0,g:0.4,b:0.0}, 1.0);
	dir = Vec2.sub(center, pos2);
	dir.normalize();
	const flow03 = new Flow(pos2, dir.mul(100).add(pos2), 20.0, {r:0,g:0.0,b:0.4}, 1.0);
	let flows = [flow01, flow02, flow03];

	return {actors : [], 
		obstacles : obstacles, 
		flows : flows, 
		presentStack : presentStack,
		placeableObstacles : 4};
}

// record: 3
export const MAP_03 = (gl, world) =>{
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

// record: 4
export const MAP_04 = (gl, world) =>{
	const sourcePos = Vec2(50, 768/3);
	const source2Pos = Vec2(50, 2*768/3);
	const buildingSize = 64;
	const buildingGrid = 256;
	const offset = Vec2((config.MAP_SIZE_X - (buildingGrid * 4)) / 2,
						(config.MAP_SIZE_Y - (buildingGrid * 2)) / 2);

	const presentStack = [[Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), source2Pos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), source2Pos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), source2Pos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), source2Pos.clone()],
						  [Vec2(50,50), sourcePos.clone()],
						  [Vec2(50,50), source2Pos.clone()]];
	let obstacles = [];
	
	for(let ix = 0; ix < 5; ++ix)
		for(let iy = 0; iy < 3; ++iy){
			const numPresents = ix + iy > 2 ? 1 : 0;
			const pos = Vec2(ix*buildingGrid, iy*buildingGrid).add(offset);
			obstacles.push(new StaticActor(createAAVs(Vec2(-buildingSize, -buildingSize).add(pos),
							  Vec2(buildingSize, buildingSize).add(pos)), 
							  numPresents));
		}

	const flow01 = new Flow(sourcePos.clone(), Vec2.add(sourcePos,Vec2(200, 0)), 20.0, {r:0.8,g:0.0,b:0.9}, 0.5);
	const flow02 = new Flow(source2Pos, Vec2.add(source2Pos, Vec2(200,0)), 20.0, {r:0.3,g:0.9,b:0.4}, 0.5);
	let flows = [flow01, flow02];

	return {actors : [], 
		obstacles : obstacles, 
		flows : flows, 
		presentStack : presentStack,
		placeableObstacles : 5};
}

export const MAP_FINISHED = (gl, world) =>{
	const center = Vec2(1366/2, 768/2);
	const fortressPos = Vec2(1366/2, 768/2);
	const numTriangles = 12;

	let obstacles = [];
	
	obstacles.push(new StaticActor(createRegularPolygonVs(6, 128, fortressPos), 0));
	const vertices = createRegularPolygonVs(numTriangles, 180, fortressPos);
	for(let i = 0; i < numTriangles; ++i){
		const v = vertices[i];
		let dir = Vec2.sub(v, fortressPos);
		dir.normalize();
		const dirOrth = Vec2(-dir.y, dir.x);
		obstacles.push(new StaticActor([v.clone().addMul(80, dir),
										v.clone().addMul(-40, dirOrth),
										v.clone().addMul(40, dirOrth)],0));
	}
	
	const pos0 = Vec2(50,50);
	const pos1 = Vec2(1366-50,50);
	const pos2 = Vec2(1366-50,768-50);
	const pos3 = Vec2(50,768-50);

	const presentStack = [];

	let dir = Vec2.sub(center, pos0);
	dir.normalize();
	const flow01 = new Flow(pos0, dir.mul(100).add(pos0), 20.0, {r:0.0,g:0.0,b:0.0}, 1.0);
	dir = Vec2.sub(center, pos1);
	dir.normalize();
	const flow02 = new Flow(pos1, dir.mul(100).add(pos1), 20.0, {r:0,g:0.0,b:0.0}, 1.0);
	dir = Vec2.sub(center, pos2);
	dir.normalize();
	const flow03 = new Flow(pos2, dir.mul(100).add(pos2), 20.0, {r:0,g:0.0,b:0.0}, 1.0);
	dir = Vec2.sub(center, pos3);
	dir.normalize();
	const flow04 = new Flow(pos3, dir.mul(100).add(pos3), 20.0, {r:0,g:0.0,b:0.0}, 1.0);
	let flows = [flow01, flow02, flow03, flow04];

	return {actors : [], 
		obstacles : obstacles, 
		flows : flows, 
		presentStack : presentStack,
		placeableObstacles : 0};
}

export const MAPS = [MAP_01, MAP_02, MAP_03];
