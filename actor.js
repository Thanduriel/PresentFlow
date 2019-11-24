"use strict";

import {config, ASPECT_RATIO} from './context.js'
import { splatShaderSrc } from './shaders.js';

var Vec2 = planck.Vec2;

function toTexCoord(v){
    return new Vec2(v.x * 0.5 + 0.5 * config.MAP_SIZE_X, v.y * 0.5 + 0.5 * config.MAP_SIZE_Y);
}

function toScreenSpace(v){
    return new Vec2(v.x / config.MAP_SIZE_X * 2.0 - 1.0, 
        v.y / config.MAP_SIZE_Y * 2.0 - 1.0);
}


export let m2 = {
    rotation: function(angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
        return [
          c,-s,
          s, c,
        ];
      },
      multiply: function(mat, vec){
          return new Vec2(vec.x * mat[0] + vec.x * mat[2],
            vec.y * mat[1] + vec.y * mat[3]);
      }
}

let m3 = {
    translation: function(tx, ty) {
      return [
        1, 0, 0,
        0, 1, 0,
        tx, ty, 1,
      ];
    },
   
    rotation: function(angleInRadians) {
      var c = Math.cos(angleInRadians);
      var s = Math.sin(angleInRadians);
      return [
        c,-s, 0,
        s, c, 0,
        0, 0, 1,
      ];
    },
   
    scaling: function(sx, sy) {
      return [
        sx, 0, 0,
        0, sy, 0,
        0, 0, 1,
      ];
    },

    view: function(sx, sy) {
        const a = 2 / sx;
        const b = 2 / sy;
        const c = -a * sx * 0.5;
        const d = -b * sy * 0.5;
        return [
            a, 0, 0,
            0, b, 0,
            c, d, 1,
        ];
    },

    multiply: function(a, b) {
        var a00 = a[0 * 3 + 0];
        var a01 = a[0 * 3 + 1];
        var a02 = a[0 * 3 + 2];
        var a10 = a[1 * 3 + 0];
        var a11 = a[1 * 3 + 1];
        var a12 = a[1 * 3 + 2];
        var a20 = a[2 * 3 + 0];
        var a21 = a[2 * 3 + 1];
        var a22 = a[2 * 3 + 2];
        var b00 = b[0 * 3 + 0];
        var b01 = b[0 * 3 + 1];
        var b02 = b[0 * 3 + 2];
        var b10 = b[1 * 3 + 0];
        var b11 = b[1 * 3 + 1];
        var b12 = b[1 * 3 + 2];
        var b20 = b[2 * 3 + 0];
        var b21 = b[2 * 3 + 1];
        var b22 = b[2 * 3 + 2];
        return [
            b00 * a00 + b01 * a10 + b02 * a20,
            b00 * a01 + b01 * a11 + b02 * a21,
            b00 * a02 + b01 * a12 + b02 * a22,
            b10 * a00 + b11 * a10 + b12 * a20,
            b10 * a01 + b11 * a11 + b12 * a21,
            b10 * a02 + b11 * a12 + b12 * a22,
            b20 * a00 + b21 * a10 + b22 * a20,
            b20 * a01 + b21 * a11 + b22 * a21,
            b20 * a02 + b21 * a12 + b22 * a22,
        ];
    },


};

export const PresentDef = {
    density: 1.0,
    friction: 0.3,
    userData: "Present"
}

export class Actor {
    constructor (gl, world, size, position) {
        this.size = size;
        // create physics body
        this.body = world.createBody({
            type: 'dynamic',
            position: position,
            linearVelocity: Vec2(-100.01,0.0)
        });
        this.body.createFixture(planck.Box(size.x*0.5, size.y*0.5, Vec2(0.5,0.5)), PresentDef);

        // create texture
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.x, size.y, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            generatePresentTex(size));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    computeTransformation(){
        const pos = this.body.getPosition();
        var translation = m3.translation(pos.x, pos.y);
        var rotation    = m3.rotation(2 * 3.1415 - this.body.getAngle());
        var scale       = m3.scaling(this.size.x * 0.5, 
            this.size.y * 0.5);
        
        var matrix = m3.multiply(translation, rotation);
        matrix = m3.multiply(matrix, scale);

        const view = m3.view(config.MAP_SIZE_X, config.MAP_SIZE_Y);

        return m3.multiply(view, matrix);
    }

    updateVelocity(velocities, positions){
        for (let i = 0; i < velocities.length; ++i) {
            this.body.applyForce(velocities[i].mul(500), positions[i], true);
        }
    }

}

const presentParams = {
    RIBBON_HALF_RATIO : 0.1,
}

function generatePresentTex(size){
    var buf = new Uint8Array(size.x * size.y * 4);

    // wrapping paper
    for (let i = 0; i < buf.length; i+=4) {
        buf[i] = 255;
        buf[i+3] = 255;
    }

    let halfSize = size.x / 2.0;
    const ribbonHalf = size.x * presentParams.RIBBON_HALF_RATIO;
    // horizontal ribbon
    for (let ix = 0; ix < size.x; ++ix) {
        const min = halfSize - ribbonHalf;
        const max = halfSize + ribbonHalf;
        for (let iy = min; iy < max; ++iy) {
            const ind = ix * 4 + iy * size.x * 4;
            buf[ind] = 255;
            buf[ind+1] = 255;
        }
    }

    // vertical ribbon
    halfSize = size.y / 2.0;

    for (let iy = 0; iy < size.y; ++iy) {
        const min = halfSize - ribbonHalf;
        const max = halfSize + ribbonHalf;
        for (let ix = min; ix < max; ++ix) {
            const ind = ix * 4 + iy * size.x * 4;
            buf[ind] = 255;
            buf[ind+1] = 255;
        }
    }
    
    return buf;
}

export const StaticActorDef = {
    friction: 0.1,
    restitution: 0.1,
    userData: 'StaticActor'
  };

export function createRectangleVertices(begin, end){
    const dir = Vec2.sub(begin, end);
    let offset = Vec2(-dir.y, dir.x);
    offset.normalize();
    offset.mul(config.OBSTACLE_HALF_WIDTH);

    return [Vec2.add(begin,offset), Vec2.sub(begin,offset), Vec2.add(end,offset), Vec2.sub(end,offset)];
}

export class StaticActor{
    constructor(vertices){
        this.vertices = vertices;
        this.expectedPresents = 1;
        this.htmlCounter = null;
    }

    createBody(world){
        this.body = world.createBody({
            type: 'static',
            position: planck.Vec2(0,0),
            userData: this
        });
        this.body.createFixture(planck.Polygon(this.vertices), StaticActorDef);
    }

    createBuffer(gl){
        let buf = new Float32Array(this.vertices.length*2);
        for(let i = 0; i < this.vertices.length; ++i){
            const v = toScreenSpace(this.vertices[i]);
            buf[i*2] = v.x;
            buf[i*2+1] = v.y;
        }
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    }
}

export class Flow{
    constructor(posBegin, posEnd, force, color, radius){
        this.direction = posEnd.sub(posBegin);
        posBegin.x /= config.MAP_SIZE_X;
        posBegin.y /= config.MAP_SIZE_Y;
        this.positionBegin = posBegin;
        this.force = force;
        this.color = color;
        this.radius = radius / config.MAP_SIZE_Y;
    }
}
