"use strict";

import {config} from './context.js'

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

export class Actor {
    constructor (gl, size, position, rotation) {
        this.size = size;
        this.position = position;
        this.rotation = rotation;

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
        var translation = m3.translation(this.position.x, this.position.y);
        var rotation    = m3.rotation(this.rotation);
        var scale       = m3.scaling(this.size.x / config.MAP_SIZE_X, 
            this.size.y / config.MAP_SIZE_Y);
        
        var matrix = m3.multiply(translation, rotation);
        matrix = m3.multiply(matrix, scale);

        return matrix;
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

    // horizontal ribbon
    for (let ix = 0; ix < size.x; ++ix) {
        const min = size.y * (0.5 - presentParams.RIBBON_HALF_RATIO);
        const max = size.y * (0.5 + presentParams.RIBBON_HALF_RATIO);
        for (let iy = min; iy < max; ++iy) {
            const ind = ix * 4 + iy * size.x * 4;
            buf[ind] = 255;
            buf[ind+1] = 255;
        }
    }

    // vertical ribbon
    for (let iy = 0; iy < size.y; ++iy) {
        const min = size.x * (0.5 - presentParams.RIBBON_HALF_RATIO);
        const max = size.x * (0.5 + presentParams.RIBBON_HALF_RATIO);
        for (let ix = min; ix < max; ++ix) {
            const ind = ix * 4 + iy * size.x * 4;
            buf[ind] = 255;
            buf[ind+1] = 255;
        }
    }
    
    return buf;
}
