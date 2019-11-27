/*
MIT License

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import * as shaders from './shaders.js'
import {Actor, m2, StaticActor, Flow, StaticActorDef, PresentDef, createRectangleVertices} from './actor.js'
import {generateColor, normalizeColor, wrap, hashCode, decodeFloat16} from './utils.js'
import * as maps from './maps.js'
import {config} from './context.js'

var Vec2 = planck.Vec2;

'use strict';

const canvas = document.getElementsByTagName('canvas')[0];
const rootDiv = document.getElementById('rootDiv');
const messageBoard = document.getElementById('messageBoard');
const obstacleCounter = document.getElementById('obstacleCounter');
resizeCanvas();

function pointerPrototype () {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    this.color = [30, 0, 300];
}

let pointers = [];
let splatStack = [];
let buildStack = [];
let previewObstacle = null;
pointers.push(new pointerPrototype());

const { gl, ext } = getWebGLContext(canvas);

if (isMobile()) {
    config.DYE_RESOLUTION = 512;
}
if (!ext.supportLinearFiltering) {
    config.DYE_RESOLUTION = 512;
    config.SHADING = false;
    config.BLOOM = false;
    config.SUNRAYS = false;
}

//startGUI();

function getWebGLContext (canvas) {
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };

    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2)
        gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);

    let halfFloat;
    let supportLinearFiltering;
    if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
        halfFloat = gl.getExtension('OES_texture_half_float');
        supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
    let formatRGBA;
    let formatRG;
    let formatR;

    if (isWebGL2)
    {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    }
    else
    {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    ga('send', 'event', isWebGL2 ? 'webgl2' : 'webgl', formatRGBA == null ? 'not supported' : 'supported');

    return {
        gl,
        ext: {
            formatRGBA,
            formatRG,
            formatR,
            halfFloatTexType,
            supportLinearFiltering
        }
    };
}

function getSupportedFormat (gl, internalFormat, format, type)
{
    if (!supportRenderTextureFormat(gl, internalFormat, format, type))
    {
        switch (internalFormat)
        {
            case gl.R16F:
                return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F:
                return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default:
                return null;
        }
    }

    return {
        internalFormat,
        format
    }
}

function supportRenderTextureFormat (gl, internalFormat, format, type) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status == gl.FRAMEBUFFER_COMPLETE;
}

function startGUI () {
    var gui = new dat.GUI({ width: 300 });
    gui.add(config, 'DYE_RESOLUTION', { 'high': 1024, 'medium': 512, 'low': 256, 'very low': 128 }).name('quality').onFinishChange(initFramebuffers);
    gui.add(config, 'SIM_RESOLUTION', { '32': 32, '64': 64, '128': 128, '256': 256 }).name('sim resolution').onFinishChange(initFramebuffers);
    gui.add(config, 'DENSITY_DISSIPATION', 0, 4.0).name('density diffusion');
    gui.add(config, 'VELOCITY_DISSIPATION', 0, 4.0).name('velocity diffusion');
    gui.add(config, 'PRESSURE', 0.0, 1.0).name('pressure');
    gui.add(config, 'CURL', 0, 50).name('vorticity').step(1);
    gui.add(config, 'SPLAT_RADIUS', 0.01, 1.0).name('splat radius');
    gui.add(config, 'SHADING').name('shading').onFinishChange(updateKeywords);
    gui.add(config, 'COLORFUL').name('colorful');
    gui.add(config, 'PAUSED').name('paused').listen();

    gui.add({ fun: () => {
        splatStack.push(parseInt(Math.random() * 20) + 5);
    } }, 'fun').name('Random splats');

    let bloomFolder = gui.addFolder('Bloom');
    bloomFolder.add(config, 'BLOOM').name('enabled').onFinishChange(updateKeywords);
    bloomFolder.add(config, 'BLOOM_INTENSITY', 0.1, 2.0).name('intensity');
    bloomFolder.add(config, 'BLOOM_THRESHOLD', 0.0, 1.0).name('threshold');

    let sunraysFolder = gui.addFolder('Sunrays');
    sunraysFolder.add(config, 'SUNRAYS').name('enabled').onFinishChange(updateKeywords);
    sunraysFolder.add(config, 'SUNRAYS_WEIGHT', 0.3, 1.0).name('weight');

    let captureFolder = gui.addFolder('Capture');
    captureFolder.addColor(config, 'BACK_COLOR').name('background color');
    captureFolder.add(config, 'TRANSPARENT').name('transparent');
    captureFolder.add({ fun: captureScreenshot }, 'fun').name('take screenshot');

    if (isMobile())
        gui.close();
}

function isMobile () {
    return /Mobi|Android/i.test(navigator.userAgent);
}

function captureScreenshot () {
    let res = getResolution(config.CAPTURE_RESOLUTION);
    let target = createFBO(res.width, res.height, ext.formatRGBA.internalFormat, ext.formatRGBA.format, ext.halfFloatTexType, gl.NEAREST);
    render(target);

    let texture = framebufferToTexture(target);
    texture = normalizeTexture(texture, target.width, target.height);

    let captureCanvas = textureToCanvas(texture, target.width, target.height);
    let datauri = captureCanvas.toDataURL();
    downloadURI('fluid.png', datauri);
    URL.revokeObjectURL(datauri);
}

function framebufferToTexture (target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    let length = target.width * target.height * 4;
    let texture = new Float32Array(length);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.FLOAT, texture);
    return texture;
}

function normalizeTexture (texture, width, height) {
    let result = new Uint8Array(texture.length);
    let id = 0;
    for (let i = height - 1; i >= 0; i--) {
        for (let j = 0; j < width; j++) {
            let nid = i * width * 4 + j * 4;
            result[nid + 0] = clamp01(texture[id + 0]) * 255;
            result[nid + 1] = clamp01(texture[id + 1]) * 255;
            result[nid + 2] = clamp01(texture[id + 2]) * 255;
            result[nid + 3] = clamp01(texture[id + 3]) * 255;
            id += 4;
        }
    }
    return result;
}

function clamp01 (input) {
    return Math.min(Math.max(input, 0), 1);
}

function textureToCanvas (texture, width, height) {
    let captureCanvas = document.createElement('canvas');
    let ctx = captureCanvas.getContext('2d');
    captureCanvas.width = width;
    captureCanvas.height = height;

    let imageData = ctx.createImageData(width, height);
    imageData.data.set(texture);
    ctx.putImageData(imageData, 0, 0);

    return captureCanvas;
}

function downloadURI (filename, uri) {
    let link = document.createElement('a');
    link.download = filename;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

class Material {
    constructor (vertexShader, fragmentShaderSource) {
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = [];
        this.activeProgram = null;
        this.uniforms = [];
    }

    setKeywords (keywords) {
        let hash = 0;
        for (let i = 0; i < keywords.length; i++)
            hash += hashCode(keywords[i]);

        let program = this.programs[hash];
        if (program == null)
        {
            let fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
            program = createProgram(this.vertexShader, fragmentShader);
            this.programs[hash] = program;
        }

        if (program == this.activeProgram) return;

        this.uniforms = getUniforms(program);
        this.activeProgram = program;
    }

    bind () {
        gl.useProgram(this.activeProgram);
    }
}

class Program {
    constructor (vertexShader, fragmentShader) {
        this.uniforms = {};
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
    }

    bind () {
        gl.useProgram(this.program);
    }
}

function createProgram (vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw gl.getProgramInfoLog(program);

    return program;
}

function getUniforms (program) {
    let uniforms = [];
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
}

function compileShader (type, source, keywords) {
    source = addKeywords(source, keywords);

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw gl.getShaderInfoLog(shader);

    return shader;
};

function addKeywords (source, keywords) {
    if (keywords == null) return source;
    let keywordsString = '';
    keywords.forEach(keyword => {
        keywordsString += '#define ' + keyword + '\n';
    });
    return keywordsString + source;
}

const baseVertexShader      = compileShader(gl.VERTEX_SHADER, shaders.baseVertexShaderSrc);
const blurVertexShader      = compileShader(gl.VERTEX_SHADER, shaders.blurVertexShaderSrc);
const blurShader            = compileShader(gl.FRAGMENT_SHADER, shaders.blurShaderSrc);
const copyShader            = compileShader(gl.FRAGMENT_SHADER, shaders.copyShaderSrc);
const clearShader           = compileShader(gl.FRAGMENT_SHADER, shaders.clearShaderSrc);
const colorShader           = compileShader(gl.FRAGMENT_SHADER, shaders.colorShaderSrc);
const checkerboardShader    = compileShader(gl.FRAGMENT_SHADER, shaders.checkerboardShaderSrc);
const bloomPrefilterShader  = compileShader(gl.FRAGMENT_SHADER, shaders.bloomPrefilterShaderSrc);
const bloomBlurShader       = compileShader(gl.FRAGMENT_SHADER, shaders.bloomBlurShaderSrc);
const bloomFinalShader      = compileShader(gl.FRAGMENT_SHADER, shaders.bloomFinalShaderSrc);
const sunraysMaskShader     = compileShader(gl.FRAGMENT_SHADER, shaders.sunraysMaskShaderSrc);
const sunraysShader         = compileShader(gl.FRAGMENT_SHADER, shaders.sunraysShaderSrc);
const splatShader           = compileShader(gl.FRAGMENT_SHADER, shaders.splatShaderSrc);
const advectionShader       = compileShader(gl.FRAGMENT_SHADER, shaders.advectionShaderSrc,
                                ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']);
const divergenceShader      = compileShader(gl.FRAGMENT_SHADER, shaders.divergenceShaderSrc);
const curlShader            = compileShader(gl.FRAGMENT_SHADER, shaders.curlShaderSrc);
const vorticityShader       = compileShader(gl.FRAGMENT_SHADER, shaders.vorticityShaderSrc);
const pressureShader        = compileShader(gl.FRAGMENT_SHADER, shaders.pressureShaderSrc);
const gradientSubtractShader= compileShader(gl.FRAGMENT_SHADER, shaders.gradientSubtractShaderSrc);
const passVertexShader      = compileShader(gl.VERTEX_SHADER, shaders.passVertexShaderSrc);
const constructSolidShader  = compileShader(gl.FRAGMENT_SHADER, shaders.constructSolidShaderSrc);
const textureVertexShader   = compileShader(gl.VERTEX_SHADER, shaders.textureVertexShaderSrc);
const textureSampleShader   = compileShader(gl.FRAGMENT_SHADER, shaders.textureSampleShaderSrc);

const screenQuadVertexBuffer = gl.createBuffer();
const screenQuadIndexBuffer = gl.createBuffer();

const blit = (() => {
    gl.bindBuffer(gl.ARRAY_BUFFER, screenQuadVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, screenQuadIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
//    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    return (destination) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, screenQuadVertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, screenQuadIndexBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
})();

let dye;
let velocity;
let divergence;
let curl;
let pressure;
let bloom;
let bloomFramebuffers = [];
let sunrays;
let sunraysTemp;

let solids;

let ditheringTexture = createTextureAsync('LDR_LLL1_0.png');

const blurProgram            = new Program(blurVertexShader, blurShader);
const copyProgram            = new Program(baseVertexShader, copyShader);
const clearProgram           = new Program(baseVertexShader, clearShader);
const colorProgram           = new Program(baseVertexShader, colorShader);
const checkerboardProgram    = new Program(baseVertexShader, checkerboardShader);
const bloomPrefilterProgram  = new Program(baseVertexShader, bloomPrefilterShader);
const bloomBlurProgram       = new Program(baseVertexShader, bloomBlurShader);
const bloomFinalProgram      = new Program(baseVertexShader, bloomFinalShader);
const sunraysMaskProgram     = new Program(baseVertexShader, sunraysMaskShader);
const sunraysProgram         = new Program(baseVertexShader, sunraysShader);
const splatProgram           = new Program(baseVertexShader, splatShader);
const advectionProgram       = new Program(baseVertexShader, advectionShader);
const divergenceProgram      = new Program(baseVertexShader, divergenceShader);
const curlProgram            = new Program(baseVertexShader, curlShader);
const vorticityProgram       = new Program(baseVertexShader, vorticityShader);
const pressureProgram        = new Program(baseVertexShader, pressureShader);
const gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);
const constructSolidProgram  = new Program(passVertexShader, constructSolidShader);
const textureProgram         = new Program(textureVertexShader, textureSampleShader);

const displayMaterial = new Material(baseVertexShader, shaders.displayShaderSource);

function initFramebuffers () {
    let simRes = getResolution(config.SIM_RESOLUTION);
    let dyeRes = getResolution(config.DYE_RESOLUTION);
    console.log(dyeRes);
    const texType = ext.halfFloatTexType;
    const rgba    = ext.formatRGBA;
    const rg      = ext.formatRG;
    const r       = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    if (dye == null)
        dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    else
        dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);

    if (velocity == null)
        velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    else
        velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);

    divergence = createFBO      (simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    curl       = createFBO      (simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    pressure   = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);

    solids     = createFBO      (simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);

    initBloomFramebuffers();
    initSunraysFramebuffers();
}

function initBloomFramebuffers () {
    let res = getResolution(config.BLOOM_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba = ext.formatRGBA;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    bloom = createFBO(res.width, res.height, rgba.internalFormat, rgba.format, texType, filtering);

    bloomFramebuffers.length = 0;
    for (let i = 0; i < config.BLOOM_ITERATIONS; i++)
    {
        let width = res.width >> (i + 1);
        let height = res.height >> (i + 1);

        if (width < 2 || height < 2) break;

        let fbo = createFBO(width, height, rgba.internalFormat, rgba.format, texType, filtering);
        bloomFramebuffers.push(fbo);
    }
}

function initSunraysFramebuffers () {
    let res = getResolution(config.SUNRAYS_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const r = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    sunrays     = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
    sunraysTemp = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
}

function createFBO (w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let texelSizeX = 1.0 / w;
    let texelSizeY = 1.0 / h;

    return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX,
        texelSizeY,
        attach (id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };
}

function createDoubleFBO (w, h, internalFormat, format, type, param) {
    let fbo1 = createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = createFBO(w, h, internalFormat, format, type, param);

    return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read () {
            return fbo1;
        },
        set read (value) {
            fbo1 = value;
        },
        get write () {
            return fbo2;
        },
        set write (value) {
            fbo2 = value;
        },
        swap () {
            let temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        }
    }
}

function resizeFBO (target, w, h, internalFormat, format, type, param) {
    let newFBO = createFBO(w, h, internalFormat, format, type, param);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(newFBO.fbo);
    return newFBO;
}

function resizeDoubleFBO (target, w, h, internalFormat, format, type, param) {
    if (target.width == w && target.height == h)
        return target;
    target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
    target.write = createFBO(w, h, internalFormat, format, type, param);
    target.width = w;
    target.height = h;
    target.texelSizeX = 1.0 / w;
    target.texelSizeY = 1.0 / h;
    return target;
}

function createTextureAsync (url) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));

    let obj = {
        texture,
        width: 1,
        height: 1,
        attach (id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };

    let image = new Image();
    image.onload = () => {
        obj.width = image.width;
        obj.height = image.height;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    };
    image.src = url;

    return obj;
}

function updateKeywords () {
    let displayKeywords = [];
    if (config.SHADING) displayKeywords.push("SHADING");
    if (config.BLOOM) displayKeywords.push("BLOOM");
    if (config.SUNRAYS) displayKeywords.push("SUNRAYS");
    displayMaterial.setKeywords(displayKeywords);
}

const texCoordBuffer = gl.createBuffer();

function drawBuffer(vertexBuffer, indexBuffer, destination) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function buildObstacle(vertices, enablePhysics=true){
    let obstacle = new StaticActor(vertices);
    obstacles.push(obstacle);

    gl.viewport(0, 0, velocity.width, velocity.height);
	obstacle.createBuffer(gl);

	if(enablePhysics){
        obstacle.createBody(world);
		constructSolidProgram.bind();
		gl.bindFramebuffer(gl.FRAMEBUFFER, solids.fbo);
		gl.enableVertexAttribArray(0);
	//    gl.bindBuffer(gl.ARRAY_BUFFER, solidVertexBuffer);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, obstacle.vertices.length); 
	}

	return obstacle;
}

function receivePresent(staticActor, present){
    staticActor.expectedPresents--;
    if(staticActor.expectedPresents == 0){
        staticActor.htmlCounter.parentNode.removeChild(staticActor.htmlCounter);    
        staticActor.htmlCounter = null;
    }
    else
        staticActor.htmlCounter.innerHTML = staticActor.expectedPresents;

    gl.viewport(0, 0, dye.width, dye.height);
    colorProgram.bind();
    gl.uniform4f(colorProgram.uniforms.color, present.color.r, present.color.g, present.color.b, 0.5);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dye.write.fbo);
    gl.bindBuffer(gl.ARRAY_BUFFER, staticActor.buffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, staticActor.vertices.length); 
    dye.swap();
}

function spawnNextPresent(){
    if(presentStack.length == 0) {
        clearInterval(timerId);
        return;
    }

    let [size, pos] = presentStack.pop();
    actors.push(new Actor(gl, world, size, pos));
}

function resetBuffers(){
    for(let i = 0; i < obstacles.length; ++i)
        if(obstacles[i].htmlCounter != null)
            rootDiv.removeChild(obstacles[i].htmlCounter);

    gl.bindFramebuffer(gl.FRAMEBUFFER, velocity.write.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    velocity.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, divergence.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.write.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    pressure.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, curl.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dye.write.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    dye.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, solids.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

function runMap(mapBuilder){
    if(currentMap != null) {
        resetBuffers();
        if(timerId != -1){
            clearInterval(timerId);
            timerId = -1;
        }
    }

    currentMap = mapBuilder;

    world = planck.World({
        gravity: planck.Vec2(0, 0)
    });
    // create borders
    var borders = world.createBody({
        type: 'static',
        position: planck.Vec2(0,0),
    });
    borders.createFixture({shape: planck.Edge(Vec2(config.MAP_SIZE_X, 0.0),Vec2(0.0, 0.0))});
    borders.createFixture({shape: planck.Edge(Vec2(0.0, 0.0),Vec2(0.0, config.MAP_SIZE_Y))});
    borders.createFixture({shape: planck.Edge(Vec2(config.MAP_SIZE_X, 0.0),Vec2(config.MAP_SIZE_X,config.MAP_SIZE_Y))});
    borders.createFixture({shape: planck.Edge(Vec2(0.0, config.MAP_SIZE_Y),Vec2(config.MAP_SIZE_X,config.MAP_SIZE_Y))});
    
    let map = mapBuilder(gl, world);
    actors = map.actors;
    obstacles = map.obstacles;
    flows = map.flows;
    presentStack = map.presentStack;
    numPlaceableObstacles = map.placeableObstacles;
    numPlaceableObstaclesMax = map.placeableObstacles;
    updateObstacleCounter();

    // write static obstacles
    gl.enable(gl.BLEND);
    gl.viewport(0, 0, velocity.width, velocity.height);

    // coordinates for texture rendering
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]), gl.STATIC_DRAW);

    constructSolidProgram.bind();
    gl.bindFramebuffer(gl.FRAMEBUFFER, solids.fbo);
    gl.enableVertexAttribArray(0);
//    gl.bindBuffer(gl.ARRAY_BUFFER, solidVertexBuffer);

    for(let i = 0; i < obstacles.length; ++i){
        let obstacle = obstacles[i];
        obstacle.createBuffer(gl);
        obstacle.createBody(world);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, obstacle.vertices.length); 

        if(obstacle.expectedPresents){
            // compute avg position
            let pos = Vec2(0,0);
            for(let j = 0; j < obstacle.vertices.length; ++j)
                pos.add(obstacle.vertices[j]);
            pos.mul(1.0 / obstacle.vertices.length);

            var h = document.createElement("div");
            h.innerHTML = obstacles[i].expectedPresents;
            h.style.left = pos.x - 15 * 0.5 + "px";
            h.style.top = 768 -  pos.y - 21 + "px";
            h.style.fontSize = "42px";
            h.style.color = "rgb(56, 255, 189)";
            rootDiv.appendChild(h);
            obstacle.htmlCounter = h;
        }
    }

    // create goals
    world.on('post-solve', function(contact) {
        var fA = contact.getFixtureA(), bA = fA.getBody();
        var fB = contact.getFixtureB(), bB = fB.getBody();
    
        var obstacle = fA.getUserData() === StaticActorDef.userData && bA || fB.getUserData() === StaticActorDef.userData && bB;
        var present = fA.getUserData() === PresentDef.userData && bA || fB.getUserData() === PresentDef.userData && bB;

        // do not change world immediately
        setTimeout(function() {
            if (obstacle && present){
                let staticActor = obstacle.getUserData();
                if(staticActor.expectedPresents > 0){
                    receivePresent(staticActor, present.getUserData());
                    world.destroyBody(present);
                    for( var i = 0; i < actors.length; i++)
                        if ( actors[i].body === present){
                            actors.splice(i, 1); 
                            break;
                        }
                }
            }
        }, 1);
      });
}

function checkWin(){
    let expectedPresents = 0;
    for(let i = 0; i < obstacles.length; ++i){
        expectedPresents += obstacles[i].expectedPresents;
    }
    if (expectedPresents == 0){
        showMessage("LEVEL COMPLETED", 5000);
        setTimeout(nextLevel,5000);
        isWaiting = true;
        obstacleCounter.innerHTML = "";
    }
}

function showMessage(msg, time){
    messageBoard.innerHTML = msg;
    if(time > 0){
        setTimeout(function()  
        {
            messageBoard.innerHTML = "";
        }, time);
    }
}

function updateObstacleCounter(){
    obstacleCounter.innerHTML = numPlaceableObstacles + "/" + numPlaceableObstaclesMax;
}

function nextLevel(){
    currentLevel++;
    if(currentLevel == maps.MAPS.length)
        showMessage("YOU WON", 0);
    else{
        runMap(maps.MAP_TEST); 
        isWaiting = true;
        showMessage("LEVEL " + currentLevel);
    }
}

const simRes = getResolution(config.SIM_RESOLUTION);
const simToPixelRatio = new Vec2(simRes.width / config.MAP_SIZE_X, simRes.height / config.MAP_SIZE_Y);

let isWaiting = false;
let currentMap = null;
let currentLevel = 0;
let world = {};
let actors = [];
let obstacles = [];
let flows = [];
let presentStack = [];
let numPlaceableObstacles = 0;
let numPlaceableObstaclesMax = 0;
let timerId = -1;

updateKeywords();
initFramebuffers();
runMap(maps.MAP_01);

let lastUpdateTime = Date.now();
let colorUpdateTimer = 0.0;
update();

function update () {
    const dt = calcDeltaTime();
    if (resizeCanvas())
        initFramebuffers();
    updateColors(dt);
    applyInputs();
    if (!config.PAUSED)
        step(dt);
    process(dt);
    if (! isWaiting)
        checkWin();
    render(null);
    requestAnimationFrame(update);
}

// gameplay update
function process(dt) {
    world.step(dt);
    
    // retrieve velocity field
    let data = new Uint16Array(simRes.width * simRes.height * 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocity.write.fbo);
    gl.readPixels(0, 0, simRes.width, simRes.height, ext.formatRG.format, ext.halfFloatTexType, data);
    
    // update dynamic actors
    for(let i = 0; i < actors.length; ++i){
        let actor = actors[i];
        const rot = m2.rotation(actor.body.getAngle());
        const offset = actor.size.clone().mul(0.5);
        const pos = actor.body.getPosition();
        const p00 = Vec2.add(pos, m2.multiply(rot, new Vec2(-offset.x, -offset.y)));
        const p01 = Vec2.add(pos, m2.multiply(rot, new Vec2(-offset.x, offset.y)));
        const p10 = Vec2.add(pos, m2.multiply(rot, new Vec2(offset.x, -offset.y)));
        const p11 = Vec2.add(pos, m2.multiply(rot, new Vec2(offset.x, offset.y)));
        const v00 = readVelocity(data,p00);
        const v01 = readVelocity(data,p01);
        const v10 = readVelocity(data,p10);
        const v11 = readVelocity(data,p11);
        const v55 = readVelocity(data, pos).mul(4);
        actor.updateVelocity([v00,v01,v10,v11,v55],[p00,p01,p10,p11,pos]);
    }

    // update flows
    for(let i = 0; i < flows.length; ++i){
        let flow = flows[i];
        splat(flow.positionBegin.x, flow.positionBegin.y, 
            flow.direction.x, flow.direction.y, flow.color, flow.radius, dt * flow.force); //flow.color, 10.0, flow.force * dt
    }
}

function readVelocity(data, position){
    const idx = 2 * (Math.floor(position.x * simToPixelRatio.x) + Math.floor(position.y * simToPixelRatio.y) * simRes.width);
    return new Vec2(decodeFloat16(data[idx]),decodeFloat16(data[idx+1]));
}

function calcDeltaTime () {
    let now = Date.now();
    let dt = (now - lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    lastUpdateTime = now;
    return dt;
}

function resizeCanvas () {
    let width = scaleByPixelRatio(canvas.clientWidth);
    let height = scaleByPixelRatio(canvas.clientHeight);
    if (canvas.width != width || canvas.height != height) {
        canvas.width = width;
        canvas.height = height;
        return true;
    }
    return false;
}

function updateColors (dt) {
    if (!config.COLORFUL) return;

    colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
    if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach(p => {
            p.color = generateColor();
        });
    }
}

function applyInputs () {
    if (splatStack.length > 0)
        multipleSplats(splatStack.pop());

    pointers.forEach(p => {
        if (p.moved) {
            p.moved = false;
            splatPointer(p);
        }
    });
}

function step (dt) {
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, velocity.width, velocity.height);

    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl.fbo);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write.fbo);
    velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence.fbo);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
    blit(pressure.write.fbo);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write.fbo);
        pressure.swap();
    }

    gradienSubtractProgram.bind();
    gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    gl.uniform1i(gradienSubtractProgram.uniforms.uSolids, solids.attach(2));
    blit(velocity.write.fbo);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    let velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blit(velocity.write.fbo);
    velocity.swap();

    gl.viewport(0, 0, dye.width, dye.height);

    if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blit(dye.write.fbo);
    dye.swap();
}

function render (target) {
    if (config.BLOOM)
        applyBloom(dye.read, bloom);
    if (config.SUNRAYS) {
        applySunrays(dye.read, dye.write, sunrays);
        blur(sunrays, sunraysTemp, 1);
    }

    if (target == null || !config.TRANSPARENT) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
    }
    else {
        gl.disable(gl.BLEND);
    }

    let width = target == null ? gl.drawingBufferWidth : target.width;
    let height = target == null ? gl.drawingBufferHeight : target.height;
    gl.viewport(0, 0, width, height);

    let fbo = target == null ? null : target.fbo;
    if (!config.TRANSPARENT)
        drawColor(fbo, normalizeColor(config.BACK_COLOR));
    if (target == null && config.TRANSPARENT)
        drawCheckerboard(fbo);
    drawObstacles(fbo);
    drawDisplay(fbo, width, height);
    drawActors(fbo, actors);
}

function drawColor (fbo, color) {
    colorProgram.bind();
    gl.uniform4f(colorProgram.uniforms.color, color.r, color.g, color.b, 1);
    blit(fbo);
}

function drawCheckerboard (fbo) {
    checkerboardProgram.bind();
    gl.uniform1f(checkerboardProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    blit(fbo);
}

function drawDisplay (fbo, width, height) {
    displayMaterial.bind();
    if (config.SHADING)
        gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
    gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    if (config.BLOOM) {
        gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
        gl.uniform1i(displayMaterial.uniforms.uDithering, ditheringTexture.attach(2));
        let scale = getTextureScale(ditheringTexture, width, height);
        gl.uniform2f(displayMaterial.uniforms.ditherScale, scale.x, scale.y);
    }
    if (config.SUNRAYS)
        gl.uniform1i(displayMaterial.uniforms.uSunrays, sunrays.attach(3));
    blit(fbo);
}

function drawActors(fbo, actors){

    textureProgram.bind();

    gl.bindBuffer(gl.ARRAY_BUFFER, screenQuadVertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, screenQuadIndexBuffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.activeTexture(gl.TEXTURE0);

    for(let i = 0; i < actors.length; ++i){
        gl.bindTexture(gl.TEXTURE_2D, actors[i].texture);
        gl.uniform1i(textureProgram.uniforms.uTexture, 0);
        gl.uniformMatrix3fv(textureProgram.uniforms.uMatrix, false, actors[i].computeTransformation());
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
}

function drawObstacles(fbo){
    checkerboardProgram.bind();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.uniform1f(checkerboardProgram.uniforms.aspectRatio, canvas.width / canvas.height);

    for(let i = 0; i < obstacles.length; ++i){
        gl.bindBuffer(gl.ARRAY_BUFFER, obstacles[i].buffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, obstacles[i].vertices.length); 
    }
}

function applyBloom (source, destination) {
    if (bloomFramebuffers.length < 2)
        return;

    let last = destination;

    gl.disable(gl.BLEND);
    bloomPrefilterProgram.bind();
    let knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
    let curve0 = config.BLOOM_THRESHOLD - knee;
    let curve1 = knee * 2;
    let curve2 = 0.25 / knee;
    gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
    gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, config.BLOOM_THRESHOLD);
    gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
    gl.viewport(0, 0, last.width, last.height);
    blit(last.fbo);

    bloomBlurProgram.bind();
    for (let i = 0; i < bloomFramebuffers.length; i++) {
        let dest = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        gl.viewport(0, 0, dest.width, dest.height);
        blit(dest.fbo);
        last = dest;
    }

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.BLEND);

    for (let i = bloomFramebuffers.length - 2; i >= 0; i--) {
        let baseTex = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        gl.viewport(0, 0, baseTex.width, baseTex.height);
        blit(baseTex.fbo);
        last = baseTex;
    }

    gl.disable(gl.BLEND);
    bloomFinalProgram.bind();
    gl.uniform2f(bloomFinalProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
    gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
    gl.uniform1f(bloomFinalProgram.uniforms.intensity, config.BLOOM_INTENSITY);
    gl.viewport(0, 0, destination.width, destination.height);
    blit(destination.fbo);
}

function applySunrays (source, mask, destination) {
    gl.disable(gl.BLEND);
    sunraysMaskProgram.bind();
    gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
    gl.viewport(0, 0, mask.width, mask.height);
    blit(mask.fbo);

    sunraysProgram.bind();
    gl.uniform1f(sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
    gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
    gl.viewport(0, 0, destination.width, destination.height);
    blit(destination.fbo);
}

function blur (target, temp, iterations) {
    blurProgram.bind();
    for (let i = 0; i < iterations; i++) {
        gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
        gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
        blit(temp.fbo);

        gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
        gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
        blit(target.fbo);
    }
}

function splatPointer (pointer) {
    let dx = pointer.deltaX * config.SPLAT_FORCE;
    let dy = pointer.deltaY * config.SPLAT_FORCE;
    splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
}

function multipleSplats (amount) {
    for (let i = 0; i < amount; i++) {
        const color = generateColor();
        color.r *= 10.0;
        color.g *= 10.0;
        color.b *= 10.0;
        const x = Math.random();
        const y = Math.random();
        const dx = 1000 * (Math.random() - 0.5);
        const dy = 1000 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color);
    }
}

function splat (x, y, dx, dy, color, radius = correctRadius(config.SPLAT_RADIUS / 100.0),force = 1.0) {

    gl.viewport(0, 0, velocity.width, velocity.height);
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(splatProgram.uniforms.radius, radius);
    gl.uniform1f(splatProgram.uniforms.force, force);
    blit(velocity.write.fbo);
    velocity.swap();

    gl.viewport(0, 0, dye.width, dye.height);
    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
    blit(dye.write.fbo);
    dye.swap();
}

function correctRadius (radius) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1)
        radius *= aspectRatio;
    return radius;
}

canvas.addEventListener('mousedown', e => {
	// start new obstacle with left mouse button
    if(e.button === 0 && numPlaceableObstacles > 0) 
        buildStack.push(Vec2(e.offsetX, canvas.height-e.offsetY));
    else {
        let posX = scaleByPixelRatio(e.offsetX);
        let posY = scaleByPixelRatio(e.offsetY);
        let pointer = pointers.find(p => p.id == -1);
        if (pointer == null)
            pointer = new pointerPrototype();
        updatePointerDownData(pointer, -1, posX, posY);
    }
});

canvas.addEventListener('mousemove', e => {
	if(buildStack.length > 0){
		const begin = buildStack[0];
		const end = Vec2(e.offsetX, canvas.height-e.offsetY);
		if(previewObstacle != null) obstacles.pop();
		previewObstacle = buildObstacle(createRectangleVertices(begin,end), false);
	}
    let pointer = pointers[0];
    if (!pointer.down) return;
    let posX = scaleByPixelRatio(e.offsetX);
    let posY = scaleByPixelRatio(e.offsetY);
	updatePointerMoveData(pointer, posX, posY);
});

canvas.addEventListener('mouseup', e => {
    updatePointerUpData(pointers[0]);
    if(e.button == 0 && buildStack.length) {
		if(previewObstacle != null) {
			previewObstacle = null;
			obstacles.pop();
		}
        const begin = buildStack[0];
		const end = Vec2(e.offsetX, canvas.height-e.offsetY);
		buildStack = [];

        // do not allow very small obstacles due to inconsistent physics
		if(Vec2.sub(begin,end).length() < 20)
			return;
        
        --numPlaceableObstacles;
        updateObstacleCounter();
        buildObstacle(createRectangleVertices(begin,end));
    }
});

window.addEventListener('keydown', e=> {
    if(isWaiting) return;
    
    if (e.code === 'KeyP')
        config.PAUSED = !config.PAUSED;
	else if(e.keyCode == 27 && buildStack.length){
		// delete current obstacle
		buildStack = [];
		if(previewObstacle != null){
			obstacles.pop();
			previewObstacle = null;
        }
	} else if(e.code === 'KeyR' && currentMap != null)
        runMap(currentMap);
    else if(e.key === ' ' && timerId === -1){
        // first comes instantly
        spawnNextPresent();
        timerId = setInterval(spawnNextPresent, 2000);
    }
});

function updatePointerDownData (pointer, id, posX, posY) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = generateColor();
}

function updatePointerMoveData (pointer, posX, posY) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

function updatePointerUpData (pointer) {
    pointer.down = false;
}

function correctDeltaX (delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
}

function correctDeltaY (delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
}

function getResolution (resolution) {
    let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1)
        aspectRatio = 1.0 / aspectRatio;

    let min = Math.round(resolution);
    let max = Math.round(resolution * aspectRatio);

    if (gl.drawingBufferWidth > gl.drawingBufferHeight)
        return { width: max, height: min };
    else
        return { width: min, height: max };
}

function getTextureScale (texture, width, height) {
    return {
        x: width / texture.width,
        y: height / texture.height
    };
}

function scaleByPixelRatio (input) {
    let pixelRatio = window.devicePixelRatio || 1;
    return Math.floor(input * pixelRatio);
}