export function generateColor (s = 1.0, v = 1.0) {
    let c = HSVtoRGB(Math.random(), s, v);
    c.r *= 0.15;
    c.g *= 0.15;
    c.b *= 0.15;
    return c;
}

export function HSVtoRGB (h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return {
        r,
        g,
        b
    };
}

export function normalizeColor (input) {
    let output = {
        r: input.r / 255,
        g: input.g / 255,
        b: input.b / 255
    };
    return output;
}

export function wrap (value, min, max) {
    let range = max - min;
    if (range == 0) return min;
    return (value - min) % range + min;
}

export function hashCode (s) {
    if (s.length == 0) return 0;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

export function decodeFloat16 (binary) {
    var exponent = (binary & 0x7C00) >> 10,
        fraction = binary & 0x03FF;
    return (binary >> 15 ? -1 : 1) * (
        exponent ?
        (
            exponent === 0x1F ?
            fraction ? NaN : Infinity :
            Math.pow(2, exponent - 15) * (1 + fraction / 0x400)
        ) :
        6.103515625e-5 * (fraction / 0x400)
    );
};