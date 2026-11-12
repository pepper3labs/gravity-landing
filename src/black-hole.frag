precision highp float;
uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uInclination;
uniform float uResolutionX;
uniform float uSky;
varying vec2 outTexCoord;
const float PI = 3.14159265359;

float orbit(float b, float phi) {
    vec2 uv = vec2((clamp((b-.005)/12.095,0.,1.)*2047.+.5)/2048.,
                   (clamp(phi/(3.*PI),0.,1.)*1023.+.5)/1024.);
    vec2 orbitBytes = texture2D(uMainSampler,uv).rg;
    return dot(orbitBytes,vec2(65280.,255.))/65535.;
}
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
vec3 disk(vec2 p) {
    float b=max(length(p),.005), e=uInclination;
    float phi0=mod(atan(-sin(e),p.y/b*cos(e)),PI);
    vec3 light=vec3(0); float transmission=1.;
    for(int i=0;i<3;i++) {
        float phi=phi0+float(i)*PI, inv=orbit(b,phi), r=1./max(inv,.00001);
        if(inv>0. && r>3. && r<9.1) {
            float az=atan(cos(phi)*cos(e)-sin(phi)*p.y/b*sin(e),sin(phi)*p.x/b);
            float speed=1.25*pow(3./r,1.5), a=az-uTime*speed;
            // Periodic azimuth coordinates avoid a seam where atan wraps.
            vec2 flow=vec2(cos(a),sin(a));
            float cloud=noise(flow*3.4+vec2(r*.8,r*1.4));
            float fine=noise(flow*13.+r*4.);
            float filaments=sin(r*23.+cloud*7.+sin(a*3.+r*2.)*3.+a*9.);
            float intensity=.12+1.55*cloud*cloud+.32*fine+.18*filaments;
            float hot=pow(max(0.,cos(a*2.+r*1.6)),16.);
            intensity+=hot*.95;
            float heat=max(0.,1.-sqrt(3./r))*pow(3./r,3.);
            float shift=sqrt(max(.01,1.-1./r))/(1.+.22*p.x/r);
            float edge=smoothstep(3.,3.18,r)*(1.-smoothstep(7.0,9.1,r));
            float value=heat*25.*max(.05,intensity)*edge*pow(shift,3.)*transmission*pow(.6,float(i));
            vec3 tint=mix(vec3(.20,.43,1.),vec3(.78,.90,1.),clamp((6.-r)/3.+hot*.18,0.,1.));
            light+=value*tint;
            transmission*=.12;
        }
    }
    return light;
}
float stars(vec2 p) {
    vec2 cell=floor(p), f=fract(p)-.5;
    float h=hash(cell), d=length(f-vec2(hash(cell+17.),hash(cell+31.))*.55);
    return (1.-smoothstep(0.,.055,d))*step(.982,h)*(.4+hash(cell+5.));
}
void main() {
    vec2 p=vec2((outTexCoord.x-.5)*20.,(.5-outTexCoord.y)*13.333333);
    float b=length(p), pixel=20./max(uResolutionX,200.);
    vec3 light=disk(p);
    // Four nearby rays supply a modest live halo, not a baked bloom image.
    float blur=max(pixel*1.4,.045);
    light+=(disk(p+vec2(blur,0))+disk(p-vec2(blur,0))+
            disk(p+vec2(0,blur))+disk(p-vec2(0,blur)))*.055;
    float shadow=1.-smoothstep(2.57,2.63,b);
    float ring=exp(-abs(b-2.61)*42.);
    light+=vec3(.15,.30,.62)*ring*(.75+.25*cos(atan(p.y,p.x)*3.-uTime*.32));
    float halo=exp(-pow((b-2.8)/1.9,2.))*(1.-shadow)*.025;
    light+=vec3(.23,.43,1.)*halo;
    // Artistic local starfield lens approximation; not scene-wide ray tracing.
    vec2 bent=p*(1.-6.75/max(b*b,.1));
    bent+=vec2(uTime*.012,0.);
    float star=stars(bent*4.7)*(1.-shadow)*uSky;
    light+=vec3(.65,.80,1.)*star;
    vec3 rgb=pow(1.-exp(-light*1.25),vec3(1./2.2));
    float fade=(1.-smoothstep(9.2,10.,abs(p.x)))*(1.-smoothstep(6.1,6.66,abs(p.y)));
    rgb*=fade;
    float alpha=max(max(rgb.r,rgb.g),rgb.b);
    alpha=max(alpha,shadow);
    // Premultiplied output, matching Phaser's normal blend mode.
    gl_FragColor=vec4(rgb,alpha);
}
